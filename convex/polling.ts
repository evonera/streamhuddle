import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

export const pollAllPlatforms = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Get all creators from active events
    const activeCreators = await ctx.runQuery(internal.polling.getActiveCreators) as any[];
    if (activeCreators.length === 0) return;

    // 2. Filter by platform
    const twitchCreators = activeCreators.filter((c: any) => c.platform === "twitch");
    const kickCreators = activeCreators.filter((c: any) => c.platform === "kick");

    const updates: { creatorId: Id<"creators">; isLive: boolean; viewerCount?: number; streamTitle?: string }[] = [];

    // 3. Poll Twitch
    if (twitchCreators.length > 0) {
      const logins = twitchCreators.map((c: any) => c.username);
      const streams = await ctx.runAction(internal.twitch.fetchTwitchStreams, { logins });
      
      const streamMap = new Map(streams.map((s: any) => [s.user_login.toLowerCase(), s]));

      for (const creator of twitchCreators) {
        const stream = streamMap.get(creator.username.toLowerCase()) as any;
        updates.push({
          creatorId: creator._id,
          isLive: !!stream,
          viewerCount: stream ? stream.viewer_count : undefined,
          streamTitle: stream ? stream.title : undefined,
        });
      }
    }

    // 4. Poll Kick (Individual REST API calls)
    if (kickCreators.length > 0) {
      // Unofficial Kick API requires individual fetching: https://kick.com/api/v2/channels/{username}
      // We will use Promise.allSettled to not fail the whole batch if one 404s/rate-limits.
      const kickPromises = kickCreators.map(async (creator: any) => {
        try {
          const res = await fetch(`https://kick.com/api/v2/channels/${creator.username}`);
          if (!res.ok) throw new Error(`Kick API error for ${creator.username}: ${res.status}`);
          const data = await res.json() as any;
          const livestream = data?.livestream;
          
          updates.push({
            creatorId: creator._id,
            isLive: !!livestream,
            viewerCount: livestream ? livestream.viewer_count : undefined,
            streamTitle: livestream ? livestream.session_title : undefined,
          });
        } catch (e) {
          console.warn(e);
          // Graceful degradation: skip updating if Kick API fails
        }
      });
      await Promise.allSettled(kickPromises);
    }

    // 5. Update Cache via single internal mutation
    await ctx.runMutation(internal.polling.commitLiveStatuses, { updates });
  }
});

export const commitLiveStatuses = internalMutation({
  args: {
    updates: v.array(v.object({
      creatorId: v.id("creators"),
      isLive: v.boolean(),
      viewerCount: v.optional(v.number()),
      streamTitle: v.optional(v.string()),
    }))
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const update of args.updates) {
      const existing = await ctx.db
        .query("liveStatusCache")
        .withIndex("by_creator", q => q.eq("creatorId", update.creatorId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          isLive: update.isLive,
          viewerCount: update.viewerCount,
          streamTitle: update.streamTitle,
          lastUpdated: now,
        });
      } else {
        await ctx.db.insert("liveStatusCache", {
          creatorId: update.creatorId,
          isLive: update.isLive,
          viewerCount: update.viewerCount,
          streamTitle: update.streamTitle,
          lastUpdated: now,
        });
      }
    }
  }
});

export const getActiveCreators = internalQuery({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").filter(q => q.eq(q.field("isActive"), true)).collect();
    const eventIds = new Set(events.map(e => e._id));

    const roster = await ctx.db.query("roster").collect();
    const activeRoster = roster.filter(r => eventIds.has(r.eventId));
    
    const creatorIds = new Set(activeRoster.map(r => r.creatorId));
    
    const creators = [];
    for (const id of creatorIds) {
      const c = await ctx.db.get(id);
      if (c) creators.push(c);
    }
    return creators;
  }
});
