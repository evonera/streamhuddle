// @vitest-environment edge-runtime
import { register as registerWorkflow } from "@convex-dev/workflow/test"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { api, components, internal } from "../../convex/_generated/api"
import { r2 } from "../../convex/r2"
import { initConvexTest, seedAuthedUser } from "../../convex/test.helpers"

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function setup() {
  const t = initConvexTest()
  registerWorkflow(t)
  const { asUser } = await seedAuthedUser(t)
  const user = await asUser.query(api.users.getMe, {})
  await t.run(async (ctx) => {
    await ctx.db.insert("twitchUserTokens", {
      userId: user!._id,
      twitchUserId: "1",
      twitchUsername: "ada",
      accessToken: "test-token",
      refreshToken: "refresh",
      scopes: "clips:edit",
      expiresAt: Date.now() + 3_600_000,
    })
    await ctx.db.insert("twitchTokens", {
      token: "test-app-token",
      expiresAt: Date.now() + 3_600_000,
    })
  })
  const metadata = vi.spyOn(r2, "getMetadata").mockResolvedValue(null)
  const store = vi
    .spyOn(r2, "store")
    .mockImplementation(async (_ctx, _file, options) =>
      typeof options === "object" ? options.key! : options!,
    )
  const remove = vi.spyOn(r2, "deleteObject").mockResolvedValue(undefined)
  return { t, asUser, store, remove, metadata }
}

const job = {
  broadcasters: [{ broadcasterId: "1", broadcasterName: "ada" }],
  duration: 30,
  removeWatermark: false,
  layout: "split-screen" as const,
}
type FetchMock = (input: string | URL | Request, options?: RequestInit) => Promise<Response>

