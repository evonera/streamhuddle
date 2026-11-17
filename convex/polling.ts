import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";

// ----------------------------------------------------------------------------
// Live-status polling
//
// Database I/O budget matters more than anything else here: this runs every
// few minutes forever. The design keeps each poll to a couple of small reads:
//
// - `pollTargets` is ONE compact doc holding just the usernames to poll. It is
//   rebuilt from events/roster/creators (the expensive read) only when it is
//   missing, older than TARGETS_MAX_AGE_MS, or invalidated by a roster change
//   (see invalidatePollTargets).
// - `pollLive` is ONE small doc holding who is live right now and the values
//   last written to their creator docs. The action diffs the platform result
//   against it, so creators that stay offline cost nothing.
// - commitLiveStatuses only runs when something changed, and only touches the
//   creators whose live flag, title or viewer bucket actually moved. Unchanged
//   creators are never written, so public queries over `creators` are not
//   invalidated either.
// ----------------------------------------------------------------------------

/** Rebuild the target list at least this often, to pick up edits made outside
 * the mutations that call invalidatePollTargets (e.g. dashboard edits). */
export const TARGETS_MAX_AGE_MS = 6 * 60 * 60 * 1000;

/** A live viewer count is only rewritten when it moves by at least this
 * fraction of the last written value... */
export const VIEWER_CHANGE_RATIO = 0.1;
/** ...and by at least this many viewers (keeps tiny streams from flapping). */
export const VIEWER_CHANGE_MIN = 5;

const polledPlatform = v.union(v.literal("twitch"), v.literal("kick"));

const liveEntry = v.object({
  platform: polledPlatform,
  username: v.string(),
  viewerCount: v.optional(v.number()),
  streamTitle: v.optional(v.string()),
});
export type LiveEntry = Infer<typeof liveEntry>;

const pollResult = v.object({
  platform: polledPlatform,
  username: v.string(),
  isLive: v.boolean(),
  viewerCount: v.optional(v.number()),
  streamTitle: v.optional(v.string()),
});
export type PollResult = Infer<typeof pollResult>;

const pollState = v.object({
  twitch: v.array(v.string()),
  kick: v.array(v.string()),
  builtAt: v.number(),
  live: v.array(liveEntry),
});
type PollState = Infer<typeof pollState>;

const keyOf = (e: { platform: string; username: string }) => `${e.platform}:${e.username}`;

/** True when a viewer count moved enough to be worth a write. */
export function viewerCountChanged(prev: number | undefined, next: number | undefined): boolean {
  if (prev === undefined || next === undefined) return prev !== next;
  return Math.abs(next - prev) >= Math.max(VIEWER_CHANGE_MIN, prev * VIEWER_CHANGE_RATIO);
}

/**
 * Return only the poll results that differ from the last written state:
 * went live, went offline, changed title, or moved viewer bucket.
 * Creators that were and still are offline never appear.
 */
export function diffLiveStatuses(prevLive: Array<LiveEntry>, results: Array<PollResult>): Array<PollResult> {
  const prev = new Map(prevLive.map((e) => [keyOf(e), e]));
  return results.filter((r) => {
    const before = prev.get(keyOf(r));
    if (!r.isLive) return before !== undefined;
    if (!before) return true;
    return before.streamTitle !== r.streamTitle || viewerCountChanged(before.viewerCount, r.viewerCount);
  });
}

// ----------------------------------------------------------------------------
// State docs (singletons)
// ----------------------------------------------------------------------------

async function readPollState(ctx: QueryCtx): Promise<PollState | null> {
  const targets = await ctx.db.query("pollTargets").first();
  if (!targets) return null;
  const live = await ctx.db.query("pollLive").first();
  return { twitch: targets.twitch, kick: targets.kick, builtAt: targets.builtAt, live: live?.live ?? [] };
}

/**
 * Drop the cached poll target list so the next poll rebuilds it. Call from any
 * mutation that changes rosters, active events, or polled creators.
 */
