// @vitest-environment edge-runtime
import { afterEach, describe, expect, test, vi } from "vitest"

import { internal } from "../../convex/_generated/api"
import { r2 } from "../../convex/r2"
import { initConvexTest } from "../../convex/test.helpers"

type FetchMock = (input: string | URL | Request, options?: RequestInit) => Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("clip-creation teardown", () => {
  test("purgeClips deletes every clip row and its R2 files, attached or not", async () => {
    const t = initConvexTest()
    const deleted = vi.spyOn(r2, "deleteObject").mockResolvedValue(undefined)
    const ids = await t.run(async (ctx) => {
      const out = []
      for (let i = 0; i < 25; i++) {
        out.push(
          await ctx.db.insert("clips", {
            userId: "user",
            status: "ready",
            streams: [
              { broadcasterId: "1", broadcasterName: "a", r2Key: `custom/${i}.mp4` },
              { broadcasterId: "2", broadcasterName: "b" },
            ],
            duration: 30,
            isMultiPov: true,
            createdAt: Date.now(),
          }),
        )
      }
      return out
    })

    // First page reschedules itself; run the second page directly.
    expect(await t.mutation(internal.clipRemoval.purgeClips, {})).toBe(20)
    expect(await t.mutation(internal.clipRemoval.purgeClips, {})).toBe(5)

    expect(await t.run((ctx) => ctx.db.query("clips").take(1))).toEqual([])
    const keys = deleted.mock.calls.map((call) => call[1])
    expect(keys).toContain("custom/0.mp4")
    expect(keys).toContain(`clips/${ids[0]}/0.mp4`)
    expect(keys).toContain(`clips/${ids[0]}/1.mp4`)
    expect(keys).toHaveLength(25 * 3)
  })

  test("revokeTwitchTokens revokes each token at Twitch, then deletes the rows", async () => {
    vi.stubEnv("TWITCH_CLIENT_ID", "client")
    const t = initConvexTest()
    await t.run(async (ctx) => {
      for (const token of ["a", "b"]) {
        await ctx.db.insert("twitchUserTokens", {
          userId: "user",
          twitchUserId: "1",
          twitchUsername: "ada",
          accessToken: `access-${token}`,
          refreshToken: "refresh",
          scopes: "clips:edit",
          expiresAt: Date.now(),
        })
      }
    })
    const fetchMock = vi.fn<FetchMock>(async () => new Response(null, { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    await t.action(internal.clipRemoval.revokeTwitchTokens, {})

    const revoked = fetchMock.mock.calls.map(([, options]) =>
      options?.body instanceof URLSearchParams ? options.body.get("token") : null,
    )
    expect(revoked.toSorted((a, b) => String(a).localeCompare(String(b)))).toEqual(["access-a", "access-b"])
    expect(await t.run((ctx) => ctx.db.query("twitchUserTokens").take(1))).toEqual([])
  })

  test("without TWITCH_CLIENT_ID nothing is deleted unrevoked", async () => {
    vi.stubEnv("TWITCH_CLIENT_ID", "")
    const t = initConvexTest()
    await t.run((ctx) =>
      ctx.db.insert("twitchUserTokens", {
        userId: "user",
        twitchUserId: "1",
        twitchUsername: "ada",
        accessToken: "access",
        refreshToken: "refresh",
        scopes: "clips:edit",
        expiresAt: Date.now(),
      }),
    )
    await expect(t.action(internal.clipRemoval.revokeTwitchTokens, {})).rejects.toThrow(/TWITCH_CLIENT_ID/)
    expect(await t.run((ctx) => ctx.db.query("twitchUserTokens").take(1))).toHaveLength(1)
  })
})
