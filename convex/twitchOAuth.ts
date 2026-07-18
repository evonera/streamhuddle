import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { requireAuthenticatedUser } from "./auth";

export const saveTwitchToken = mutation({
  args: {
    twitchUserId: v.string(),
    twitchUsername: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    scopes: v.string(),
    expiresIn: v.number(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.secret !== process.env.TWITCH_CLIENT_SECRET) {
      throw new Error("Unauthorized");
    }

    const user = await requireAuthenticatedUser(ctx);
    const userId = user._id;

    // Check if user already has a token
    const existing = await ctx.db
      .query("twitchUserTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const expiresAt = Date.now() + args.expiresIn * 1000;

    if (existing) {
      await ctx.db.patch(existing._id, {
        twitchUserId: args.twitchUserId,
        twitchUsername: args.twitchUsername,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        scopes: args.scopes,
        expiresAt,
      });
    } else {
      await ctx.db.insert("twitchUserTokens", {
        userId: userId,
        twitchUserId: args.twitchUserId,
        twitchUsername: args.twitchUsername,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        scopes: args.scopes,
        expiresAt,
      });
    }
  },
});

export const getTwitchToken = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);
    const token = await ctx.db
      .query("twitchUserTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!token) return null;

    return {
      twitchUserId: token.twitchUserId,
      twitchUsername: token.twitchUsername,
    };
  },
});

export const disconnectTwitch = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);
    const existing = await ctx.db
      .query("twitchUserTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
