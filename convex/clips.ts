import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAuthenticatedUser } from "./auth";
import { internal } from "./_generated/api";
import { r2 } from "./r2";
import { workflow } from "./clipWorkflow";

export const createClipJob = mutation({
  args: {
    broadcasterId: v.string(),
    broadcasterName: v.string(),
    duration: v.number(),
    removeWatermark: v.boolean(),
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

    // Check if the user is clipping their own stream (required for download endpoint)
    if (tokenRecord.twitchUserId !== args.broadcasterId) {
        throw new Error("You can only clip your own stream due to Twitch API limitations.");
    }

    // Create the clip record
    const clipRecordId = await ctx.db.insert("clips", {
        userId: user._id,
        status: "creating",
        streams: [{
            broadcasterId: args.broadcasterId,
            broadcasterName: args.broadcasterName,
        }],
        duration: args.duration,
        isMultiPov: false,
        createdAt: Date.now(),
    });

    // Start the workflow asynchronously
    await workflow.start(ctx, internal.clipWorkflow.clipPipeline, {
        clipRecordId,
        broadcasterId: args.broadcasterId,
    }, { startAsync: true });
    
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
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const clip = await ctx.db.get(args.clipRecordId);
    
    if (!clip || clip.userId !== user._id) {
        throw new Error("Clip not found");
    }

    const r2Key = clip.streams[0]?.r2Key;
    if (!r2Key) return null;

    return await r2.getUrl(r2Key);
  }
});
