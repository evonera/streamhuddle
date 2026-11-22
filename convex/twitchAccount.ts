import { v } from "convex/values"

import { components } from "./_generated/api"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { optionalAuthQuery } from "./functions"

/**
 * The Twitch user id linked to a Better Auth user through "Continue with
 * Twitch" (sign-in or account linking), or null. Better Auth stores it as an
 * `account` row whose `accountId` is the Twitch user id, so no Twitch tokens
 * need to be kept by the app to prove channel ownership.
 */
export async function getLinkedTwitchId(
  ctx: QueryCtx | MutationCtx,
  authId: string,
): Promise<string | null> {
  const account: { accountId?: unknown } | null = await ctx.runQuery(
    components.betterAuth.adapter.findOne,
    {
      model: "account",
      where: [
        { field: "userId", value: authId },
        { field: "providerId", value: "twitch" },
      ],
    },
  )
  return typeof account?.accountId === "string" ? account.accountId : null
}

/** The signed-in viewer's linked Twitch user id, for streamer-only controls. */
export const getMyTwitchAccount = optionalAuthQuery({
  args: {},
  returns: v.union(v.object({ twitchUserId: v.string() }), v.null()),
  handler: async (ctx) => {
    if (!ctx.user) return null
    const twitchUserId = await getLinkedTwitchId(ctx, ctx.user.authId)
    return twitchUserId ? { twitchUserId } : null
  },
})
