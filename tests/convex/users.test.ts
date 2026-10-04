// @vitest-environment edge-runtime
import { ConvexError } from "convex/values"
import { describe, expect, test } from "vitest"

import { api } from "../../convex/_generated/api"
import { initConvexTest, seedAuthedUser } from "../../convex/test.helpers"
import { isAllowedAvatarMetadata } from "../../convex/validators"

describe("auth enforcement on the wrappers", () => {
  test("optionalAuthQuery: getMe returns null when unauthenticated", async () => {
    const t = initConvexTest()
    expect(await t.query(api.users.getMe, {})).toBeNull()
  })

  test("authMutation: updateProfile throws AUTH_1001 when unauthenticated", async () => {
    const t = initConvexTest()
    const err = await t.mutation(api.users.updateProfile, { bio: "hi" }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ConvexError)
    expect((err as ConvexError<{ code: string }>).data.code).toBe("AUTH_1001")
  })

  test("getMe merges Better Auth identity with the app users row", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t, { name: "Ada", email: "ada@example.com" })
    const me = await asUser.query(api.users.getMe, {})
    expect(me).not.toBeNull()
    expect(me?.name).toBe("Ada")
    expect(me?.email).toBe("ada@example.com")
    expect(me?.bio).toBeUndefined()
    expect(me?.avatarUrl).toBeNull()
  })

  test("an identity without a live session is not authenticated", async () => {
    const t = initConvexTest()
    const ghost = t.withIdentity({ subject: "nope", sessionId: "nope" })
    expect(await ghost.query(api.users.getMe, {})).toBeNull()
  })

  test("an expired session is not authenticated", async () => {
    const t = initConvexTest()
    // A real user and session, but the session expired an hour ago.
    const { asUser } = await seedAuthedUser(t, { sessionExpiresAt: Date.now() - 60 * 60 * 1000 })
    expect(await asUser.query(api.users.getMe, {})).toBeNull()
  })
})

describe("updateProfile bio validation", () => {
  test("accepts a bio at the 500-char limit", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    await asUser.mutation(api.users.updateProfile, { bio: "x".repeat(500) })
    const me = await asUser.query(api.users.getMe, {})
    expect(me?.bio).toHaveLength(500)
  })

  test("rejects a bio over 500 chars with VAL_3001 on the bio field", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    const err = await asUser
      .mutation(api.users.updateProfile, { bio: "x".repeat(501) })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ConvexError)
    const data = (err as ConvexError<{ code: string; field?: string }>).data
    expect(data.code).toBe("VAL_3001")
    expect(data.field).toBe("bio")
  })

  test("omitting bio leaves it unchanged", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    await asUser.mutation(api.users.updateProfile, { bio: "temporary" })
    await asUser.mutation(api.users.updateProfile, {})
    const me = await asUser.query(api.users.getMe, {})
    expect(me?.bio).toBe("temporary")
  })

  test("an empty bio clears it", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    await asUser.mutation(api.users.updateProfile, { bio: "temporary" })
    await asUser.mutation(api.users.updateProfile, { bio: "" })
    const me = await asUser.query(api.users.getMe, {})
    expect(me?.bio).toBeUndefined()
  })
})

describe("avatar storage-id handling", () => {
  test("allows supported image formats only when they are under 5 MB", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
      expect(isAllowedAvatarMetadata(5 * 1024 * 1024, type)).toBe(true)
    }
    expect(isAllowedAvatarMetadata(5 * 1024 * 1024 + 1, "image/png")).toBe(false)
    expect(isAllowedAvatarMetadata(100, "image/svg+xml")).toBe(false)
    expect(isAllowedAvatarMetadata(100)).toBe(false)
  })

  test("updateAvatar rejects a storage id whose blob does not exist", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["gone"]))
      await ctx.storage.delete(id)
      return id
    })
    const err = await asUser
      .mutation(api.users.updateAvatar, { storageId })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ConvexError)
    expect((err as ConvexError<{ code: string }>).data.code).toBe("VAL_3001")
  })

})
