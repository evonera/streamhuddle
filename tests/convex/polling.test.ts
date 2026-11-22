// @vitest-environment edge-runtime
import { afterEach, describe, expect, test, vi } from "vitest"
import { convexTest } from "convex-test"

import { api, internal } from "../../convex/_generated/api"
import { diffLiveStatuses, viewerCountChanged } from "../../convex/polling"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

function setup() {
  return convexTest(schema, modules as any)
}

describe("diffLiveStatuses", () => {
  const live = [{ platform: "twitch" as const, username: "alice", viewerCount: 1000, streamTitle: "Hi" }]

  test("skips creators that stay offline and live creators with tiny changes", () => {
    expect(
      diffLiveStatuses(live, [
        { platform: "twitch", username: "bob", isLive: false },
        { platform: "kick", username: "carol", isLive: false },
        { platform: "twitch", username: "alice", isLive: true, viewerCount: 1050, streamTitle: "Hi" },
      ]),
    ).toEqual([])
  })

  test("keeps go-live, go-offline, title and viewer-bucket changes", () => {
    const goLive = { platform: "twitch" as const, username: "bob", isLive: true, viewerCount: 3, streamTitle: "Yo" }
    const offline = { platform: "twitch" as const, username: "alice", isLive: false }
    expect(diffLiveStatuses(live, [goLive])).toEqual([goLive])
    expect(diffLiveStatuses(live, [offline])).toEqual([offline])
    const retitled = { ...live[0], isLive: true, streamTitle: "New" }
    expect(diffLiveStatuses(live, [retitled])).toEqual([retitled])
    const surge = { ...live[0], isLive: true, viewerCount: 1200 }
    expect(diffLiveStatuses(live, [surge])).toEqual([surge])
  })

  test("viewer bucket has a floor for tiny streams", () => {
    expect(viewerCountChanged(3, 7)).toBe(false)
    expect(viewerCountChanged(3, 8)).toBe(true)
    expect(viewerCountChanged(undefined, 0)).toBe(true)
  })
})

async function seed(t: ReturnType<typeof setup>) {
  return t.run(async (ctx) => {
    const eventId = await ctx.db.insert("events", { name: "E", slug: "e", isActive: true })
    const inactive = await ctx.db.insert("events", { name: "Old", slug: "old", isActive: false })
    const alice = await ctx.db.insert("creators", {
      platform: "twitch",
      username: "alice",
      description: "a long bio that polling should not need",
      isLive: true,
      viewerCount: 1000,
      streamTitle: "Hi",
    })
    const bob = await ctx.db.insert("creators", { platform: "kick", username: "bob" })
    const yt = await ctx.db.insert("creators", { platform: "youtube", username: "yt" })
    const old = await ctx.db.insert("creators", { platform: "twitch", username: "old" })
    for (const creatorId of [alice, bob, yt]) {
      await ctx.db.insert("roster", { eventId, creatorId, category: "Student" })
    }
    await ctx.db.insert("roster", { eventId: inactive, creatorId: old, category: "Student" })
    return { alice, bob }
  })
}

