import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { internalAction, internalMutation, internalQuery } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"
import { r2 } from "./r2"
import { getTwitchAccessToken } from "./twitch"

export const getClipUserId = internalQuery({
  args: { clipRecordId: v.id("clips") },
  handler: async (ctx, args) => {
    const clip = await ctx.db.get(args.clipRecordId)
    return clip ? { userId: clip.userId } : null
  },
})

export const getTwitchTokenByUser = internalQuery({
  args: { userId: v.string() },
  returns: v.object({
    tokenId: v.id("twitchUserTokens"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db
      .query("twitchUserTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first()
    if (!tokenRecord) throw new Error("No Twitch token connected for this user")
    return {
      tokenId: tokenRecord._id,
      accessToken: tokenRecord.accessToken,
      refreshToken: tokenRecord.refreshToken,
      expiresAt: tokenRecord.expiresAt,
    }
  },
})

export const storeRefreshedTwitchToken = internalMutation({
  args: {
    tokenId: v.id("twitchUserTokens"),
    previousRefreshToken: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresIn: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.tokenId)
    if (!existing) return null // user disconnected Twitch meanwhile
    // Compare-and-set: multi-stream clips refresh in parallel, and the user may
    // reconnect meanwhile. Only the first writer for a given grant wins, so a
    // slower refresh can never replace newer tokens.
    if (existing.refreshToken !== args.previousRefreshToken) return null
    await ctx.db.patch(args.tokenId, {
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: Date.now() + args.expiresIn * 1000,
    })
    return null
  },
})

const RECONNECT_TWITCH = "Twitch authorization expired. Please reconnect Twitch."

/** Exchange the stored refresh token for a new user access token and persist it. */
async function refreshUserToken(
  ctx: ActionCtx,
  record: { tokenId: Id<"twitchUserTokens">; refreshToken: string },
): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET.")

  const response = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    signal: AbortSignal.timeout(8_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: record.refreshToken,
    }),
  })
  if (!response.ok) {
    // 400/401 means the refresh token was revoked or is invalid: the user must reconnect.
    console.error("Twitch token refresh failed:", response.status)
    throw new Error(RECONNECT_TWITCH)
  }
  const data = (await response.json()) as { access_token: string; refresh_token: string; expires_in: number }
  await ctx.runMutation(internal.clipActions.storeRefreshedTwitchToken, {
    tokenId: record.tokenId,
    previousRefreshToken: record.refreshToken,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  })
  return data.access_token
}

