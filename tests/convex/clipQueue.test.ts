// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest"

import { api } from "../../convex/_generated/api"
import { initConvexTest } from "../../convex/test.helpers"

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
