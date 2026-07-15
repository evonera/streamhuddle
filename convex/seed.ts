import { action, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import suData from "./su-seed-data.json";
export const seedSUData = action({
  args: {
    creators: v.array(v.object({
      username: v.string(),
      platform: v.string(),
      category: v.string(),
    }))
  },
  returns: v.object({ success: v.boolean(), count: v.number() }),
  handler: async (ctx, args) => {
    const twitchUsernames = args.creators
      .filter(c => c.platform === "twitch")
      .map(c => c.username);
    
    // Fetch profile data from Twitch
    const twitchProfiles = await ctx.runAction(internal.twitch.fetchTwitchUsers, {
      usernames: twitchUsernames
    }) as any[];
    
    const profileMap = new Map<string, any>(twitchProfiles.map((p: any) => [p.login.toLowerCase(), p]));

    const enrichedCreators = args.creators.map((c: any) => {
      const profile = profileMap.get(c.username.toLowerCase());
      return {
        ...c,
        platformId: profile?.id,
        avatarUrl: profile?.profile_image_url,
        description: profile?.description,
        offlineImageUrl: profile?.offline_image_url,
      };
    });

    await ctx.runMutation(internal.seed.commitSeedData, { creators: enrichedCreators });
    return { success: true, count: enrichedCreators.length };
  }
});

export const commitSeedData = internalMutation({
  args: {
    creators: v.array(v.object({
      username: v.string(),
      platform: v.string(),
      category: v.string(),
      platformId: v.optional(v.string()),
      avatarUrl: v.optional(v.string()),
      description: v.optional(v.string()),
      offlineImageUrl: v.optional(v.string()),
    }))
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Create SU Event
    let event = await ctx.db.query("events").withIndex("by_slug", q => q.eq("slug", "streamer-university")).first();
    let eventId = event?._id;
    if (!eventId) {
      eventId = await ctx.db.insert("events", {
        name: "Streamer University",
        slug: "streamer-university",
        isActive: true,
      });
    }

    for (const c of args.creators) {
      const existing = await ctx.db
        .query("creators")
        .withIndex("by_platform_and_username", q => 
          q.eq("platform", c.platform as any).eq("username", c.username)
        )
        .first();
      
      let creatorId = existing?._id;
      if (!creatorId) {
        creatorId = await ctx.db.insert("creators", {
          platform: c.platform as any,
          username: c.username,
          platformId: c.platformId,
          avatarUrl: c.avatarUrl,
          description: c.description,
          offlineImageUrl: c.offlineImageUrl,
        });
      }

      const existingRoster = await ctx.db.query("roster")
        .withIndex("by_event", q => q.eq("eventId", eventId!))
        .filter(q => q.eq(q.field("creatorId"), creatorId!))
        .first();
      
      if (!existingRoster) {
        await ctx.db.insert("roster", {
          eventId: eventId!,
          creatorId: creatorId!,
          category: c.category,
        });
      }
    }
    return null;
  }
});

// @ts-ignore
export const triggerSeed = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx): Promise<any> => {
    return await ctx.runAction(api.seed.seedSUData, { creators: suData });
  }
});

export const fixCategories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const creators = await ctx.db.query("creators").collect();
    for (const c of creators) {
      const rosters = await ctx.db
        .query("roster")
        .withIndex("by_creator", (q) => q.eq("creatorId", c._id))
        .collect();
      const categories = Array.from(new Set(rosters.map((r) => r.category)));
      await ctx.db.patch(c._id, { categories });
    }
  },
});

export const seedPremadeLists = internalAction({
  args: {},
  handler: async (ctx) => {
    const lists = [
      {
        name: "The Esports Hub",
        views: 124500,
        authorName: "StreamHuddle Official",
        streamers: [
          { username: "tarik", platform: "twitch" },
          { username: "shroud", platform: "twitch" },
          { username: "s1mple", platform: "twitch" },
          { username: "scump", platform: "twitch" },
        ]
      },
      {
        name: "Just Chatting Legends",
        views: 312000,
        authorName: "StreamHuddle Official",
        streamers: [
          { username: "xQc", platform: "twitch" },
          { username: "KaiCenat", platform: "twitch" },
          { username: "HasanAbi", platform: "twitch" },
          { username: "pokimane", platform: "twitch" },
          { username: "caseoh_", platform: "twitch" },
          { username: "asmongold", platform: "twitch" }
        ]
      }
    ];

    for (const list of lists) {
      const enrichedStreamers = await ctx.runAction(internal.twitch.fetchTwitchUsers, {
        usernames: list.streamers.map(s => s.username)
      });
      
      const toInsert = list.streamers.map((s) => {
        const enriched = enrichedStreamers.find((e: any) => e.login.toLowerCase() === s.username.toLowerCase());
        return {
          ...s,
          platformId: enriched?.id,
          avatarUrl: enriched?.profile_image_url,
          description: enriched?.description,
          offlineImageUrl: enriched?.offline_image_url
        };
      });
      
      await ctx.runMutation(internal.seed.commitPremadeList, {
        name: list.name,
        views: list.views,
        authorName: list.authorName,
        creators: toInsert
      });
    }
  }
});

export const commitPremadeList = internalMutation({
  args: {
    name: v.string(),
    views: v.number(),
    authorName: v.string(),
    creators: v.array(v.any())
  },
  handler: async (ctx, args) => {
    const streams = [];
    const previewStreams = [];
    
    for (const c of args.creators) {
      const existing = await ctx.db
        .query("creators")
        .withIndex("by_platform_and_username", q => 
          q.eq("platform", c.platform).eq("username", c.username)
        )
        .first();
      
      let creatorId = existing?._id;
      if (!creatorId) {
        creatorId = await ctx.db.insert("creators", {
          platform: c.platform,
          username: c.username,
          platformId: c.platformId,
          avatarUrl: c.avatarUrl,
          description: c.description,
          offlineImageUrl: c.offlineImageUrl,
          categories: ["Premade"]
        });
      }
      
      streams.push({ creatorId, type: "stream" as const });
      if (previewStreams.length < 4) {
        previewStreams.push({ username: c.username, type: "stream" });
      }
    }
    
    await ctx.db.insert("layouts", {
      authId: "system_premade",
      name: args.name,
      views: args.views,
      authorName: args.authorName,
      previewStreams,
      streams
    });
  }
});
