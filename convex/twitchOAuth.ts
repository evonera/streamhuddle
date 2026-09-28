import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { requireAuthenticatedUser } from "./auth";

export const saveTwitchToken = internalMutation({
  args: {
    twitchUserId: v.string(),
    twitchUsername: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    scopes: v.string(),
    expiresIn: v.number(),
    authId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("authId", q => q.eq("authId", args.authId)).unique();
    if (!user) throw new Error("Authenticated user not found");
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