export async function invalidatePollTargets(ctx: MutationCtx): Promise<void> {
  const docs = await ctx.db.query("pollTargets").take(10);
  await Promise.all(docs.map((d) => ctx.db.delete(d._id)));
}

export const getPollState = internalQuery({
  args: {},
  returns: v.union(pollState, v.null()),
  handler: async (ctx) => readPollState(ctx),
});

/** Expensive read: active events → roster → creator docs. */
async function loadActiveCreators(ctx: QueryCtx): Promise<Array<Doc<"creators">>> {
  const events = await ctx.db
    .query("events")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();
  const rosters = await Promise.all(
    events.map((e) => ctx.db.query("roster").withIndex("by_event", (q) => q.eq("eventId", e._id)).collect()),
  );
  const creatorIds = Array.from(new Set(rosters.flat().map((r) => r.creatorId)));
  return (await Promise.all(creatorIds.map((id) => ctx.db.get(id)))).filter(
    (c): c is Doc<"creators"> => c !== null,
  );
}

/** Active-roster creators, slimmed to what callers need. Used by the hourly
 * upcoming-events poll; live polling uses the cached pollTargets instead. */
export const getActiveCreators = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("creators"),
      platform: v.string(),
      username: v.string(),
      platformId: v.optional(v.string()),
    }),
  ),
  handler: async (ctx) => {
    const creators = await loadActiveCreators(ctx);
    return creators.map((c) => ({ _id: c._id, platform: c.platform, username: c.username, platformId: c.platformId }));
  },
});

/** Rebuild path: run the expensive read, then cache the compact target list
 * and the current live set. */
export const rebuildPollTargets = internalMutation({
  args: {},
  returns: pollState,
  handler: async (ctx) => {
    const creators = await loadActiveCreators(ctx);

    const twitch = new Set<string>();
    const kick = new Set<string>();
    const live = new Map<string, LiveEntry>();
    for (const c of creators) {
      if (c.platform !== "twitch" && c.platform !== "kick") continue;
      (c.platform === "twitch" ? twitch : kick).add(c.username);
      if (c.isLive) {
        const entry: LiveEntry = { platform: c.platform, username: c.username };
        if (c.viewerCount !== undefined) entry.viewerCount = c.viewerCount;
        if (c.streamTitle !== undefined) entry.streamTitle = c.streamTitle;
        live.set(keyOf(entry), entry);
      }
    }

    const state: PollState = {
      twitch: Array.from(twitch),
      kick: Array.from(kick),
      builtAt: Date.now(),
      live: Array.from(live.values()),
    };

    await invalidatePollTargets(ctx);
    await ctx.db.insert("pollTargets", { twitch: state.twitch, kick: state.kick, builtAt: state.builtAt });
    const liveDocs = await ctx.db.query("pollLive").take(10);
    await Promise.all(liveDocs.slice(1).map((d) => ctx.db.delete(d._id)));
    if (liveDocs[0]) await ctx.db.replace(liveDocs[0]._id, { live: state.live });
    else await ctx.db.insert("pollLive", { live: state.live });
    return state;
  },
});

// ----------------------------------------------------------------------------
// Poll
// ----------------------------------------------------------------------------

