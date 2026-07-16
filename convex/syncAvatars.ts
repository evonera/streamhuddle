import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const syncTwitchAvatars = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // 1. Get all creators
    const creators = await ctx.runQuery(internal.syncAvatars.getAllCreators);
    const twitchCreators = creators.filter(c => c.platform === "twitch");
    
    if (twitchCreators.length === 0) return null;

    const logins = twitchCreators.map(c => c.username);
    
    // 2. Fetch from Twitch (using the existing twitch.fetchTwitchUsers)
    try {
      const users = await ctx.runAction(internal.twitch.fetchTwitchUsers, { usernames: logins });
      
      const userMap = new Map(users.map((u: any) => [u.login.toLowerCase(), u]));
      
      const updates = [];
      for (const creator of twitchCreators) {
        const user = userMap.get(creator.username.toLowerCase());
        if (user && user.profile_image_url) {
          updates.push({
            id: creator._id,
            avatarUrl: user.profile_image_url
          });
        }
      }
      
      // 3. Commit updates
      if (updates.length > 0) {
        await ctx.runMutation(internal.syncAvatars.commitAvatars, { updates });
        console.log(`Updated avatars for ${updates.length} creators`);
      }
    } catch (e) {
      console.error("Failed to sync avatars", e);
    }
    
    return null;
  }
});

export const getAllCreators = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("creators").collect();
  }
});

export const commitAvatars = internalMutation({
  args: {
    updates: v.array(v.object({
      id: v.id("creators"),
      avatarUrl: v.string()
    }))
  },
  handler: async (ctx, args) => {
    for (const update of args.updates) {
      await ctx.db.patch(update.id, { avatarUrl: update.avatarUrl });
    }
  }
});
