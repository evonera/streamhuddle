import { v } from "convex/values"

import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"
import { httpAction, internalMutation } from "./_generated/server"
import type { ActionCtx } from "./_generated/server"
import { consumeLimit } from "./rateLimit"
import { emptyStreamerData, streamerDataValidator } from "./streamerData"
import type { StreamerData } from "./streamerData"
import { getTwitchAccessToken } from "./twitch"

type Reservation =
  | { kind: "cached"; data: StreamerData }
  | { kind: "limited"; retryAfter: number }
  | { kind: "busy" }
  | { kind: "fetch"; cacheId: Id<"streamerProfiles"> }

export const reserve = internalMutation({
  args: {
    username: v.string(),
    clientIp: v.string(),
    lease: v.string(),
    // Set by the trusted app relay when it re-polls after a 202; the first
    // attempt of that page load already paid for this read.
    repoll: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<Reservation> => {
    if (!args.repoll) {
      const limit = await consumeLimit(ctx, "streamerRead", args.clientIp)
      if (!limit.ok) return { kind: "limited", retryAfter: limit.retryAfter ?? 60_000 }
    }
    const username = args.username.toLowerCase()
    const cached = await ctx.db
      .query("streamerProfiles")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique()
    const now = Date.now()
    if (cached?.data && cached.expiresAt > now) return { kind: "cached", data: cached.data }
    const stale = cached?.data?.status === "ok" && cached.purgeAt > now ? cached.data : null
    if (cached?.leaseExpiresAt && cached.leaseExpiresAt > now) {
      return stale ? { kind: "cached", data: stale } : { kind: "busy" }
    }
    const provider = await consumeLimit(ctx, "streamerProvider", undefined, 4)
    if (!provider.ok)
      return stale
        ? { kind: "cached", data: stale }
        : { kind: "limited", retryAfter: provider.retryAfter ?? 60_000 }
    const fields = { lease: args.lease, leaseExpiresAt: now + 60_000, purgeAt: now + 10 * 60_000 }
    const cacheId =
      cached?._id ??
      (await ctx.db.insert("streamerProfiles", { username, expiresAt: 0, ...fields }))
    if (cached) await ctx.db.patch(cacheId, fields)
    return { kind: "fetch", cacheId }
  },
})

export const complete = internalMutation({
  args: { cacheId: v.id("streamerProfiles"), lease: v.string(), data: streamerDataValidator },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cached = await ctx.db.get(args.cacheId)
    if (!cached || cached.lease !== args.lease) return null
    const data =
      args.data.status === "unavailable" && cached.data?.status === "ok" ? cached.data : args.data
    const ttl =
      data.status === "not-found" ? 60_000 : data.status === "unavailable" ? 2_000 : 15_000
    await ctx.db.patch(cached._id, {
      data,
      expiresAt: Date.now() + ttl,
      lease: undefined,
      leaseExpiresAt: undefined,
    })
    return null
  },
})

type TwitchUser = {
  id: string
  login: string
  display_name: string
  profile_image_url: string
  offline_image_url: string
  description: string
  view_count?: number
}
type TwitchStream = {
  title: string
  game_name: string
  viewer_count: number
  started_at: string
  thumbnail_url: string
  tags?: Array<string>
}
type TwitchChannel = { title: string; game_name: string; broadcaster_language: string }
type TwitchClip = StreamerData["clips"][number]

