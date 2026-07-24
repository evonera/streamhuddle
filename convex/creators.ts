import { v } from "convex/values"
import { query } from "./_generated/server"

/**
 * Look up a creator by platform and username.
 * Uses the by_platform_and_username index for O(1) lookup.
 */
export const getByUsername = query({
  args: {
    platform: v.union(
      v.literal("twitch"),
      v.literal("youtube"),
      v.literal("kick"),
      v.literal("custom")
    ),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("creators")
      .withIndex("by_platform_and_username", (q) =>
        q.eq("platform", args.platform).eq("username", args.username)
      )
      .first()
  },
})
