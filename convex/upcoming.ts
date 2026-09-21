import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getTwitchAccessToken } from "./twitch";

export type UpcomingDraft = {
  platform: "twitch" | "youtube" | "kick";
  username: string;
  title?: string;
  startsAt: number;
  url?: string;
  source: string;
};

// Twitch schedule segments, one call per broadcaster (Helix has no batch
// schedule endpoint). Capped so the hourly cron stays cheap.
export const fetchTwitchSchedules = internalAction({
  args: {
    broadcasters: v.array(v.object({
      creatorId: v.id("creators"),
      broadcasterId: v.string(),
      username: v.string(),
    })),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (args.broadcasters.length === 0) return [];
    let token: string;
    try {
      token = await getTwitchAccessToken(ctx);
    } catch (e) {
      console.warn("Skipping Twitch schedule poll (missing TWITCH_CLIENT_ID/SECRET).");
      return [];
    }
    const clientId = process.env.TWITCH_CLIENT_ID;
    const now = Date.now();
    const collected: any[] = [];

    // Cap broadcasters per run: schedule data changes slowly (hourly cron).
    for (const b of args.broadcasters.slice(0, 60)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const url = new URL("https://api.twitch.tv/helix/schedule");
        url.searchParams.set("broadcaster_id", b.broadcasterId);
        url.searchParams.set("first", "10");
        // Only future segments matter.
        url.searchParams.set("start_time", new Date(now).toISOString());
        const res = await fetch(url.toString(), {
          signal: controller.signal,
          headers: { "Client-ID": clientId!, "Authorization": `Bearer ${token}` },
        });
        clearTimeout(timeoutId);
        if (!res.ok) continue; // 404 = no schedule published; skip quietly
        const data = (await res.json()) as { data?: { segments?: any[] } };
        for (const seg of data.data?.segments ?? []) {
          const startsAt = Date.parse(seg.start_time);
          if (!Number.isFinite(startsAt) || startsAt <= now) continue;
          collected.push({
            creatorId: b.creatorId,
            platform: "twitch",
            username: b.username,
            title: seg.title ?? undefined,
            startsAt,
            url: `https://twitch.tv/${b.username}`,
            source: "twitch-schedule",
          });
        }
      } catch (e) {
        console.warn(`Twitch schedule fetch failed for ${b.username}`, e);
      }
    }
    return collected;
  },
});

// YouTube upcoming streams. STUBBED until YOUTUBE_API_KEY is configured:
// without a key this returns [] and the poll keeps working on Twitch data.
export const fetchYoutubeUpcoming = internalAction({
  args: {
    channels: v.array(v.object({
      creatorId: v.id("creators"),
      channelId: v.string(),
      username: v.string(),
    })),
  },
  returns: v.array(v.any()),
  handler: async (_ctx, args) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.info("Skipping YouTube upcoming poll (YOUTUBE_API_KEY not set).");
      return [];
    }
    if (args.channels.length === 0) return [];
    const now = Date.now();
    const collected: any[] = [];
    for (const c of args.channels.slice(0, 30)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        const url = new URL("https://www.googleapis.com/youtube/v3/search");
        url.searchParams.set("part", "snippet");
        url.searchParams.set("channelId", c.channelId);
        url.searchParams.set("eventType", "upcoming");
        url.searchParams.set("type", "video");
        url.searchParams.set("order", "date");
        url.searchParams.set("maxResults", "5");
        url.searchParams.set("key", apiKey);
        const res = await fetch(url.toString(), { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) continue;
        const data = (await res.json()) as { items?: any[] };
        for (const item of data.items ?? []) {
          const startsAt = Date.parse(item.snippet?.publishedAt ?? "");
          const videoId = item.id?.videoId;
          if (!videoId) continue;
          collected.push({
            creatorId: c.creatorId,
            platform: "youtube",
            username: c.username,
            title: item.snippet?.title ?? undefined,
            // Search API has no scheduled time; use publish time as ordering hint.
            startsAt: Number.isFinite(startsAt) ? startsAt : now,
            url: `https://youtube.com/watch?v=${videoId}`,
            source: "youtube-upcoming",
          });
        }
      } catch (e) {
        console.warn(`YouTube upcoming fetch failed for ${c.username}`, e);
      }
    }
    return collected;
  },
});

