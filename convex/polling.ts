import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id, Doc } from "./_generated/dataModel";

export const pollAllPlatforms = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // 1. Get all creators from active events
    const activeCreators = await ctx.runQuery(internal.polling.getActiveCreators);
    if (activeCreators.length === 0) return null;

    // 2. Filter by platform
    const twitchCreators = activeCreators.filter(c => c.platform === "twitch");
    const kickCreators = activeCreators.filter(c => c.platform === "kick");

    const updates: { creatorId: Id<"creators">; isLive: boolean; viewerCount?: number; streamTitle?: string }[] = [];

    // 3. Poll Twitch
    if (twitchCreators.length > 0) {
      const logins = twitchCreators.map(c => c.username);
      const streams = await ctx.runAction(internal.twitch.fetchTwitchStreams, { logins });
      
      const streamMap = new Map(streams.map((s: any) => [s.user_login.toLowerCase(), s]));

      for (const creator of twitchCreators) {
        const stream = streamMap.get(creator.username.toLowerCase());
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
      // Note: Kick blocks serverless IPs via Cloudflare. 
      // If this fails consistently with 403, route through a proxy like ZenRows.
      const proxyUrl = process.env.KICK_PROXY_URL; // Optional proxy for Cloudflare bypass
      
      const kickPromises = kickCreators.map(async (creator) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const url = proxyUrl ? `${proxyUrl}/api/v2/channels/${creator.username}` : `https://kick.com/api/v2/channels/${creator.username}`;
          
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          
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
          console.warn(`Kick polling failed for ${creator.username}`, e);
          // Graceful degradation: skip updating if Kick API fails
        }
      });
      await Promise.allSettled(kickPromises);
    }

    // 5. Update Cache via single internal mutation
    await ctx.runMutation(internal.polling.commitLiveStatuses, { updates });
    return null;
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Batch process: 
    // 1. We update the 'creators' table for O(1) reads.
    // 2. We also update 'liveStatusCache' for backward compatibility.
    
    // Fetch all existing live statuses in parallel
    const existingStatuses = await Promise.all(
      args.updates.map(u => 
        ctx.db.query("liveStatusCache")
          .withIndex("by_creator", q => q.eq("creatorId", u.creatorId))
          .first()
      )
    );
    
    const existingMap = new Map(existingStatuses.filter(Boolean).map(s => [s!.creatorId, s]));

    for (const update of args.updates) {
      // 1. Update creators table (Denormalized)
      await ctx.db.patch(update.creatorId, {
        isLive: update.isLive,
        viewerCount: update.viewerCount,
        streamTitle: update.streamTitle,
      });
      
      // 2. Update legacy cache
      const existing = existingMap.get(update.creatorId);
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
    return null;
  }
});

export const getActiveCreators = internalQuery({
  args: {},
  returns: v.array(v.object({
    _id: v.id("creators"),
    _creationTime: v.number(),
    platform: v.string(),
    username: v.string(),
    platformId: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    offlineImageUrl: v.optional(v.string()),
    country: v.optional(v.string()),
    language: v.optional(v.string()),
  })),
  handler: async (ctx) => {
    // 1. Efficiently query active events
    const events = await ctx.db.query("events")
      .withIndex("by_active", q => q.eq("isActive", true))
      .collect();
      
    if (events.length === 0) return [];
    
    // 2. Query roster for those events efficiently
    const activeRosters = await Promise.all(
      events.map(e => 
        ctx.db.query("roster").withIndex("by_event", q => q.eq("eventId", e._id)).collect()
      )
    );
    
    const creatorIds = new Set<string>();
    activeRosters.flat().forEach(r => creatorIds.add(r.creatorId));
    
    // 3. Parallel fetch creators
    const creatorPromises = Array.from(creatorIds).map(id => ctx.db.get(id as Id<"creators">));
    const creators = await Promise.all(creatorPromises);
    
    return creators.filter(Boolean) as Doc<"creators">[];
  }
});
