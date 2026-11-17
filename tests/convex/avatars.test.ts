// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { api, internal } from "../../convex/_generated/api"
import { initConvexTest, seedAuthedUser } from "../../convex/test.helpers"

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])
const upload = { method: "POST", headers: { "Content-Type": "image/png" }, body: png }

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("authenticated one-request avatars", () => {
  test("requires a live session before storing any bytes", async () => {
    const t = initConvexTest()
    expect((await t.fetch("/api/avatar", upload)).status).toBe(401)
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([])
  })

  test("attaches and replaces owned uploads; legacy leases do not lock the user out", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    const me = await asUser.query(api.users.getMe, {})
    await t.run((ctx) => ctx.db.patch(me!._id, { avatarUploadPending: true }))
    expect((await asUser.fetch("/api/avatar", upload)).status).toBe(200)
    const first = await t.run((ctx) => ctx.db.get(me!._id))
    expect(first?.avatar).toBeDefined()
    expect((await asUser.query(api.users.getMe, {}))?.hasUploadedAvatar).toBe(true)
    expect((await asUser.fetch("/api/avatar", upload)).status).toBe(200)
    expect(await t.run((ctx) => ctx.db.system.get("_storage", first!.avatar!))).toBeNull()
    expect(await t.run((ctx) => ctx.db.query("avatarUploads").collect())).toEqual([])
    await asUser.mutation(api.users.deleteAvatar, {})
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([])
  })

  test("rejects spoofed types and actual oversize bytes before storage, then permits retry", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    expect((await asUser.fetch("/api/avatar", { ...upload, body: "<svg/>" })).status).toBe(415)
    expect(
      (
        await asUser.fetch("/api/avatar", {
          ...upload,
          headers: { "Content-Type": "image/svg+xml" },
        })
      ).status,
    ).toBe(415)
    expect(
      (
        await asUser.fetch("/api/avatar", {
          ...upload,
          headers: { "Content-Type": "image/png", "Content-Length": "12" },
          body: new Uint8Array(5 * 1024 * 1024 + 1),
        })
      ).status,
    ).toBe(413)
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([])
    expect((await asUser.fetch("/api/avatar", upload)).status).toBe(200)
  })

  test("bounds attempts durably including invalid uploads", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    for (let i = 0; i < 6; i++)
      expect((await asUser.fetch("/api/avatar", { ...upload, body: "bad" })).status).toBe(415)
    const denied = await asUser.fetch("/api/avatar", upload)
    expect(denied.status).toBe(429)
    expect(Number(denied.headers.get("Retry-After"))).toBeGreaterThan(0)
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toEqual([])
  })

  test("expires abandoned reservations and rejects stale or foreign completion", async () => {
    const t = initConvexTest()
    const { asUser: alice } = await seedAuthedUser(t)
    const { asUser: bob } = await seedAuthedUser(t)
    const reservation = await alice.mutation(internal.avatars.beginUpload, {})
    if (reservation.status !== "ready") throw new Error("Expected reservation")
    expect((await alice.mutation(internal.avatars.beginUpload, {})).status).toBe("busy")
    const storageId = await t.run((ctx) =>
      ctx.storage.store(new Blob([png], { type: "image/png" })),
    )
    expect(
      await bob.mutation(internal.avatars.completeUpload, {
        uploadId: reservation.uploadId,
        storageId,
      }),
    ).toBe(false)
    vi.setSystemTime(Date.now() + 121_000)
    const next = await alice.mutation(internal.avatars.beginUpload, {})
    expect(next.status).toBe("ready")
    expect(
      await alice.mutation(internal.avatars.completeUpload, {
        uploadId: reservation.uploadId,
        storageId,
      }),
    ).toBe(false)
    await expect(bob.mutation(api.users.updateAvatar, { storageId })).rejects.toThrow(
      /Reload the page/,
    )
    expect(await t.run((ctx) => ctx.db.system.get("_storage", storageId))).not.toBeNull()
  })

  test("sweeps orphaned blobs beyond the first page without deleting retained avatars", async () => {
    const t = initConvexTest()
    await t.run(async (ctx) => {
      for (let index = 0; index < 100; index++) {
        const avatar = await ctx.storage.store(new Blob([png], { type: "image/png" }))
        await ctx.db.insert("users", { authId: `retained-${index}`, avatar, updatedAt: Date.now() })
      }
    })
    const orphan = await t.run((ctx) => ctx.storage.store(new Blob([png], { type: "image/png" })))
    vi.setSystemTime(Date.now() + 2 * 60 * 60_000)
    await t.mutation(internal.avatars.cleanupOrphans, {})
    await t.finishAllScheduledFunctions(() => vi.runAllTimers())
    expect(await t.run((ctx) => ctx.db.system.get("_storage", orphan))).toBeNull()
    expect(await t.run((ctx) => ctx.db.system.query("_storage").collect())).toHaveLength(100)
  })
})