export const pollUpcoming = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const creators = await ctx.runQuery(internal.polling.getActiveCreators);
    if (creators.length === 0) return null;

    const twitchBroadcasters = creators
      .filter((c) => c.platform === "twitch" && c.platformId)
      .map((c) => ({ creatorId: c._id, broadcasterId: c.platformId!, username: c.username }));
    // YouTube channel IDs live in platformId when the creator was enriched.
    const youtubeChannels = creators
      .filter((c) => c.platform === "youtube" && c.platformId)
      .map((c) => ({ creatorId: c._id, channelId: c.platformId!, username: c.username }));
    // Kick exposes no schedule API; kick creators are covered by live polling.

    const [twitchEvents, youtubeEvents] = await Promise.all([
      twitchBroadcasters.length > 0
        ? await ctx.runAction(internal.upcoming.fetchTwitchSchedules, { broadcasters: twitchBroadcasters })
        : [],
      await ctx.runAction(internal.upcoming.fetchYoutubeUpcoming, { channels: youtubeChannels }),
    ]);

    const drafts = [...twitchEvents, ...youtubeEvents] as UpcomingDraft[];
    await ctx.runMutation(internal.upcoming.commitUpcoming, {
      events: drafts.map((d) => ({
        creatorId: (d as any).creatorId as Id<"creators"> | undefined,
        platform: d.platform,
        username: d.username,
        title: d.title,
        startsAt: d.startsAt,
        url: d.url,
        source: d.source,
      })),
    });
    return null;
  },
});

export const commitUpcoming = internalMutation({
  args: {
    events: v.array(v.object({
      creatorId: v.optional(v.id("creators")),
      platform: v.union(v.literal("twitch"), v.literal("youtube"), v.literal("kick")),
      username: v.string(),
      title: v.optional(v.string()),
      startsAt: v.number(),
      url: v.optional(v.string()),
      source: v.string(),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    // Prune past events first so the table stays bounded.
    const stale = await ctx.db
      .query("upcomingEvents")
      .withIndex("by_startsAt")
      .filter((q) => q.lt(q.field("startsAt"), now))
      .take(500);
    await Promise.all(stale.map((s) => ctx.db.delete(s._id)));

    // Drafts are per-creator schedule snapshots: replace each creator's rows
    // wholesale so cancelled entries don't linger. Group by platform+username
    // to keep the delete+insert pairs bounded per creator.
    const seen = new Set<string>();
    for (const e of args.events) {
      const key = `${e.platform}:${e.username.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        const existing = await ctx.db
          .query("upcomingEvents")
          .withIndex("by_platform_and_username", (q) =>
            q.eq("platform", e.platform).eq("username", e.username),
          )
          .collect();
        await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
      }
      await ctx.db.insert("upcomingEvents", e);
    }
    return null;
  },
});

const upcomingReturnValidator = v.object({
  _id: v.id("upcomingEvents"),
  _creationTime: v.number(),
  creatorId: v.optional(v.id("creators")),
  platform: v.union(v.literal("twitch"), v.literal("youtube"), v.literal("kick")),
  username: v.string(),
  title: v.optional(v.string()),
  startsAt: v.number(),
  url: v.optional(v.string()),
  source: v.string(),
  avatarUrl: v.optional(v.string()),
});

export const getUpcomingEvents = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(upcomingReturnValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 12, 50);
    const now = Date.now();
    const rows = await ctx.db
      .query("upcomingEvents")
      .withIndex("by_startsAt")
      .filter((q) => q.gte(q.field("startsAt"), now))
      .take(limit);
    return await Promise.all(
      rows.map(async (row) => {
        const creator = row.creatorId ? await ctx.db.get(row.creatorId) : null;
        return { ...row, avatarUrl: creator?.avatarUrl };
      }),
    );
  },
});
