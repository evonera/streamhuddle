import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getTwitchAccessToken } from "./twitch";
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

export const getClipDownloadUrlsViaThumbnail = internalAction({
  args: {
    clipIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<string[]> => {
    if (args.clipIds.length === 0) return [];
    const token = await getTwitchAccessToken(ctx);
    
    // Split into chunks of 50 to avoid URL length limits
    const chunkSize = 50;
    const allUrls: string[] = [];
    
    for (let i = 0; i < args.clipIds.length; i += chunkSize) {
      const chunk = args.clipIds.slice(i, i + chunkSize);
      const url = new URL("https://api.twitch.tv/helix/clips");
      chunk.forEach(id => url.searchParams.append("id", id));

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Client-Id": process.env.TWITCH_CLIENT_ID!,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Twitch Get Clips Error:", errorText);
        throw new Error(`Failed to get clips metadata: ${response.status}`);
      }

      const data = await response.json();
      
      // Order the URLs to match the input clipIds array
      for (const id of chunk) {
        const clipData = data.data.find((c: any) => c.id === id);
        if (!clipData || !clipData.thumbnail_url) {
          throw new Error(`Clip metadata or thumbnail not found for ${id}`);
        }
        // Thumbnail URL trick: replace -preview...jpg with .mp4
        const mp4Url = clipData.thumbnail_url.replace(/-preview-.*\.jpg$/, ".mp4");
        allUrls.push(mp4Url);
      }
    }
    
    return allUrls;
  },
});

export const downloadAndStoreInR2 = internalAction({
  args: {
    downloadUrls: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const keys: string[] = [];

    // Download and store concurrently
    await Promise.all(
      args.downloadUrls.map(async (url) => {
        const response = await fetch(url);
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
        keys.push(key);
      })
    );

    return keys;
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
    clipIds: v.optional(v.array(v.string())),
    r2Keys: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const patch: any = { status: args.status };
    
    const clip = await ctx.db.get(args.clipRecordId);
    if (!clip) throw new Error("Clip not found");

    if (args.clipIds || args.r2Keys) {
        const streams = [...clip.streams];
        for (let i = 0; i < streams.length; i++) {
            if (args.clipIds && args.clipIds[i]) streams[i].clipId = args.clipIds[i];
            if (args.r2Keys && args.r2Keys[i]) streams[i].r2Key = args.r2Keys[i];
        }
        patch.streams = streams;
    }

    await ctx.db.patch(args.clipRecordId, patch);
  },
});
