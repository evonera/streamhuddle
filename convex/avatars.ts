import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { httpAction, internalMutation } from "./_generated/server"
import { safeGetAuthenticatedUser } from "./auth"
import { consumeLimit } from "./rateLimit"
import { isAllowedAvatarMetadata } from "./validators"

const MAX_BYTES = 5 * 1024 * 1024
const UPLOAD_TIMEOUT = 2 * 60_000
const ORPHAN_GRACE = 60 * 60_000

export const beginUpload = internalMutation({
  args: {},
  handler: async (ctx) => {
    const user = await safeGetAuthenticatedUser(ctx)
    if (!user) return { status: "unauthorized" as const }
    const pending = await ctx.db
      .query("avatarUploads")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique()
    if (pending && pending.expiresAt > Date.now()) return { status: "busy" as const }
    if (pending) await ctx.db.delete(pending._id)
    const limit = await consumeLimit(ctx, "avatarUpload", user._id)
    if (!limit.ok) return { status: "limited" as const, retryAfter: limit.retryAfter ?? 60_000 }
    const uploadId = await ctx.db.insert("avatarUploads", {
      userId: user._id,
      expiresAt: Date.now() + UPLOAD_TIMEOUT,
    })
    await ctx.scheduler.runAfter(UPLOAD_TIMEOUT, internal.avatars.releaseUpload, { uploadId })
    return { status: "ready" as const, uploadId }
  },
})

export const releaseUpload = internalMutation({
  args: { uploadId: v.id("avatarUploads") },
  returns: v.null(),
  handler: async (ctx, { uploadId }) => {
    if (await ctx.db.get(uploadId)) await ctx.db.delete(uploadId)
    return null
  },
})

export const completeUpload = internalMutation({
  args: { uploadId: v.id("avatarUploads"), storageId: v.id("_storage") },
  returns: v.boolean(),
  handler: async (ctx, { uploadId, storageId }) => {
    const user = await safeGetAuthenticatedUser(ctx)
    const upload = await ctx.db.get(uploadId)
    const metadata = await ctx.db.system.get("_storage", storageId)
    if (
      !user ||
      !upload ||
      upload.userId !== user._id ||
      upload.expiresAt <= Date.now() ||
      !metadata ||
      metadata.size <= 0 ||
      metadata.size > MAX_BYTES
    )
      return false
    // Only the HTTP handler calls this internal mutation. It has already
    // checked the MIME type and signature before creating this storage object.
    if (user.avatar) await ctx.storage.delete(user.avatar)
    await ctx.db.patch(user._id, {
      avatar: storageId,
      avatarUploadPending: undefined,
      updatedAt: Date.now(),
    })
    await ctx.db.delete(uploadId)
    return true
  },
})

function matchesImageSignature(bytes: Uint8Array, type: string): boolean {
  const startsWith = (prefix: Array<number>) =>
    prefix.every((value, index) => bytes[index] === value)
  switch (type) {
    case "image/png":
      return startsWith([137, 80, 78, 71, 13, 10, 26, 10])
    case "image/jpeg":
      return startsWith([255, 216, 255])
    case "image/gif":
      return startsWith([71, 73, 70, 56]) && [55, 57].includes(bytes[4]) && bytes[5] === 97
    case "image/webp":
      return (
        startsWith([82, 73, 70, 70]) &&
        [87, 69, 66, 80].every((value, index) => bytes[index + 8] === value)
      )
    default:
      return false
  }
}

export const uploadAvatar = httpAction(async (ctx, request) => {
  const reservation = await ctx.runMutation(internal.avatars.beginUpload, {})
  if (reservation.status === "unauthorized") return new Response("Unauthorized", { status: 401 })
  if (reservation.status === "busy")
    return new Response("An avatar upload is already in progress", { status: 409 })
  if (reservation.status === "limited")
    return new Response("Too many avatar uploads", {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(reservation.retryAfter / 1000)) },
    })

  let storageId: Id<"_storage"> | undefined
  let attached = false
  try {
    const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? ""
    const declaredSize = Number(request.headers.get("content-length"))
    if (declaredSize > MAX_BYTES) return new Response("Image must be under 5 MB", { status: 413 })
    if (!isAllowedAvatarMetadata(1, type))
      return new Response("Unsupported image type", { status: 415 })
    // Convex bounds HTTP bodies; validate actual bytes before anything reaches
    // persistent storage, including requests that omit/spoof Content-Length.
    const blob = await request.blob()
    if (blob.size === 0 || blob.size > MAX_BYTES)
      return new Response("Image must be under 5 MB", { status: 413 })
    if (!matchesImageSignature(new Uint8Array(await blob.slice(0, 12).arrayBuffer()), type)) {
      return new Response("Invalid image file", { status: 415 })
    }
    storageId = await ctx.storage.store(new Blob([blob], { type }))
    attached = await ctx.runMutation(internal.avatars.completeUpload, {
      uploadId: reservation.uploadId,
      storageId,
    })
    if (!attached) return new Response("Upload expired; please try again", { status: 409 })
    return Response.json({ avatarUrl: await ctx.storage.getUrl(storageId) })
  } catch (error) {
    console.error("Avatar upload failed", error)
    return new Response("Avatar upload failed; please try again", { status: 500 })
  } finally {
    if (storageId && !attached) await ctx.storage.delete(storageId)
    await ctx.runMutation(internal.avatars.releaseUpload, { uploadId: reservation.uploadId })
  }
})

// Convex storage is used only for avatars. Recover objects
// left by old direct URLs or a server interruption between store and attach.
export const cleanupOrphans = internalMutation({
  args: { cursor: v.optional(v.string()), cutoff: v.optional(v.number()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoff = args.cutoff ?? Date.now() - ORPHAN_GRACE
    const page = await ctx.db.system
      .query("_storage")
      .withIndex("by_creation_time", (q) => q.lt("_creationTime", cutoff))
      .paginate({ cursor: args.cursor ?? null, numItems: 100 })
    for (const file of page.page) {
      const owner = await ctx.db
        .query("users")
        .withIndex("by_avatar", (q) => q.eq("avatar", file._id))
        .first()
      if (!owner) await ctx.storage.delete(file._id)
    }
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.avatars.cleanupOrphans, {
        cursor: page.continueCursor,
        cutoff,
      })
    return null
  },
})
