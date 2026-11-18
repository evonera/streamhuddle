import { v } from "convex/values"
import type { Infer } from "convex/values"

export const streamerDataValidator = v.object({
  user: v.union(
    v.null(),
    v.object({
      id: v.string(),
      login: v.string(),
      displayName: v.string(),
      profileImageUrl: v.string(),
      offlineImageUrl: v.string(),
      description: v.string(),
      viewCount: v.number(),
    }),
  ),
  stream: v.union(
    v.null(),
    v.object({
      title: v.string(),
      gameName: v.string(),
      viewerCount: v.number(),
      startedAt: v.string(),
      thumbnailUrl: v.string(),
      tags: v.array(v.string()),
    }),
  ),
  channel: v.union(
    v.null(),
    v.object({
      gameName: v.optional(v.string()),
      title: v.optional(v.string()),
      language: v.optional(v.string()),
    }),
  ),
  clips: v.array(
    v.object({
      id: v.string(),
      url: v.string(),
      title: v.string(),
      thumbnail_url: v.string(),
      duration: v.number(),
      view_count: v.number(),
      game_id: v.string(),
    }),
  ),
  status: v.union(
    v.literal("ok"),
    v.literal("not-found"),
    v.literal("unavailable"),
    v.literal("rate-limited"),
  ),
  partialError: v.boolean(),
  streamUnavailable: v.boolean(),
})
export type StreamerData = Infer<typeof streamerDataValidator>

export function emptyStreamerData(status: StreamerData["status"]): StreamerData {
  return {
    user: null,
    stream: null,
    channel: null,
    clips: [],
    status,
    partialError: false,
    streamUnavailable: false,
  }
}