export const createTwitchClip = internalAction({
  args: {
    clipRecordId: v.id("clips"),
    broadcasterId: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args): Promise<string> => {
    const clip = await ctx.runQuery(internal.clipActions.getClipUserId, {
      clipRecordId: args.clipRecordId,
    })
    if (!clip) throw new Error("Clip not found")
    const record = await ctx.runQuery(internal.clipActions.getTwitchTokenByUser, {
      userId: clip.userId,
    })
    // Refresh ahead of expiry (1 min buffer) so long-lived connections keep working.
    let refreshed = record.expiresAt - 60_000 <= Date.now()
    let token = refreshed ? await refreshUserToken(ctx, record) : record.accessToken

    // 1. Create Clip (Note: Twitch POST /helix/clips only accepts broadcaster_id and has_delay.
    // Every clip created via Twitch API captures ~30 seconds by default. The user-selected duration
    // is applied during the client-side compositing/trimming stage in WebCodecsCompositor.)
    const createClip = (accessToken: string) =>
      fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${args.broadcasterId}`, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID!,
        },
      })

    let response = await createClip(token)
    if (response.status === 401) {
      // Twitch rotates refresh tokens, so a token refreshed moments ago can't be refreshed again.
      if (refreshed) throw new Error(RECONNECT_TWITCH)
      // Token was revoked or expired early: refresh once and retry.
      token = await refreshUserToken(ctx, record)
      refreshed = true
      response = await createClip(token)
    }

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Twitch Create Clip Error:", errorText)
      throw new Error(`Failed to create clip: ${response.status}`)
    }

    const data = await response.json()
    if (!data.data || data.data.length === 0) {
      throw new Error("Twitch returned no clip data — broadcaster may be offline or rate-limited")
    }
    return data.data[0].id as string // The clip ID
  },
})

export const getClipDownloadUrlsViaThumbnail = internalAction({
  args: {
    clipIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Array<string>> => {
    if (args.clipIds.length === 0) return []
    const token = await getTwitchAccessToken(ctx)

    // Split into chunks of 50 to avoid URL length limits
    const chunkSize = 50
    const allUrls: Array<string> = []

    for (let i = 0; i < args.clipIds.length; i += chunkSize) {
      const chunk = args.clipIds.slice(i, i + chunkSize)
      const url = new URL("https://api.twitch.tv/helix/clips")
      chunk.forEach((id) => url.searchParams.append("id", id))

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID!,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Twitch Get Clips Error:", errorText)
        throw new Error(`Failed to get clips metadata: ${response.status}`)
      }

      const data = await response.json()

      // Order the URLs to match the input clipIds array
      for (const id of chunk) {
        const clipData = data.data.find((c: any) => c.id === id)
        if (!clipData || !clipData.thumbnail_url) {
          throw new Error(`Clip metadata or thumbnail not found for ${id}`)
        }
        // Thumbnail URL trick: replace -preview...jpg with .mp4
        const mp4Url = clipData.thumbnail_url.replace(/-preview-.*\.jpg$/, ".mp4")

        if (!mp4Url.endsWith(".mp4")) {
          throw new Error(
            `Failed to extract MP4 URL from thumbnail for clip ${id}: ${clipData.thumbnail_url}`,
          )
        }

        allUrls.push(mp4Url)
      }
    }

    return allUrls
  },
})

export const downloadAndStoreInR2 = internalAction({
  args: {
    downloadUrls: v.array(v.string()),
    clipRecordId: v.id("clips"),
  },
  handler: async (ctx, args): Promise<Array<string>> => {
    const state = await ctx.runQuery(internal.clipActions.getDownloadState, {
      clipRecordId: args.clipRecordId,
    })
    if (!state || !["downloading", "ready"].includes(state.status))
      throw new Error("Clip is no longer active")
    if (state.r2Keys.length === args.downloadUrls.length) return state.r2Keys
    // Download and store concurrently, preserving array order. Wait for every
    // operation to settle so cleanup cannot miss an upload that finishes after
    // an early Promise.all rejection.
    const results = await Promise.allSettled(
      args.downloadUrls.map(async (url, index) => {
        const key = `clips/${args.clipRecordId}/${index}.mp4`
        // r2.store rejects existing metadata. Recover a completed upload from
        // an interrupted action instead of storing or downloading it again.
        if (await r2.getMetadata(ctx, key)) return key
        const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
        if (!response.ok) {
          throw new Error(`Failed to download clip from Twitch: ${response.status}`)
        }

        const maxBytes = 100 * 1024 * 1024
        const contentLength = Number(response.headers.get("content-length"))
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
          await response.body?.cancel()
          throw new Error("Clip download exceeds the 100 MB limit")
        }
        if (!response.body) throw new Error("Clip download has no response body")
        const reader = response.body.getReader()
        const chunks: Array<ArrayBuffer> = []
        let totalBytes = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          totalBytes += value.byteLength
          if (totalBytes > maxBytes) {
            await reader.cancel()
            throw new Error("Clip download exceeds the 100 MB limit")
          }
          const chunk = new Uint8Array(value.byteLength)
          chunk.set(value)
          chunks.push(chunk.buffer)
        }
        const blob = new Blob(chunks, { type: "video/mp4" })

        // Store in R2
        // If the earlier attempt stored bytes but never synced metadata, the
        // same key is safe to overwrite without accumulating random objects.
        await r2.store(ctx, blob, {
          key,
          type: "video/mp4",
        })
        return key
      }),
    )
    const keys = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []))
    const failure = results.find((result) => result.status === "rejected")
    if (failure?.status === "rejected") {
      // R2 deletion is queued, not awaited to completion. A failed attempt must
      // not enqueue deletion of keys the next attempt will reuse. Keep them
      // until terminal Workflow cleanup, unless the record is already inactive.
      const current = await ctx.runQuery(internal.clipActions.getDownloadState, {
        clipRecordId: args.clipRecordId,
      })
      if (!current || !["downloading", "ready"].includes(current.status)) {
        await Promise.all(
          args.downloadUrls.map((_, index) =>
            r2.deleteObject(ctx, `clips/${args.clipRecordId}/${index}.mp4`),
          ),
        )
      }
      throw failure.reason
    }

    try {
      // Persist the keys before the workflow advances. If account deletion
      // removed the clip while this external action was storing files, the
      // mutation rejects and the catch below removes those now-orphaned files.
      await ctx.runMutation(internal.clipActions.attachClipFiles, {
        clipRecordId: args.clipRecordId,
        r2Keys: keys,
      })
    } catch (error) {
      const current = await ctx.runQuery(internal.clipActions.getDownloadState, {
        clipRecordId: args.clipRecordId,
      })
      if (!current || !["downloading", "ready"].includes(current.status)) {
        await Promise.all(keys.map((key) => r2.deleteObject(ctx, key)))
      }
      throw error
    }

    return keys
  },
})

export const getDownloadState = internalQuery({
  args: { clipRecordId: v.id("clips") },
  handler: async (ctx, { clipRecordId }) => {
    const clip = await ctx.db.get(clipRecordId)
    if (!clip) return null
    return {
      status: clip.status,
      r2Keys: clip.streams.flatMap((stream) => (stream.r2Key ? [stream.r2Key] : [])),
    }
  },
})

export const cleanupClipFiles = internalAction({
  args: { keys: v.array(v.string()) },
  returns: v.null(),
  handler: async (ctx, { keys }) => {
    await Promise.all(keys.map((key) => r2.deleteObject(ctx, key)))
    return null
  },
})

export const attachClipFiles = internalMutation({
  args: {
    clipRecordId: v.id("clips"),
    r2Keys: v.array(v.string()),
  },
  handler: async (ctx, { clipRecordId, r2Keys }) => {
    const clip = await ctx.db.get(clipRecordId)
    if (!clip || clip.status !== "downloading") throw new Error("Clip is no longer active")
    const streams = [...clip.streams]
    for (let index = 0; index < streams.length; index++) {
      if (r2Keys[index]) streams[index].r2Key = r2Keys[index]
    }
    await ctx.db.patch(clipRecordId, { streams })
  },
})

export const updateClipStatus = internalMutation({
  args: {
    clipRecordId: v.id("clips"),
    status: v.union(
      v.literal("creating"),
      v.literal("downloading"),
      v.literal("ready"),
      v.literal("failed"),
    ),
    clipIds: v.optional(v.array(v.string())),
    r2Keys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const patch: any = { status: args.status }

    const clip = await ctx.db.get(args.clipRecordId)
    if (!clip) throw new Error("Clip not found")

    if (args.clipIds || args.r2Keys) {
      const streams = [...clip.streams]
      for (let i = 0; i < streams.length; i++) {
        if (args.clipIds && args.clipIds[i]) streams[i].clipId = args.clipIds[i]
        if (args.r2Keys && args.r2Keys[i]) streams[i].r2Key = args.r2Keys[i]
      }
      patch.streams = streams
    }

    await ctx.db.patch(args.clipRecordId, patch)
  },
})
