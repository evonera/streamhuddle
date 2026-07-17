import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { r2 } from "./r2";

export const getTwitchTokenByBroadcaster = internalQuery({
  args: { broadcasterId: v.string() },
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db
      .query("twitchUserTokens")
      .withIndex("by_twitchUserId", (q) => q.eq("twitchUserId", args.broadcasterId))
      .first();
    if (!tokenRecord) throw new Error("No token for this broadcaster");
    return tokenRecord.accessToken;
  }
});

export const createTwitchClip = internalAction({
  args: {
    broadcasterId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const token: string = await ctx.runQuery(internal.clipActions.getTwitchTokenByBroadcaster, { broadcasterId: args.broadcasterId });

    // 1. Create Clip
    const response = await fetch(
      `https://api.twitch.tv/helix/clips?broadcaster_id=${args.broadcasterId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID!,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twitch Create Clip Error:", errorText);
      throw new Error(`Failed to create clip: ${response.status}`);
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      throw new Error("Twitch returned no clip data — broadcaster may be offline or rate-limited");
    }
    return data.data[0].id as string; // The clip ID
  },
});

export const getClipDownloadUrl = internalAction({
  args: {
    clipId: v.string(),
    broadcasterId: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    const token: string = await ctx.runQuery(internal.clipActions.getTwitchTokenByBroadcaster, { broadcasterId: args.broadcasterId });
    const response: Response = await fetch(
      `https://api.twitch.tv/helix/clips/downloads?broadcaster_id=${args.broadcasterId}&editor_id=${args.broadcasterId}&clip_id=${args.clipId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID!,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twitch Get Clip Download Error:", errorText);
      throw new Error(`Failed to get clip download url: ${response.status}`);
    }

    const data = await response.json();
    const clipData = data.data.find((c: any) => c.clip_id === args.clipId);
    if (!clipData || !clipData.landscape_download_url) {
      throw new Error("Download URL not found in response");
    }

    return clipData.landscape_download_url as string;
  },
});

export const downloadAndStoreInR2 = internalAction({
  args: {
    downloadUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const response = await fetch(args.downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download clip from Twitch: ${response.status}`);
    }

    const blob = await response.blob();
    
    // Store in R2
    const key = `clips/${crypto.randomUUID()}.mp4`;
    await r2.store(ctx, blob, {
        key,
        type: "video/mp4"
    });

    return key;
  },
});

export const updateClipStatus = internalMutation({
  args: {
    clipRecordId: v.id("clips"),
    status: v.union(
      v.literal("creating"),
      v.literal("downloading"),
      v.literal("ready"),
      v.literal("failed")
    ),
    clipId: v.optional(v.string()),
    r2Key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const patch: any = { status: args.status };
    
    const clip = await ctx.db.get(args.clipRecordId);
    if (!clip) throw new Error("Clip not found");

    if (args.clipId || args.r2Key) {
        // Since we only do single-stream clips now, update the first stream in the array
        const streams = [...clip.streams];
        if (streams.length > 0) {
            if (args.clipId) streams[0].clipId = args.clipId;
            if (args.r2Key) streams[0].r2Key = args.r2Key;
            patch.streams = streams;
        }
    }

    await ctx.db.patch(args.clipRecordId, patch);
  },
});
