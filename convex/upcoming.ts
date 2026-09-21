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
  videoId?: string;
  source: string;
};

/** Rotate a capped list across hourly runs so large rosters are covered over
 * time instead of polling the same arbitrary prefix every hour. */
export function rotateWindow<T>(items: Array<T>, cap: number, slot: number): Array<T> {
  if (items.length <= cap) return items;
  const start = (slot * cap) % items.length;
  return Array.from({ length: cap }, (_, i) => items[(start + i) % items.length]);
}

// Twitch schedule segments, one call per broadcaster (Helix has no batch
// schedule endpoint). Capped so the hourly cron stays cheap.
// Returns per-creator success flags: only creators whose request completed
// (even with an empty schedule) may have their snapshot cleared. Failures
// must never look like confirmed-empty schedules.
export const fetchTwitchSchedules = internalAction({
  args: {
    broadcasters: v.array(v.object({
      creatorId: v.id("creators"),
      broadcasterId: v.string(),
      username: v.string(),
    })),
  },
  returns: v.object({
    events: v.array(v.any()),
    succeededKeys: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    if (args.broadcasters.length === 0) return { events: [], succeededKeys: [] };
    let token: string;
    try {
      token = await getTwitchAccessToken(ctx);
    } catch (e) {
      console.warn("Skipping Twitch schedule poll (missing TWITCH_CLIENT_ID/SECRET).");
      return { events: [], succeededKeys: [] };
    }
    const clientId = process.env.TWITCH_CLIENT_ID;
    const now = Date.now();
    const collected: any[] = [];
    const succeededKeys: string[] = [];

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
        // 404 = "no schedule published": a confirmed empty schedule, so the
        // creator counts as successfully polled and old rows clear. Other
        // failures leave existing rows untouched until the next run.
        if (res.status === 404) {
          succeededKeys.push(`twitch:${b.username.toLowerCase()}`);
          continue;
        }
        if (!res.ok) continue;
        succeededKeys.push(`twitch:${b.username.toLowerCase()}`);
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
    return { events: collected, succeededKeys };
  },
});

// YouTube upcoming streams. STUBBED until YOUTUBE_API_KEY is configured:
// without a key this returns [] and the poll keeps working on Twitch data.
// NOTE: search.list has no scheduled time, so candidate video IDs are
// resolved through videos.list (liveStreamingDetails) for the real
// scheduledStartTime. Items already live or without a future start time
// are skipped rather than stored with a wrong timestamp.
export const fetchYoutubeUpcoming = internalAction({
  args: {
    channels: v.array(v.object({
      creatorId: v.id("creators"),
      channelId: v.string(),
      username: v.string(),
    })),
  },
  returns: v.object({
    events: v.array(v.any()),
    succeededKeys: v.array(v.string()),
  }),
  handler: async (_ctx, args) => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      console.info("Skipping YouTube upcoming poll (YOUTUBE_API_KEY not set).");
      return { events: [], succeededKeys: [] };
    }
    if (args.channels.length === 0) return { events: [], succeededKeys: [] };
    const now = Date.now();
    const collected: any[] = [];
    const succeededKeys: string[] = [];
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
        const videoIds = (data.items ?? [])
          .map((item) => item.id?.videoId)
          .filter(Boolean) as string[];
        // Successful search with zero videos = confirmed empty schedule.
        if (videoIds.length === 0) {
          succeededKeys.push(`youtube:${c.username.toLowerCase()}`);
          continue;
        }

        // Resolve real scheduled times; search results carry none.
        const detailsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        detailsUrl.searchParams.set("part", "snippet,liveStreamingDetails");
        detailsUrl.searchParams.set("id", videoIds.join(","));
        detailsUrl.searchParams.set("key", apiKey);
        const detailsRes = await fetch(detailsUrl.toString());
        if (!detailsRes.ok) continue;
        succeededKeys.push(`youtube:${c.username.toLowerCase()}`);
        const details = (await detailsRes.json()) as { items?: any[] };
        for (const video of details.items ?? []) {
          const live = video.liveStreamingDetails;
          // Already live or unscheduled: not an upcoming event.
          if (!live || live.actualStartTime) continue;
          const startsAt = Date.parse(live.scheduledStartTime ?? "");
          if (!Number.isFinite(startsAt) || startsAt <= now) continue;
          collected.push({
            creatorId: c.creatorId,
            platform: "youtube",
            username: c.username,
            title: video.snippet?.title ?? undefined,
            startsAt,
            url: `https://youtube.com/watch?v=${video.id}`,
            videoId: video.id,
            source: "youtube-upcoming",
          });
        }
      } catch (e) {
        console.warn(`YouTube upcoming fetch failed for ${c.username}`, e);
      }
    }
    return { events: collected, succeededKeys };
  },
});

