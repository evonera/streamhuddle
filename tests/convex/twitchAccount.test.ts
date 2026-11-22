// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest"

import { api, components } from "../../convex/_generated/api"
import { initConvexTest, seedAuthedUser } from "../../convex/test.helpers"

async function linkTwitch(t: ReturnType<typeof initConvexTest>, authId: string, twitchUserId: string) {
  const now = Date.now()
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: "account",
        data: { userId: authId, providerId: "twitch", accountId: twitchUserId, createdAt: now, updatedAt: now },
      },
    }),
  )
}

async function seedQueueItem(t: ReturnType<typeof initConvexTest>, submitterId: string) {
  return t.run(async (ctx) => {
    const creatorId = await ctx.db.insert("creators", { platform: "twitch", username: "owner", platformId: "4242" })
    return ctx.db.insert("clipQueue", {
      creatorId,
      submitterId: submitterId as never,
      submitterName: "viewer",
      clipUrl: "https://clips.twitch.tv/SomeClip",
      title: "A clip",
      status: "approved",
      upvotes: 0,
      createdAt: Date.now(),
    })
  })
}

describe("streamer ownership via the Better Auth Twitch account", () => {
  test("the linked Twitch account can moderate its own queue", async () => {
    const t = initConvexTest()
    const { asUser, authUser } = await seedAuthedUser(t)
    const me = await asUser.query(api.users.getMe, {})
    await linkTwitch(t, authUser._id, "4242")
    const itemId = await seedQueueItem(t, me!._id)

    expect(await asUser.query(api.twitchAccount.getMyTwitchAccount, {})).toEqual({ twitchUserId: "4242" })
    await asUser.mutation(api.clipQueue.setClipStatus, { queueItemId: itemId, status: "played" })
    expect((await t.run((ctx) => ctx.db.get(itemId)))?.status).toBe("played")
  })

  test("a different or missing Twitch link cannot moderate", async () => {
    const t = initConvexTest()
    const { asUser, authUser } = await seedAuthedUser(t)
    const { asUser: unlinked } = await seedAuthedUser(t)
    const me = await asUser.query(api.users.getMe, {})
    await linkTwitch(t, authUser._id, "9999")
    const itemId = await seedQueueItem(t, me!._id)

    await expect(asUser.mutation(api.clipQueue.setClipStatus, { queueItemId: itemId, status: "played" })).rejects.toThrow(/Only the streamer/)
    await expect(unlinked.mutation(api.clipQueue.deleteClip, { queueItemId: itemId })).rejects.toThrow(/Only the streamer/)
    expect(await unlinked.query(api.twitchAccount.getMyTwitchAccount, {})).toBeNull()
  })

  test("signed-out viewers have no Twitch account", async () => {
    const t = initConvexTest()
    expect(await t.query(api.twitchAccount.getMyTwitchAccount, {})).toBeNull()
  })
})