async function fetchProfile(ctx: ActionCtx, username: string): Promise<StreamerData> {
  const token = await getTwitchAccessToken(ctx)
  const twitchFetch = async <T>(path: string): Promise<{ data: Array<T> }> => {
    const response = await fetch(`https://api.twitch.tv/helix${path}`, {
      signal: AbortSignal.timeout(8_000),
      headers: { "Client-ID": process.env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${token}` },
    })
    if (!response.ok) throw new Error(`Twitch API error: ${response.status}`)
    return response.json()
  }
  const users = await twitchFetch<TwitchUser>(`/users?login=${encodeURIComponent(username)}`)
  const user = users.data[0]
  if (!user) return emptyStreamerData("not-found")
  const id = encodeURIComponent(user.id)
  const [streams, channels, clips] = await Promise.allSettled([
    twitchFetch<TwitchStream>(`/streams?user_id=${id}`),
    twitchFetch<TwitchChannel>(`/channels?broadcaster_id=${id}`),
    twitchFetch<TwitchClip>(`/clips?broadcaster_id=${id}&first=6`),
  ])
  const stream = streams.status === "fulfilled" ? streams.value.data[0] : null
  const channel = channels.status === "fulfilled" ? channels.value.data[0] : null
  return {
    user: {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      profileImageUrl: user.profile_image_url,
      offlineImageUrl: user.offline_image_url,
      description: user.description,
      viewCount: user.view_count ?? 0,
    },
    stream: stream
      ? {
          title: stream.title,
          gameName: stream.game_name,
          viewerCount: stream.viewer_count,
          startedAt: stream.started_at,
          thumbnailUrl: stream.thumbnail_url.replace("{width}", "640").replace("{height}", "360"),
          tags: stream.tags ?? [],
        }
      : null,
    channel: {
      gameName: channel?.game_name,
      title: channel?.title,
      language: channel?.broadcaster_language,
    },
    clips:
      clips.status === "fulfilled"
        ? clips.value.data.slice(0, 6).map((clip) => ({
            id: clip.id,
            url: clip.url,
            title: clip.title,
            thumbnail_url: clip.thumbnail_url,
            duration: clip.duration,
            view_count: clip.view_count,
            game_id: clip.game_id,
          }))
        : [],
    status: "ok",
    partialError: [streams, channels, clips].some((result) => result.status === "rejected"),
    streamUnavailable: streams.status === "rejected",
  }
}

export const getProfile = httpAction(async (ctx, request) => {
  const secret = process.env.AUTH_PROXY_SECRET
  if (!secret) return new Response("Server proxy is not configured", { status: 503 })
  if (request.headers.get("x-streamhuddle-auth-proxy") !== secret)
    return new Response("Unauthorized", { status: 401 })
  const username = new URL(request.url).searchParams.get("username") ?? ""
  if (!/^[a-zA-Z0-9_]{1,25}$/.test(username)) return Response.json(emptyStreamerData("not-found"))
  const lease = crypto.randomUUID()
  const reservation = await ctx.runMutation(internal.streamerProfiles.reserve, {
    username,
    clientIp: request.headers.get("x-streamhuddle-client-ip") ?? "0.0.0.0",
    lease,
    // Only reachable with the proxy secret checked above, so callers can't forge it.
    repoll: request.headers.get("x-streamhuddle-repoll") === "1",
  })
  if (reservation.kind === "limited")
    return Response.json(emptyStreamerData("rate-limited"), {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(reservation.retryAfter / 1000)) },
    })
  if (reservation.kind === "busy")
    return new Response(null, { status: 202, headers: { "Retry-After": "1" } })
  if (reservation.kind === "cached") return Response.json(reservation.data)
  let data: StreamerData
  try {
    data = await fetchProfile(ctx, username.toLowerCase())
  } catch (error) {
    console.error("Twitch profile fetch failed", error)
    data = emptyStreamerData("unavailable")
  }
  await ctx.runMutation(internal.streamerProfiles.complete, {
    cacheId: reservation.cacheId,
    lease,
    data,
  })
  return Response.json(data)
})

export const cleanup = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("streamerProfiles")
      .withIndex("by_purgeAt", (q) => q.lt("purgeAt", Date.now()))
      .take(100)
    for (const entry of expired) await ctx.db.delete(entry._id)
    if (expired.length === 100)
      await ctx.scheduler.runAfter(0, internal.streamerProfiles.cleanup, {})
    return null
  },
})