export const pollUpcoming = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const creators = await ctx.runQuery(internal.polling.getActiveCreators);
    if (creators.length === 0) return null;

    const byName = [...creators].sort((a, b) => a.username.localeCompare(b.username));
    // Hourly slot rotates the capped windows so large rosters are covered
    // over successive runs instead of polling the same prefix forever.
    const slot = Math.floor(Date.now() / 3_600_000);

    const twitchBroadcasters = rotateWindow(
      byName
        .filter((c) => c.platform === "twitch" && c.platformId)
        .map((c) => ({ creatorId: c._id, broadcasterId: c.platformId!, username: c.username })),
      60,
      slot,
    );
    // YouTube channel IDs live in platformId when the creator was enriched.
    const youtubeChannels = rotateWindow(
      byName
        .filter((c) => c.platform === "youtube" && c.platformId)
        .map((c) => ({ creatorId: c._id, channelId: c.platformId!, username: c.username })),
      30,
      slot,
    );
    // Kick exposes no schedule API; kick creators are covered by live polling.

    const [twitchResult, youtubeResult] = await Promise.all([
      twitchBroadcasters.length > 0
        ? await ctx.runAction(internal.upcoming.fetchTwitchSchedules, { broadcasters: twitchBroadcasters })
        : { events: [], succeededKeys: [] },
      await ctx.runAction(internal.upcoming.fetchYoutubeUpcoming, { channels: youtubeChannels }),
    ]);

    const drafts = [...twitchResult.events, ...youtubeResult.events] as UpcomingDraft[];
    // Only creators whose provider request completed successfully may have
    // their snapshot cleared: a failed request is not a confirmed empty
    // schedule, and must not delete valid events.
    const polledKeys = [...twitchResult.succeededKeys, ...youtubeResult.succeededKeys];
    await ctx.runMutation(internal.upcoming.commitUpcoming, {
      polledKeys,
      events: drafts.map((d) => ({
        creatorId: (d as any).creatorId as Id<"creators"> | undefined,
        platform: d.platform,
        username: d.username,
        title: d.title,
        startsAt: d.startsAt,
        url: d.url,
        videoId: d.videoId,
        source: d.source,
      })),
    });
    return null;
  },
});

export const commitUpcoming = internalMutation({
  args: {
    // Every creator polled this run, as "platform:lowercase-username".
    // Creators with no drafts had empty/cancelled schedules: clear them.
    polledKeys: v.array(v.string()),
    events: v.array(v.object({
      creatorId: v.optional(v.id("creators")),
      platform: v.union(v.literal("twitch"), v.literal("youtube"), v.literal("kick")),
      username: v.string(),
      title: v.optional(v.string()),
      startsAt: v.number(),
      url: v.optional(v.string()),
      videoId: v.optional(v.string()),
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

    // Drafts are per-creator schedule snapshots: replace each polled
    // creator's rows wholesale so cancelled entries don't linger.
    // Usernames are stored lowercased (handles are case-insensitive on all
    // three platforms) so the exact index lookup below always matches.
    for (const key of args.polledKeys) {
      const [platform, username] = key.split(":");
      const existing = await ctx.db
        .query("upcomingEvents")
        .withIndex("by_platform_and_username", (q) =>
          q.eq("platform", platform as "twitch" | "youtube" | "kick").eq("username", username),
        )
        .collect();
      await Promise.all(existing.map((row) => ctx.db.delete(row._id)));
    }
    for (const e of args.events) {
      await ctx.db.insert("upcomingEvents", {
        ...e,
        username: e.username.toLowerCase(),
      });
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
  videoId: v.optional(v.string()),
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
