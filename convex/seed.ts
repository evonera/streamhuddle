import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const seedSUData = action({
  args: {
    creators: v.array(v.object({
      username: v.string(),
      platform: v.string(),
      category: v.string(),
    }))
  },
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
  handler: async (ctx, args) => {
    // Create SU Event
    const eventId = await ctx.db.insert("events", {
      name: "Streamer University",
      slug: "streamer-university",
      isActive: true,
    });

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

      await ctx.db.insert("roster", {
        eventId,
        creatorId,
        category: c.category,
      });
    }
  }
});