describe("poll state + commitLiveStatuses", () => {
  test("rebuild caches only polled usernames from active events and the live set", async () => {
    const t = setup()
    await seed(t)
    const state = await t.mutation(internal.polling.rebuildPollTargets, {})
    expect(state.twitch).toEqual(["alice"])
    expect(state.kick).toEqual(["bob"])
    expect(state.live).toEqual([{ platform: "twitch", username: "alice", viewerCount: 1000, streamTitle: "Hi" }])
    const read = await t.query(internal.polling.getPollState, {})
    expect(read?.twitch).toEqual(["alice"])
    expect(read?.live).toHaveLength(1)
  })

  test("rebuild caches upcoming targets: active Twitch/YouTube creators with a platformId", async () => {
    const t = setup()
    const { alice } = await seed(t)
    await t.run(async (ctx) => {
      await ctx.db.patch(alice, { platformId: "111" })
      const yt = await ctx.db
        .query("creators")
        .withIndex("by_platform_and_username", (q) => q.eq("platform", "youtube").eq("username", "yt"))
        .first()
      await ctx.db.patch(yt!._id, { platformId: "UC123" })
    })
    await t.mutation(internal.polling.rebuildPollTargets, {})
    const cached = await t.query(internal.polling.getUpcomingTargets, {})
    expect(cached?.targets.map((c) => [c.platform, c.username, c.platformId]).toSorted()).toEqual([
      ["twitch", "alice", "111"],
      ["youtube", "yt", "UC123"],
    ])
  })

  test("writes changed creators and skips unchanged or repeated updates", async () => {
    const t = setup()
    const { alice, bob } = await seed(t)
    await t.mutation(internal.polling.rebuildPollTargets, {})

    const changes = [
      { platform: "kick" as const, username: "bob", isLive: true, viewerCount: 50, streamTitle: "Kick!" },
      // Below the viewer bucket and same title: must not be written.
      { platform: "twitch" as const, username: "alice", isLive: true, viewerCount: 1010, streamTitle: "Hi" },
    ]
    expect(await t.mutation(internal.polling.commitLiveStatuses, { changes })).toBe(1)
    // Replaying the same poll is a no-op.
    expect(await t.mutation(internal.polling.commitLiveStatuses, { changes })).toBe(0)

    const [a, b] = await t.run(async (ctx) => [await ctx.db.get(alice), await ctx.db.get(bob)])
    expect(a).toMatchObject({ isLive: true, viewerCount: 1000, streamTitle: "Hi" })
    expect(b).toMatchObject({ isLive: true, viewerCount: 50, streamTitle: "Kick!" })

    // Going offline clears the fields and drops the creator from the live set.
    expect(
      await t.mutation(internal.polling.commitLiveStatuses, {
        changes: [{ platform: "twitch", username: "alice", isLive: false }],
      }),
    ).toBe(1)
    const after = await t.run(async (ctx) => ctx.db.get(alice))
    expect(after?.isLive).toBe(false)
    expect(after?.viewerCount).toBeUndefined()
    expect(after?.streamTitle).toBeUndefined()
    const state = await t.query(internal.polling.getPollState, {})
    expect(state?.live.map((e) => e.username)).toEqual(["bob"])
  })

  test("roster changes invalidate the cached targets", async () => {
    const t = setup()
    await seed(t)
    await t.mutation(internal.polling.rebuildPollTargets, {})
    await t.run(async (ctx) => {
      const { invalidatePollTargets } = await import("../../convex/polling")
      await invalidatePollTargets(ctx)
    })
    expect(await t.query(internal.polling.getPollState, {})).toBeNull()
    expect(await t.query(internal.polling.getUpcomingTargets, {})).toBeNull()
  })
})

describe("Twitch outage handling", () => {
  afterEach(() => vi.unstubAllGlobals())

  test("a failed Helix chunk does not mark live creators offline", async () => {
    const t = setup()
    const { alice } = await seed(t)
    await t.run(async (ctx) => {
      await ctx.db.insert("twitchTokens", { token: "app-token", expiresAt: Date.now() + 3_600_000 })
    })
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })))

    await t.action(internal.polling.pollAllPlatforms, {})

    const creator = await t.run((ctx) => ctx.db.get(alice))
    expect(creator?.isLive).toBe(true)
    expect(creator?.viewerCount).toBe(1000)
  })

  test("fetchTwitchStreams reports the logins of failed chunks", async () => {
    const t = setup()
    await t.run(async (ctx) => {
      await ctx.db.insert("twitchTokens", { token: "app-token", expiresAt: Date.now() + 3_600_000 })
    })
    const logins = Array.from({ length: 60 }, (_, i) => `user${i}`)
    let call = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        call++ === 0
          ? Response.json({ data: [{ user_login: "user1", viewer_count: 5, title: "t" }] })
          : new Response("boom", { status: 500 }),
      ),
    )

    const result = await t.action(internal.twitch.fetchTwitchStreams, { logins })
    expect(result.streams).toHaveLength(1)
    expect(result.failedLogins).toEqual(logins.slice(50))
  })
})

describe("creator username casing", () => {
  test("normalizeCreatorUsernames lowercases rows and getByUsername is case-insensitive", async () => {
    const t = setup()
    const id = await t.run((ctx) =>
      ctx.db.insert("creators", { platform: "twitch", username: "KaiCenat" }),
    )
    await t.run((ctx) => ctx.db.insert("creators", { platform: "custom", username: "https://Example.com/Live" }))

    const result = await t.mutation(internal.seed.normalizeCreatorUsernames, {})
    expect(result).toEqual({ fixed: 1, conflicts: [], isDone: true })

    const found = await t.query(api.creators.getByUsername, { platform: "twitch", username: "KAICENAT" })
    expect(found?._id).toBe(id)
    expect(found?.username).toBe("kaicenat")
    const custom = await t.query(api.creators.getByUsername, { platform: "custom", username: "https://Example.com/Live" })
    expect(custom?.username).toBe("https://Example.com/Live")
  })

  test("a mixed-case row with an existing lowercase twin is reported, not merged", async () => {
    const t = setup()
    await t.run(async (ctx) => {
      await ctx.db.insert("creators", { platform: "twitch", username: "xqc" })
      await ctx.db.insert("creators", { platform: "twitch", username: "xQc" })
    })
    const result = await t.mutation(internal.seed.normalizeCreatorUsernames, {})
    expect(result.fixed).toBe(0)
    expect(result.conflicts).toHaveLength(1)
  })
})
