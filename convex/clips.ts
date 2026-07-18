import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser } from "./auth";
import { internal } from "./_generated/api";
import { r2 } from "./r2";
import { workflow } from "./clipWorkflow";

export const createClipJob = mutation({
  args: {
    broadcasters: v.array(v.object({
      broadcasterId: v.string(),
      broadcasterName: v.string(),
    })),
    duration: v.number(),
    removeWatermark: v.boolean(),
    layout: v.union(
      v.literal("split-screen"),
      v.literal("sequential-ranking"),
      v.literal("9:16-vertical")
    ),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    
    // Server-side Pro enforcement
    if (args.removeWatermark && !user.isPro) {
      throw new Error("Pro subscription required to remove watermark");
    }

    // Get the user's Twitch token
    const tokenRecord = await ctx.db
      .query("twitchUserTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();

    if (!tokenRecord || tokenRecord.expiresAt < Date.now()) {
        throw new Error("Twitch authentication required or expired. Please connect Twitch.");
    }

    // We no longer check if tokenRecord.twitchUserId === args.broadcasterId
    // because we use the thumbnail trick to download the .mp4 without editor auth!

    // Create the clip record
    const clipRecordId = await ctx.db.insert("clips", {
        userId: user._id,
        status: "creating",
        streams: args.broadcasters.map(b => ({
            broadcasterId: b.broadcasterId,
            broadcasterName: b.broadcasterName,
        })),
        duration: args.duration,
        layout: args.layout,
        caption: args.caption,
        removeWatermark: args.removeWatermark,
        isMultiPov: args.broadcasters.length > 1,
        createdAt: Date.now(),
    });

    const workflowId = await workflow.start(ctx, internal.clipWorkflow.clipPipeline, {
        clipRecordId,
        broadcasterIds: args.broadcasters.map(b => b.broadcasterId),
        duration: args.duration,
    });
    
    await ctx.db.patch(clipRecordId, { workflowId });
    
    return clipRecordId;
  },
});

export const getClipStatus = query({
  args: {
    clipRecordId: v.id("clips"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const clip = await ctx.db.get(args.clipRecordId);
    
    if (!clip || clip.userId !== user._id) {
        throw new Error("Clip not found");
    }

    return clip;
  }
});

export const getClipVideoUrl = query({
  args: {
    clipRecordId: v.id("clips"),
    ts: v.optional(v.number()), // Cache buster
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const clip = await ctx.db.get(args.clipRecordId);
    
    if (!clip || clip.userId !== user._id) {
        throw new Error("Clip not found");
    }

    const urls: string[] = [];
    for (const stream of clip.streams) {
        if (stream.r2Key) {
            const url = await r2.getUrl(stream.r2Key);
            if (url) urls.push(url);
        }
    }
    
    return urls;
  }
});
