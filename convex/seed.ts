import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import suData from "./su-seed-data.json";
export const seedSUData = internalAction({
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
    await ctx.runMutation(internal.seed.fixCategories, {});
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

    const existingCreators = await ctx.db.query("creators").collect();
    const creatorMap = new Map(existingCreators.map(c => [`${c.platform}:${c.username.toLowerCase()}`, c]));

    const existingRosters = eventId 
      ? await ctx.db.query("roster").withIndex("by_event", q => q.eq("eventId", eventId!)).collect()
      : [];
    const rosterSet = new Set(existingRosters.map(r => `${r.creatorId}:${r.category}`));

    for (const c of args.creators) {
      const key = `${c.platform}:${c.username.toLowerCase()}`;
      let existing = creatorMap.get(key);
      let creatorId = existing?._id;
      if (!creatorId) {
        creatorId = await ctx.db.insert("creators", {
          platform: c.platform as any,
          username: c.username,
          platformId: c.platformId,
          avatarUrl: c.avatarUrl,
          description: c.description,
          offlineImageUrl: c.offlineImageUrl,
          categories: [c.category],
        });
        creatorMap.set(key, { _id: creatorId, platform: c.platform, username: c.username } as any);
      }

      const rosterKey = `${creatorId}:${c.category}`;
      if (!rosterSet.has(rosterKey)) {
        await ctx.db.insert("roster", {
          eventId: eventId!,
          creatorId: creatorId!,
          category: c.category,
        });
        rosterSet.add(rosterKey);
      }
    }
    return null;
  }
});

export const triggerSeed = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx): Promise<any> => {
    return await ctx.runAction(internal.seed.seedSUData, { creators: suData as any });
  }
});

export const fixCategories = internalMutation({
  args: {},
  handler: async (ctx) => {
    const creators = await ctx.db.query("creators").collect();
    const allRosters = await ctx.db.query("roster").collect();
    const rostersByCreator = new Map<string, Set<string>>();
    
    for (const r of allRosters) {
      if (!rostersByCreator.has(r.creatorId)) {
        rostersByCreator.set(r.creatorId, new Set<string>());
      }
      rostersByCreator.get(r.creatorId)!.add(r.category);
    }

    for (const c of creators) {
      const categories: string[] = Array.from(rostersByCreator.get(c._id) || new Set<string>());
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
    // Idempotency check: don't insert if layout with same name and authId exists
    const existingLayout = await ctx.db
      .query("layouts")
      .withIndex("by_user", q => q.eq("authId", "system_premade"))
      .filter(q => q.eq(q.field("name"), args.name))
      .first();

    if (existingLayout) {
      return existingLayout._id;
    }

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