describe("clip workflow durability", () => {
  test("successful job reaches ready and cleans completed workflow history", async () => {
    const { t, asUser, store } = await setup()
    const upstream = vi.fn<FetchMock>(async (input, options) => {
      const url = new URL(input instanceof Request ? input.url : input)
      if (options?.method === "POST") return Response.json({ data: [{ id: "clip-one" }] })
      if (url.hostname === "api.twitch.tv")
        return Response.json({
          data: [
            {
              id: "clip-one",
              thumbnail_url: "https://clips.example.com/clip-one-preview-480x272.jpg",
            },
          ],
        })
      return new Response(new Uint8Array([1, 2, 3]))
    })
    vi.stubGlobal("fetch", upstream)
    const clipId = await asUser.mutation(api.clips.createClipJob, job)
    await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    const clip = await t.run((ctx) => ctx.db.get(clipId))
    expect(clip?.status).toBe("ready")
    expect(clip?.streams[0].r2Key).toBe(`clips/${clipId}/0.mp4`)
    expect(store).toHaveBeenCalledTimes(1)
    expect(
      await t.query(components.workflow.workflow.list, {
        order: "desc",
        paginationOpts: { cursor: null, numItems: 20 },
      }),
    ).toMatchObject({ page: [] })
    const before = upstream.mock.calls.length
    expect(
      await t.action(internal.clipActions.downloadAndStoreInR2, {
        clipRecordId: clipId,
        downloadUrls: ["https://clips.example.com/clip-one.mp4"],
      }),
    ).toEqual([`clips/${clipId}/0.mp4`])
    expect(upstream).toHaveBeenCalledTimes(before)
    expect(store).toHaveBeenCalledTimes(1)
  })

  test("an ambiguous create-clip failure is not retried and terminal cleanup runs", async () => {
    const { t, asUser, remove } = await setup()
    const upstream = vi.fn<FetchMock>(async () => {
      throw new Error("Connection lost after provider accepted POST")
    })
    vi.stubGlobal("fetch", upstream)
    const clipId = await asUser.mutation(api.clips.createClipJob, job)
    await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    expect(upstream).toHaveBeenCalledTimes(1)
    expect((await t.run((ctx) => ctx.db.get(clipId)))?.status).toBe("failed")
    expect(remove).toHaveBeenCalledWith(expect.anything(), `clips/${clipId}/0.mp4`)
  })

  test("recovers R2 metadata from an interrupted store without uploading it again", async () => {
    const { t, asUser, store, metadata } = await setup()
    const user = await asUser.query(api.users.getMe, {})
    const clipId = await t.run((ctx) =>
      ctx.db.insert("clips", {
        userId: user!._id,
        status: "downloading",
        streams: [{ broadcasterId: "1", broadcasterName: "ada" }],
        duration: 30,
        isMultiPov: false,
        createdAt: Date.now(),
      }),
    )
    metadata.mockResolvedValue({
      key: `clips/${clipId}/0.mp4`,
      bucket: "test",
      bucketLink: "https://example.com",
      lastModified: new Date().toISOString(),
      link: "https://example.com",
      url: "https://example.com",
    })
    const upstream = vi.fn<FetchMock>()
    vi.stubGlobal("fetch", upstream)
    expect(
      await t.action(internal.clipActions.downloadAndStoreInR2, {
        clipRecordId: clipId,
        downloadUrls: ["https://clips.example.com/one.mp4"],
      }),
    ).toEqual([`clips/${clipId}/0.mp4`])
    expect(store).not.toHaveBeenCalled()
    expect(upstream).not.toHaveBeenCalled()
  })

  test("a failed attempt cannot queue a deletion that removes the successful retry", async () => {
    const { t, asUser, store, remove } = await setup()
    const user = await asUser.query(api.users.getMe, {})
    const clipId = await t.run((ctx) =>
      ctx.db.insert("clips", {
        userId: user!._id,
        status: "downloading",
        streams: [{ broadcasterId: "1", broadcasterName: "ada" }],
        duration: 30,
        isMultiPov: false,
        createdAt: Date.now(),
      }),
    )
    const bytes = new Set<string>()
    const delayedDeletes: Array<string> = []
    remove.mockImplementation(async (_ctx, key) => {
      delayedDeletes.push(key)
    })
    let attempts = 0
    store.mockImplementation(async (_ctx, _file, options) => {
      const key = typeof options === "object" ? options.key! : options!
      bytes.add(key)
      if (++attempts === 1) throw new Error("Metadata synchronization failed")
      return key
    })
    vi.stubGlobal(
      "fetch",
      vi.fn<FetchMock>(async () => new Response(new Uint8Array([1, 2, 3]))),
    )
    await expect(
      t.action(internal.clipActions.downloadAndStoreInR2, {
        clipRecordId: clipId,
        downloadUrls: ["https://clips.example.com/one.mp4"],
      }),
    ).rejects.toThrow(/Metadata synchronization failed/)
    expect(remove).not.toHaveBeenCalled()
    await t.action(internal.clipActions.downloadAndStoreInR2, {
      clipRecordId: clipId,
      downloadUrls: ["https://clips.example.com/one.mp4"],
    })
    for (const key of delayedDeletes) bytes.delete(key)
    expect(bytes.has(`clips/${clipId}/0.mp4`)).toBe(true)
    expect((await t.run((ctx) => ctx.db.get(clipId)))?.streams[0].r2Key).toBe(
      `clips/${clipId}/0.mp4`,
    )
  })

  test("terminal download failure cleans bytes from failed metadata synchronization", async () => {
    const { t, asUser, store, remove } = await setup()
    const upstream = vi.fn<FetchMock>(async (input, options) => {
      if (options?.method === "POST") return Response.json({ data: [{ id: "clip-one" }] })
      if (new URL(input instanceof Request ? input.url : input).hostname === "api.twitch.tv") {
        return Response.json({
          data: [
            { id: "clip-one", thumbnail_url: "https://clips.example.com/one-preview-480x272.jpg" },
          ],
        })
      }
      return new Response(new Uint8Array([1, 2, 3]))
    })
    vi.stubGlobal("fetch", upstream)
    store.mockRejectedValue(new Error("Metadata synchronization failed"))
    const clipId = await asUser.mutation(api.clips.createClipJob, job)
    await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    expect(store).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith(expect.anything(), `clips/${clipId}/0.mp4`)
    expect((await t.run((ctx) => ctx.db.get(clipId)))?.status).toBe("failed")
  })
})
