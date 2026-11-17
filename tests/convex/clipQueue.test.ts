// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest"

import { api } from "../../convex/_generated/api"
import { initConvexTest, seedAuthedUser } from "../../convex/test.helpers"

describe("clip queue leaderboards", () => {
  test("keeps an older high-vote clip in the top 100", async () => {
    const t = initConvexTest()
    const creatorId = await t.run((ctx) =>
      ctx.db.insert("creators", { platform: "twitch", username: "leaderboard-test" }),
    )

    const oldHighVoteId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("clipQueue", {
        creatorId,
        submitterName: "Viewer",
        clipUrl: "https://clips.twitch.tv/old-high-vote",
        title: "Older popular clip",
        status: "approved",
        upvotes: 1000,
        createdAt: 1,
      })
      for (let index = 0; index < 100; index++) {
        await ctx.db.insert("clipQueue", {
          creatorId,
          submitterName: "Viewer",
          clipUrl: `https://clips.twitch.tv/recent-${index}`,
          title: "Recent clip",
          status: "approved",
          upvotes: 0,
          createdAt: index + 2,
        })
      }
      return id
    })

    const queue = await t.query(api.clipQueue.getLiveQueue, { creatorId })
    expect(queue[0]?._id).toBe(oldHighVoteId)
    expect(queue).toHaveLength(100)
  })
})

describe("clip queue submission and multi-creator boundaries", () => {
  test("repeated submissions do not alter votes, including after a real upvote", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    const creatorId = await t.run(ctx => ctx.db.insert("creators", { platform: "twitch", username: "queue-owner" }))
    const args = { creatorId, clipUrl: "https://clips.twitch.tv/QueueTest", title: "A clip" }
    const itemId = await asUser.mutation(api.clipQueue.submitClip, args)
    expect(await asUser.mutation(api.clipQueue.submitClip, { ...args, submitterTwitchName: "AnotherName" })).toBe(itemId)
    expect(await asUser.mutation(api.clipQueue.submitClip, args)).toBe(itemId)
    let queue = await asUser.query(api.clipQueue.getLiveQueue, { creatorId })
    expect(queue).toHaveLength(1)
    expect(queue[0].upvotes).toBe(0)
    expect(queue[0].hasVoted).toBe(false)

    await asUser.mutation(api.clipQueue.upvoteClip, { queueItemId: itemId })
    await asUser.mutation(api.clipQueue.submitClip, args)
    queue = await asUser.query(api.clipQueue.getLiveQueue, { creatorId })
    expect(queue[0].upvotes).toBe(1)
    expect(queue[0].hasVoted).toBe(true)
    await asUser.mutation(api.clipQueue.upvoteClip, { queueItemId: itemId })
    expect((await asUser.query(api.clipQueue.getLiveQueue, { creatorId }))[0].upvotes).toBe(0)
  })

  test("a played clip can be resubmitted once and active retries reuse the new entry", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    const creatorId = await t.run(ctx => ctx.db.insert("creators", { platform: "twitch", username: "queue-owner" }))
    const args = { creatorId, clipUrl: "https://twitch.tv/queue-owner/clip/Replayed", title: "Replayed clip" }
    const oldId = await asUser.mutation(api.clipQueue.submitClip, args)
    await t.run(ctx => ctx.db.patch(oldId, { status: "played" }))
    const newId = await asUser.mutation(api.clipQueue.submitClip, args)
    expect(newId).not.toBe(oldId)
    expect(await asUser.mutation(api.clipQueue.submitClip, args)).toBe(newId)
    expect(await asUser.query(api.clipQueue.getLiveQueue, { creatorId })).toHaveLength(1)
  })

  test("a verified submitter cannot rotate chatter names to bypass the account rate limit", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    const me = await asUser.query(api.users.getMe, {})
    await t.run(ctx => ctx.db.patch(me!._id, { role: "admin" }))
    const creatorId = await t.run(ctx => ctx.db.insert("creators", { platform: "twitch", username: "owner" }))
    const args = { creatorId, clipUrl: "https://clips.twitch.tv/RepeatedChatClip", title: "A clip" }
    for (let index = 0; index < 10; index++) {
      await asUser.mutation(api.clipQueue.submitClip, { ...args, submitterTwitchName: `viewer_${index}` })
    }
    await expect(asUser.mutation(api.clipQueue.submitClip, { ...args, submitterTwitchName: "fresh_viewer" })).rejects.toThrow(/RateLimited/)
    expect((await asUser.query(api.clipQueue.getLiveQueue, { creatorId }))[0].upvotes).toBe(0)
  })

  test("duplicate creator IDs do not multiply scores or voter state, while distinct queues still merge", async () => {
    const t = initConvexTest()
    const { asUser } = await seedAuthedUser(t)
    const firstCreator = await t.run(ctx => ctx.db.insert("creators", { platform: "twitch", username: "first" }))
    const secondCreator = await t.run(ctx => ctx.db.insert("creators", { platform: "twitch", username: "second" }))
    const clipUrl = "https://clips.twitch.tv/SharedClip"
    const firstId = await asUser.mutation(api.clipQueue.submitClip, { creatorId: firstCreator, clipUrl, title: "First" })
    await asUser.mutation(api.clipQueue.submitClip, { creatorId: secondCreator, clipUrl, title: "Second" })
    await asUser.mutation(api.clipQueue.upvoteClip, { queueItemId: firstId })
    const single = await asUser.query(api.clipQueue.getLiveQueueMulti, { creatorIds: [firstCreator] })
    const duplicates = await asUser.query(api.clipQueue.getLiveQueueMulti, { creatorIds: Array.from({ length: 30 }, () => firstCreator) })
    expect(duplicates).toEqual(single)
    const merged = await asUser.query(api.clipQueue.getLiveQueueMulti, { creatorIds: [firstCreator, secondCreator] })
    expect(merged).toHaveLength(1)
    expect(merged[0].upvotes).toBe(1)
    expect(merged[0].votedItemId).toBe(firstId)
    const anonymous = await t.query(api.clipQueue.getLiveQueueMulti, { creatorIds: [firstCreator, firstCreator] })
    expect(anonymous[0].upvotes).toBe(1)
    expect(anonymous[0].hasVoted).toBe(false)
    expect(await t.query(api.clipQueue.getLiveQueueMulti, { creatorIds: [] })).toEqual([])
    await expect(t.query(api.clipQueue.getLiveQueueMulti, { creatorIds: Array.from({ length: 31 }, () => firstCreator) })).rejects.toThrow("up to 30")
    await expect(t.mutation(api.clipQueue.submitClip, { creatorId: firstCreator, clipUrl, title: "No auth" })).rejects.toThrow(/AUTH_1001/)
  })
})
