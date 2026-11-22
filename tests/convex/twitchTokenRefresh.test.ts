// @vitest-environment edge-runtime
import { afterEach, describe, expect, test, vi } from "vitest"

import { internal } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import { initConvexTest } from "../../convex/test.helpers"

type FetchMock = (input: string | URL | Request, options?: RequestInit) => Promise<Response>

afterEach(() => vi.unstubAllGlobals())

async function setup(expiresAt: number) {
  vi.stubEnv("TWITCH_CLIENT_ID", "client")
  vi.stubEnv("TWITCH_CLIENT_SECRET", "secret")
  const t = initConvexTest()
  const ids = await t.run(async (ctx) => {
    const userId = "user-1"
    const tokenId = await ctx.db.insert("twitchUserTokens", {
      userId,
      twitchUserId: "1",
      twitchUsername: "ada",
      accessToken: "old-access",
      refreshToken: "old-refresh",
      scopes: "clips:edit",
      expiresAt,
    })
    const clipRecordId = await ctx.db.insert("clips", {
      userId,
      status: "creating",
      streams: [{ broadcasterId: "1", broadcasterName: "ada" }],
      duration: 30,
      isMultiPov: false,
      createdAt: Date.now(),
    })
    return { tokenId, clipRecordId }
  })
  return { t, ...ids }
}

function twitchMock(clipStatusFor: (token: string | null) => number) {
  return vi.fn<FetchMock>(async (input, options) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.startsWith("https://id.twitch.tv/oauth2/token")) {
      const body = options?.body instanceof URLSearchParams ? options.body : new URLSearchParams()
      if (body.get("grant_type") !== "refresh_token") return new Response("bad", { status: 400 })
      return Response.json({ access_token: "new-access", refresh_token: "new-refresh", expires_in: 14_400 })
    }
    const auth = new Headers(options?.headers).get("Authorization")
    const status = clipStatusFor(auth?.replace("Bearer ", "") ?? null)
    return status === 200
      ? Response.json({ data: [{ id: "clip-1" }] })
      : new Response("unauthorized", { status })
  })
}

async function storedToken(t: ReturnType<typeof initConvexTest>, tokenId: Id<"twitchUserTokens">) {
  return t.run((ctx) => ctx.db.get(tokenId))
}

describe("Twitch user token refresh", () => {
  test("an expired token is refreshed before creating the clip", async () => {
    const { t, tokenId, clipRecordId } = await setup(Date.now() - 1_000)
    const fetchMock = twitchMock((token) => (token === "new-access" ? 200 : 401))
    vi.stubGlobal("fetch", fetchMock)

    const clipId = await t.action(internal.clipActions.createTwitchClip, {
      clipRecordId,
      broadcasterId: "1",
      duration: 30,
    })

    expect(clipId).toBe("clip-1")
    const token = await storedToken(t, tokenId)
    expect(token?.accessToken).toBe("new-access")
    expect(token?.refreshToken).toBe("new-refresh")
    expect(token!.expiresAt).toBeGreaterThan(Date.now())
  })

  test("a 401 on a still-valid token triggers one refresh and a retry", async () => {
    const { t, tokenId, clipRecordId } = await setup(Date.now() + 3_600_000)
    const fetchMock = twitchMock((token) => (token === "new-access" ? 200 : 401))
    vi.stubGlobal("fetch", fetchMock)

    await expect(
      t.action(internal.clipActions.createTwitchClip, { clipRecordId, broadcasterId: "1", duration: 30 }),
    ).resolves.toBe("clip-1")
    expect((await storedToken(t, tokenId))?.accessToken).toBe("new-access")
  })

  test("a revoked refresh token asks the user to reconnect", async () => {
    const { t, clipRecordId } = await setup(Date.now() - 1_000)
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchMock>(async () => new Response("invalid refresh token", { status: 400 })),
    )

    await expect(
      t.action(internal.clipActions.createTwitchClip, { clipRecordId, broadcasterId: "1", duration: 30 }),
    ).rejects.toThrow(/reconnect Twitch/)
  })
})