export const pollAllPlatforms = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let state: PollState | null = await ctx.runQuery(internal.polling.getPollState);
    if (!state || Date.now() - state.builtAt > TARGETS_MAX_AGE_MS) {
      state = await ctx.runMutation(internal.polling.rebuildPollTargets);
    }
    if (state.twitch.length === 0 && state.kick.length === 0) return null;

    const results: Array<PollResult> = [];

    // Twitch: one batched Helix call (chunked by 50 inside fetchTwitchStreams).
    if (state.twitch.length > 0) {
      try {
        const streams = await ctx.runAction(internal.twitch.fetchTwitchStreams, { logins: state.twitch });
        const streamMap = new Map(streams.map((s: any) => [String(s.user_login).toLowerCase(), s]));
        for (const username of state.twitch) {
          const stream = streamMap.get(username.toLowerCase());
          results.push({
            platform: "twitch",
            username,
            isLive: !!stream,
            viewerCount: stream ? stream.viewer_count : undefined,
            streamTitle: stream ? stream.title : undefined,
          });
        }
      } catch (error) {
        console.error("Failed to poll Twitch streams (possibly missing TWITCH_CLIENT_ID/SECRET):", error);
      }
    }

    // Kick: individual REST calls.
    if (state.kick.length > 0) {
      // Note: Kick blocks serverless IPs via Cloudflare.
      // If this fails consistently with 403, route through a proxy like ZenRows.
      const proxyUrl = process.env.KICK_PROXY_URL; // Optional proxy for Cloudflare bypass
      let proxyBase: URL | undefined;
      if (proxyUrl) {
        try {
          proxyBase = new URL(proxyUrl);
          if (proxyBase.protocol !== "https:") proxyBase = undefined;
        } catch {
          proxyBase = undefined;
        }
      }

      const kickPromises = state.kick.map(async (username) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const url = proxyBase
            ? new URL(`${proxyBase.pathname.replace(/\/$/, "")}/api/v2/channels/${encodeURIComponent(username)}`, proxyBase.origin).toString()
            : `https://kick.com/api/v2/channels/${encodeURIComponent(username)}`;

          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);

          if (!res.ok) throw new Error(`Kick API error for ${username}: ${res.status}`);
          const data: any = await res.json();
          const livestream = data?.livestream;

          results.push({
            platform: "kick",
            username,
            isLive: !!livestream,
            viewerCount: livestream ? livestream.viewer_count : undefined,
            streamTitle: livestream ? livestream.session_title : undefined,
          });
        } catch (e) {
          console.warn(`Kick polling failed for ${username}`, e);
          // Graceful degradation: skip updating if Kick API fails
        }
      });
      await Promise.allSettled(kickPromises);
    }

    // Only pay for a mutation when something visible changed.
    const changes = diffLiveStatuses(state.live, results);
    if (changes.length === 0) return null;
    await ctx.runMutation(internal.polling.commitLiveStatuses, { changes });
    return null;
  },
});

/**
 * Apply live-status changes. Re-diffs against the stored live set so a stale
 * or repeated call is a no-op, then patches only the creators that changed.
 * Returns how many changes were applied.
 */
export const commitLiveStatuses = internalMutation({
  args: { changes: v.array(pollResult) },
  returns: v.number(),
  handler: async (ctx, args) => {
    const liveDoc = await ctx.db.query("pollLive").first();
    const prevLive = liveDoc?.live ?? [];
    const changes = diffLiveStatuses(prevLive, args.changes);
    if (changes.length === 0) return 0;

    const live = new Map(prevLive.map((e) => [keyOf(e), e]));
    for (const change of changes) {
      const matches = await ctx.db
        .query("creators")
        .withIndex("by_platform_and_username", (q) =>
          q.eq("platform", change.platform).eq("username", change.username),
        )
        .take(10);
      for (const creator of matches) {
        await ctx.db.patch(creator._id, {
          isLive: change.isLive,
          viewerCount: change.viewerCount,
          streamTitle: change.streamTitle,
        });
      }

      if (change.isLive) {
        const entry: LiveEntry = { platform: change.platform, username: change.username };
        if (change.viewerCount !== undefined) entry.viewerCount = change.viewerCount;
        if (change.streamTitle !== undefined) entry.streamTitle = change.streamTitle;
        live.set(keyOf(change), entry);
      } else {
        live.delete(keyOf(change));
      }
    }

    const next = Array.from(live.values());
    if (liveDoc) await ctx.db.replace(liveDoc._id, { live: next });
    else await ctx.db.insert("pollLive", { live: next });
    return changes.length;
  },
});
