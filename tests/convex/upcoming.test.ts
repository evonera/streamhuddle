// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest"
import { convexTest } from "convex-test"

import { api, internal } from "../../convex/_generated/api"
import schema from "../../convex/schema"

const modules = import.meta.glob("../../convex/**/*.ts")

function setup() {
  return convexTest(schema, modules as any)
}

function commit(t: any, polledKeys: Array<string>, events: Array<any>) {
  return t.mutation(internal.upcoming.commitUpcoming, { polledKeys, events })
}

describe("commitUpcoming", () => {
  test("inserts events and prunes past ones", async () => {
    const t = setup()
    const now = Date.now()
    await commit(t, ["twitch:xqc"], [
      { platform: "twitch", username: "xqc", title: "Future", startsAt: now + 3600_000, source: "twitch-schedule" },
      { platform: "twitch", username: "xqc", title: "Past", startsAt: now - 3600_000, source: "twitch-schedule" },
    ])
    const rows = await t.query(api.upcoming.getUpcomingEvents, {})
    expect(rows).toHaveLength(1)
    expect(rows[0].username).toBe("xqc")
    expect(rows[0].title).toBe("Future")
  })

  test("re-poll replaces a creator snapshot instead of duplicating", async () => {
    const t = setup()
    const now = Date.now()
    await commit(t, ["twitch:shroud"], [
      { platform: "twitch" as const, username: "shroud", title: "V1", startsAt: now + 3600_000, source: "twitch-schedule" },
    ])
    await commit(t, ["twitch:shroud"], [
      { platform: "twitch" as const, username: "shroud", title: "V2", startsAt: now + 7200_000, source: "twitch-schedule" },
    ])
    const rows = await t.query(api.upcoming.getUpcomingEvents, {})
    expect(rows).toHaveLength(1)
    expect(rows[0].title).toBe("V2")
  })

  test("cancelled schedules clear previously stored events", async () => {
    const t = setup()
    const now = Date.now()
    await commit(t, ["twitch:shroud"], [
      { platform: "twitch" as const, username: "shroud", title: "V1", startsAt: now + 3600_000, source: "twitch-schedule" },
    ])
    expect(await t.query(api.upcoming.getUpcomingEvents, {})).toHaveLength(1)
    // Next poll: creator polled but schedule empty -> rows cleared.
    await commit(t, ["twitch:shroud"], [])
    expect(await t.query(api.upcoming.getUpcomingEvents, {})).toHaveLength(0)
  })

  test("unpolled creators keep their events", async () => {
    const t = setup()
    const now = Date.now()
    await commit(t, ["twitch:shroud"], [
      { platform: "twitch" as const, username: "shroud", title: "V1", startsAt: now + 3600_000, source: "twitch-schedule" },
    ])
    // Different creator polled: shroud's rows untouched.
    await commit(t, ["twitch:xqc"], [
      { platform: "twitch" as const, username: "xqc", title: "Q1", startsAt: now + 3600_000, source: "twitch-schedule" },
    ])
    expect(await t.query(api.upcoming.getUpcomingEvents, {})).toHaveLength(2)
  })
})
