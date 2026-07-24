import { v } from "convex/values"
import { query } from "./_generated/server"
import { authMutation, optionalAuthQuery } from "./functions"
import { rateLimitWithThrow } from "./rateLimit"

// ============================================================================
// Public Queries (no auth required — viewers see the queue without logging in)
// ============================================================================

/**
 * Get the live clip queue for a specific creator's streamer page.
 * Returns approved clips sorted by upvotes (most popular first).
 * Used by ClipQueueWidget on /streamer/$username.
 */
export const getLiveQueue = optionalAuthQuery({
  args: { creatorId: v.id("creators") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("clipQueue")
      .withIndex("by_creator_and_status", (q) =>
        q.eq("creatorId", args.creatorId).eq("status", "approved")
      )
      .collect()
    
    const sorted = items.sort((a, b) => b.upvotes - a.upvotes)

    if (!ctx.user) {
      return sorted.map(item => ({ ...item, hasVoted: false }))
    }

    return await Promise.all(
      sorted.map(async (item) => {
        const vote = await ctx.db
          .query("clipQueueVotes")
          .withIndex("by_item_and_user", (q) =>
            q.eq("queueItemId", item._id).eq("userId", ctx.user!._id)
          )
          .first()
        return { ...item, hasVoted: !!vote }
      })
    )
  },
})

// ============================================================================
// Authenticated Mutations
// ============================================================================

/**
 * Submit a clip to a streamer's queue.
 * Deduplicates by URL: if the same clip URL already exists and is active,
 * it boosts the upvote count instead of creating a duplicate entry.
 */
export const submitClip = authMutation({
  args: {
    creatorId: v.id("creators"),
    clipUrl: v.string(),
    title: v.string(),
    thumbnailUrl: v.optional(v.string()),
    submitterTwitchName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate clip URL (Prevent stored XSS)
    const isValidUrl = args.clipUrl.startsWith("https://clips.twitch.tv/") || /^https:\/\/(www\.)?twitch\.tv\/.*\/clip\//.test(args.clipUrl);
    if (!isValidUrl) {
      throw new Error("Invalid Twitch clip URL");
    }

    // Determine correct submitter name
    const creator = await ctx.db.get(args.creatorId)
    const isStreamer = creator && (
      ctx.user.username?.toLowerCase() === creator.username.toLowerCase() ||
      // @ts-ignore - BetterAuth type fallback
      ctx.user.displayUsername?.toLowerCase() === creator.username.toLowerCase() ||
      ctx.user.role === "admin"
    )
    
    const submitterName = (isStreamer && args.submitterTwitchName) 
      ? args.submitterTwitchName 
      : (ctx.user.name ?? "Anonymous")

    // Rate limit: prevent chat spam from draining Convex bill
    // If streamer is proxying for chat, use the chatter's name for the rate limit key
    const rateLimitKey = (isStreamer && args.submitterTwitchName) 
      ? `chat_${args.submitterTwitchName}` 
      : ctx.user._id.toString();
    
    await rateLimitWithThrow(ctx, "userAction", rateLimitKey)

    // Dedup: same URL on same creator → boost upvote instead of duplicate
    const existing = await ctx.db
      .query("clipQueue")
      .withIndex("by_creator_and_url", (q) =>
        q.eq("creatorId", args.creatorId).eq("clipUrl", args.clipUrl)
      )
      .first()

    if (existing && existing.status !== "played") {
      await ctx.db.patch(existing._id, { upvotes: existing.upvotes + 1 })
      return existing._id
    }



    return await ctx.db.insert("clipQueue", {
      creatorId: args.creatorId,
      submitterId: ctx.user._id,
      submitterName,
      clipUrl: args.clipUrl,
      title: args.title,
      thumbnailUrl: args.thumbnailUrl,
      status: "approved",
      upvotes: 0,
      createdAt: Date.now(),
    })
  },
})

/**
 * Toggle upvote on a queue item. One vote per user.
 * If already voted, removes the vote (toggle behavior).
 */
export const upvoteClip = authMutation({
  args: { queueItemId: v.id("clipQueue") },
  handler: async (ctx, args) => {
    await rateLimitWithThrow(ctx, "userAction", ctx.user._id.toString())

    const item = await ctx.db.get(args.queueItemId)
    if (!item) throw new Error("Queue item not found")

    const existing = await ctx.db
      .query("clipQueueVotes")
      .withIndex("by_item_and_user", (q) =>
        q.eq("queueItemId", args.queueItemId).eq("userId", ctx.user._id)
      )
      .first()

    if (existing) {
      // Remove vote (toggle off)
      await ctx.db.delete(existing._id)
      await ctx.db.patch(args.queueItemId, {
        upvotes: Math.max(0, item.upvotes - 1),
      })
      return { voted: false }
    } else {
      // Add vote
      await ctx.db.insert("clipQueueVotes", {
        queueItemId: args.queueItemId,
        userId: ctx.user._id,
      })
      await ctx.db.patch(args.queueItemId, {
        upvotes: item.upvotes + 1,
      })
      return { voted: true }
    }
  },
})

/**
 * Set the status of a queue item (for streamer moderation controls).
 * Used to mark clips as "playing", "played", or moderate them.
 */
export const setClipStatus = authMutation({
  args: {
    queueItemId: v.id("clipQueue"),
    status: v.union(
      v.literal("playing"),
      v.literal("played"),
      v.literal("approved"),
      v.literal("pending")
    ),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.queueItemId)
    if (!item) throw new Error("Queue item not found")

    const creator = await ctx.db.get(item.creatorId)
    if (!creator) throw new Error("Creator not found")

    const isStreamer = 
      ctx.user.username?.toLowerCase() === creator.username.toLowerCase() ||
      ctx.user.displayUsername?.toLowerCase() === creator.username.toLowerCase() ||
      ctx.user.role === "admin"

    if (!isStreamer) {
      throw new Error("Unauthorized: Only the streamer can moderate their queue")
    }

    await ctx.db.patch(args.queueItemId, { status: args.status })
  },
})
