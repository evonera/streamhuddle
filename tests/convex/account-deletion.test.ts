// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest"

import { internal } from "../../convex/_generated/api"
import { initConvexTest, seedAuthedUser } from "../../convex/test.helpers"

describe("account deletion cleanup", () => {
  test("removes app data and updates surviving clip-queue vote totals", async () => {
    const t = initConvexTest()
    const { authUser } = await seedAuthedUser(t)
    const { authUser: otherAuthUser } = await seedAuthedUser(t)
    const appUser = await t.run((ctx) =>
      ctx.db.query("users").withIndex("authId", (q) => q.eq("authId", authUser._id)).unique(),
    )
    const otherAppUser = await t.run((ctx) =>
      ctx.db.query("users").withIndex("authId", (q) => q.eq("authId", otherAuthUser._id)).unique(),
    )
    if (!appUser || !otherAppUser) throw new Error("Seed users were not created")

    const avatar = await t.run((ctx) => ctx.storage.store(new Blob(["avatar"])))
    const { authoredItemId, survivingItemId } = await t.run(async (ctx) => {
      await ctx.db.patch(appUser._id, { avatar })
      const creatorId = await ctx.db.insert("creators", {
        platform: "twitch",
        username: "testcreator",
      })
      await ctx.db.insert("layouts", {
        authId: authUser._id,
        name: "Saved layout",
        streams: [],
      })
      await ctx.db.insert("clips", {
        userId: appUser._id,
        status: "ready",
        streams: [],
        duration: 30,
        isMultiPov: false,
        createdAt: Date.now(),
      })
      await ctx.db.insert("twitchUserTokens", {
        userId: appUser._id,
        twitchUserId: "123",
        twitchUsername: "testcreator",
        accessToken: "access",
        refreshToken: "refresh",
        scopes: "clips:edit",
        expiresAt: Date.now() + 60_000,
      })
      const authoredId = await ctx.db.insert("clipQueue", {
        creatorId,
        submitterId: appUser._id,
        submitterName: "Deleting user",
        clipUrl: "https://clips.twitch.tv/authored",
        title: "Authored item",
        status: "pending",
        upvotes: 1,
        createdAt: Date.now(),
      })
      const survivingId = await ctx.db.insert("clipQueue", {
        creatorId,
        submitterId: otherAppUser._id,
        submitterName: "Another user",
        clipUrl: "https://clips.twitch.tv/survives",
        title: "Surviving item",
        status: "pending",
        upvotes: 2,
        createdAt: Date.now(),
      })
      await ctx.db.insert("clipQueueVotes", { queueItemId: authoredId, userId: otherAppUser._id })
      await ctx.db.insert("clipQueueVotes", { queueItemId: survivingId, userId: appUser._id })
      await ctx.db.insert("clipQueueVotes", { queueItemId: survivingId, userId: otherAppUser._id })
      return { authoredItemId: authoredId, survivingItemId: survivingId }
    })

    await t.mutation(internal.auth.onDelete, { model: "user", doc: authUser })
    for (let attempt = 0; attempt < 10; attempt++) {
      const user = await t.run((ctx) => ctx.db.get(appUser._id))
      if (!user) break
      await t.mutation(internal.auth.cleanupDeletedUserData, {
        userId: appUser._id,
        authId: authUser._id,
      })
    }

    const data = await t.run(async (ctx) => ({
      user: await ctx.db.get(appUser._id),
      layout: await ctx.db.query("layouts").withIndex("by_user", (q) => q.eq("authId", authUser._id)).first(),
      clip: await ctx.db.query("clips").withIndex("by_user", (q) => q.eq("userId", appUser._id)).first(),
      token: await ctx.db.query("twitchUserTokens").withIndex("by_user", (q) => q.eq("userId", appUser._id)).first(),
      authoredItem: await ctx.db.get(authoredItemId),
      survivingItem: await ctx.db.get(survivingItemId),
      votes: await ctx.db.query("clipQueueVotes").collect(),
      avatarMetadata: await ctx.db.system.get("_storage", avatar),
    }))

    expect(data.user).toBeNull()
    expect(data.layout).toBeNull()
    expect(data.clip).toBeNull()
    expect(data.token).toBeNull()
    expect(data.authoredItem).toBeNull()
    expect(data.survivingItem?.upvotes).toBe(1)
    expect(data.votes).toHaveLength(1)
    expect(data.votes[0]?.userId).toBe(otherAppUser._id)
    expect(data.avatarMetadata).toBeNull()
  })

  test("cleans up layouts when the app user row is already missing", async () => {
    const t = initConvexTest()
    const { authUser } = await seedAuthedUser(t)
    const appUser = await t.run((ctx) =>
      ctx.db.query("users").withIndex("authId", (q) => q.eq("authId", authUser._id)).unique(),
    )
    if (!appUser) throw new Error("Seed app user was not created")

    await t.run(async (ctx) => {
      await ctx.db.insert("layouts", { authId: authUser._id, name: "Orphan", streams: [] })
      await ctx.db.delete(appUser._id)
    })
    await t.mutation(internal.auth.onDelete, { model: "user", doc: authUser })
    await t.mutation(internal.auth.cleanupDeletedUserData, { userId: null, authId: authUser._id })

    const layouts = await t.run((ctx) =>
      ctx.db.query("layouts").withIndex("by_user", (q) => q.eq("authId", authUser._id)).collect(),
    )
    expect(layouts).toHaveLength(0)
  })
})
