// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { internal } from "../../convex/_generated/api"
import { emptyStreamerData } from "../../convex/streamerData"
import { initConvexTest } from "../../convex/test.helpers"

const headers = {
  "x-streamhuddle-auth-proxy": "test-proxy-secret",
  "x-streamhuddle-client-ip": "203.0.113.20",
}
const user = {
  id: "1",
  login: "ada",
  display_name: "Ada",
  profile_image_url: "https://example.com/avatar.png",
  offline_image_url: "",
  description: "Hello",
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubEnv("AUTH_PROXY_SECRET", "test-proxy-secret")
  vi.stubEnv("TWITCH_CLIENT_ID", "test-client")
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function setup() {
  const t = initConvexTest()
  await t.mutation(internal.twitch.cacheTwitchToken, {
    token: "test-access-token",
    expiresIn: 3600,
  })
  const upstream = vi.fn<(input: string | URL | Request) => Promise<Response>>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : input)
    return Response.json({ data: url.pathname === "/helix/users" ? [user] : [] })
  })
  vi.stubGlobal("fetch", upstream)
  return { t, upstream }
}

describe("shared streamer cache and budgets", () => {
  test("direct calls and malformed usernames never reach Twitch", async () => {
    const { t, upstream } = await setup()
    expect((await t.fetch("/streamer-profile?username=ada")).status).toBe(401)
    expect((await t.fetch("/streamer-profile?username=../ada", { headers })).status).toBe(200)
    expect(upstream).not.toHaveBeenCalled()
  })

  test("normalizes cache keys across independent HTTP handlers and refreshes after expiry", async () => {
    const { t, upstream } = await setup()
    const first = await t.fetch("/streamer-profile?username=Ada", { headers })
    expect(first.status).toBe(200)
    expect((await first.json()).user.displayName).toBe("Ada")
    expect((await t.fetch("/streamer-profile?username=ada", { headers })).status).toBe(200)
    expect(upstream).toHaveBeenCalledTimes(4)
    vi.setSystemTime(Date.now() + 16_000)
    expect((await t.fetch("/streamer-profile?username=ada", { headers })).status).toBe(200)
    expect(upstream).toHaveBeenCalledTimes(8)
  })

  test("coalesces misses via a shared lease rather than another provider fanout", async () => {
    const { t, upstream } = await setup()
    let release!: () => void
    let started!: () => void
    const wait = new Promise<void>((resolve) => {
      release = resolve
    })
    const signal = new Promise<void>((resolve) => {
      started = resolve
    })
    upstream.mockImplementationOnce(async () => {
      started()
      await wait
      return Response.json({ data: [user] })
    })
    const first = t.fetch("/streamer-profile?username=ada", { headers })
    await signal
    expect((await t.fetch("/streamer-profile?username=ADA", { headers })).status).toBe(202)
    release()
    expect((await first).status).toBe(200)
    expect((await t.fetch("/streamer-profile?username=ada", { headers })).status).toBe(200)
    expect(upstream).toHaveBeenCalledTimes(4)
  })

  test("IP limits return 429 with no upstream call and do not poison another caller's cache", async () => {
    const { t, upstream } = await setup()
    for (let i = 0; i < 20; i++)
      expect((await t.fetch("/streamer-profile?username=ada", { headers })).status).toBe(200)
    expect((await t.fetch("/streamer-profile?username=ada", { headers })).status).toBe(429)
    expect(
      (
        await t.fetch("/streamer-profile?username=ada", {
          headers: { ...headers, "x-streamhuddle-client-ip": "203.0.113.21" },
        })
      ).status,
    ).toBe(200)
    expect(upstream).toHaveBeenCalledTimes(4)
  })

  test("global provider budget bounds distinct misses even when client IPs rotate", async () => {
    const { t, upstream } = await setup()
    upstream.mockImplementation(async () => Response.json({ data: [] }))
    for (let i = 0; i < 10; i++)
      expect(
        (
          await t.fetch(`/streamer-profile?username=absent${i}`, {
            headers: { ...headers, "x-streamhuddle-client-ip": `203.0.113.${i}` },
          })
        ).status,
      ).toBe(200)
    expect(
      (
        await t.fetch("/streamer-profile?username=another", {
          headers: { ...headers, "x-streamhuddle-client-ip": "203.0.113.99" },
        })
      ).status,
    ).toBe(429)
    expect(upstream).toHaveBeenCalledTimes(10)
    expect((await t.fetch("/streamer-profile?username=ABSENT0", { headers })).status).toBe(200)
    expect(upstream).toHaveBeenCalledTimes(10)
  })

  test("a lost lease can expire; late completion cannot overwrite a newer refresh", async () => {
    const { t } = await setup()
    const first = await t.mutation(internal.streamerProfiles.reserve, {
      username: "ada",
      clientIp: "203.0.113.1",
      lease: "first",
    })
    if (first.kind !== "fetch") throw new Error("Expected lease")
    vi.setSystemTime(Date.now() + 61_000)
    const second = await t.mutation(internal.streamerProfiles.reserve, {
      username: "ada",
      clientIp: "203.0.113.2",
      lease: "second",
    })
    if (second.kind !== "fetch") throw new Error("Expected recovery")
    await t.mutation(internal.streamerProfiles.complete, {
      cacheId: second.cacheId,
      lease: "second",
      data: emptyStreamerData("not-found"),
    })
    await t.mutation(internal.streamerProfiles.complete, {
      cacheId: first.cacheId,
      lease: "first",
      data: emptyStreamerData("unavailable"),
    })
    const current = await t.run((ctx) => ctx.db.get(first.cacheId))
    expect(current?.data?.status).toBe("not-found")
  })

  test("stream-provider failure stays distinct from an offline stream", async () => {
    const { t, upstream } = await setup()
    upstream.mockImplementation(async (input) => {
      const url = new URL(input instanceof Request ? input.url : input)
      if (url.pathname === "/helix/streams") return new Response(null, { status: 503 })
      return Response.json({ data: url.pathname === "/helix/users" ? [user] : [] })
    })
    const response = await t.fetch("/streamer-profile?username=ada", { headers })
    expect(await response.json()).toMatchObject({
      status: "ok",
      stream: null,
      streamUnavailable: true,
      partialError: true,
    })
  })
})
