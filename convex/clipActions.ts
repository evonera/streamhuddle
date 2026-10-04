import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getTwitchAccessToken } from "./twitch";
import { v } from "convex/values";
import { r2 } from "./r2";

export const getClipUserId = internalQuery({
  args: { clipRecordId: v.id("clips") },
  handler: async (ctx, args) => {
    const clip = await ctx.db.get(args.clipRecordId);
    return clip ? { userId: clip.userId } : null;
  }
});

export const getTwitchTokenByUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const tokenRecord = await ctx.db
      .query("twitchUserTokens")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (!tokenRecord) throw new Error("No Twitch token connected for this user");
    return tokenRecord.accessToken;
  }
});

export const createTwitchClip = internalAction({
  args: {
    clipRecordId: v.id("clips"),
    broadcasterId: v.string(),
    duration: v.number(),
  },
  handler: async (ctx, args): Promise<string> => {
    const clip = await ctx.runQuery(internal.clipActions.getClipUserId, { clipRecordId: args.clipRecordId });
    if (!clip) throw new Error("Clip not found");
    const token: string = await ctx.runQuery(internal.clipActions.getTwitchTokenByUser, { userId: clip.userId });

    // 1. Create Clip (Note: Twitch POST /helix/clips only accepts broadcaster_id and has_delay.
    // Every clip created via Twitch API captures ~30 seconds by default. The user-selected duration
    // is applied during the client-side compositing/trimming stage in WebCodecsCompositor.)
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
  handler: async (ctx, args): Promise<Array<string>> => {
    if (args.clipIds.length === 0) return [];
    const token = await getTwitchAccessToken(ctx);
    
    // Split into chunks of 50 to avoid URL length limits
    const chunkSize = 50;
    const allUrls: Array<string> = [];
    
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
        
        if (!mp4Url.endsWith(".mp4")) {
          throw new Error(`Failed to extract MP4 URL from thumbnail for clip ${id}: ${clipData.thumbnail_url}`);
        }
        
        allUrls.push(mp4Url);
      }
    }
    
    return allUrls;
  },
});

export const downloadAndStoreInR2 = internalAction({
  args: {
    downloadUrls: v.array(v.string()),
    clipRecordId: v.id("clips"),
  },
  handler: async (ctx, args) => {
    // Download and store concurrently, preserving array order. Wait for every
    // operation to settle so cleanup cannot miss an upload that finishes after
    // an early Promise.all rejection.
    const results = await Promise.allSettled(
      args.downloadUrls.map(async (url) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download clip from Twitch: ${response.status}`);
        }

        const maxBytes = 100 * 1024 * 1024
        const contentLength = Number(response.headers.get("content-length"))
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
          await response.body?.cancel()
          throw new Error("Clip download exceeds the 100 MB limit")
        }
        if (!response.body) throw new Error("Clip download has no response body")
        const reader = response.body.getReader()
        const chunks: Array<ArrayBuffer> = []
        let totalBytes = 0
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          totalBytes += value.byteLength
          if (totalBytes > maxBytes) {
            await reader.cancel()
            throw new Error("Clip download exceeds the 100 MB limit")
          }
          const chunk = new Uint8Array(value.byteLength)
          chunk.set(value)
          chunks.push(chunk.buffer)
        }
        const blob = new Blob(chunks, { type: "video/mp4" })
        
        // Store in R2
        const key = `clips/${crypto.randomUUID()}.mp4`;
        await r2.store(ctx, blob, {
            key,
            type: "video/mp4"
        });
        return key
        })
    )
    const keys = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : [])
    const failure = results.find((result) => result.status === "rejected")
    if (failure?.status === "rejected") {
      await Promise.all(keys.map((key) => r2.deleteObject(ctx, key)))
      throw failure.reason
    }

    try {
      // Persist the keys before the workflow advances. If account deletion
      // removed the clip while this external action was storing files, the
      // mutation rejects and the catch below removes those now-orphaned files.
      await ctx.runMutation(internal.clipActions.attachClipFiles, {
        clipRecordId: args.clipRecordId,
        r2Keys: keys,
      })
    } catch (error) {
      await Promise.all(keys.map((key) => r2.deleteObject(ctx, key)))
      throw error
    }

    return keys;
  },
});

export const attachClipFiles = internalMutation({
  args: {
    clipRecordId: v.id("clips"),
    r2Keys: v.array(v.string()),
  },
  handler: async (ctx, { clipRecordId, r2Keys }) => {
    const clip = await ctx.db.get(clipRecordId)
    if (!clip || clip.status !== "downloading") throw new Error("Clip is no longer active")
    const streams = [...clip.streams]
    for (let index = 0; index < streams.length; index++) {
      if (r2Keys[index]) streams[index].r2Key = r2Keys[index]
    }
    await ctx.db.patch(clipRecordId, { streams })
  },
})

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
