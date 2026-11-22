/**
 * One-off teardown for the retired clip-creation feature (phase 1 of 2).
 *
 * Run once per deployment after this code is deployed:
 *   npx convex run clipRemoval:start
 *
 * It (1) cancels any in-flight clip workflows, deletes every stored clip
 * file from R2 and every `clips` row, and (2) revokes each stored Twitch
 * user token at Twitch so the granted clip scopes are withdrawn, then
 * deletes the `twitchUserTokens` rows. Both passes page through their table
 * and reschedule themselves, so they are safe to re-run.
 *
 * Phase 2, in a later deploy once both tables are empty: drop `clips` and
 * `twitchUserTokens` from schema.ts, unmount the r2 and workflow components,
 * delete this file and convex/r2.ts, and remove @convex-dev/r2 and
 * @convex-dev/workflow from package.json.
 */
import { WorkflowManager } from "@convex-dev/workflow"
import type { WorkflowId } from "@convex-dev/workflow"
import { v } from "convex/values"

import { components, internal } from "./_generated/api"
import { internalAction, internalMutation, internalQuery } from "./_generated/server"
import { r2 } from "./r2"

const workflow = new WorkflowManager(components.workflow)
const CLIP_BATCH = 20
const TOKEN_BATCH = 50

export const start = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.clipRemoval.purgeClips, {})
    await ctx.scheduler.runAfter(0, internal.clipRemoval.revokeTwitchTokens, {})
    return null
  },
})

export const purgeClips = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const clips = await ctx.db.query("clips").take(CLIP_BATCH)
    for (const clip of clips) {
      if (clip.workflowId && (clip.status === "creating" || clip.status === "downloading")) {
        try {
          await workflow.cancel(ctx, clip.workflowId as WorkflowId)
        } catch (error) {
          // Already finished or cleaned up; nothing left to cancel.
          console.warn("Could not cancel clip workflow", clip.workflowId, error)
        }
      }
      // Attached keys plus the deterministic ones, which also cover uploads
      // interrupted before the key was recorded on the row.
      const keys = new Set<string>()
      clip.streams.forEach((stream, index) => {
        if (stream.r2Key) keys.add(stream.r2Key)
        keys.add(`clips/${clip._id}/${index}.mp4`)
      })
      for (const key of keys) await r2.deleteObject(ctx, key)
      await ctx.db.delete(clip._id)
    }
    if (clips.length === CLIP_BATCH) {
      await ctx.scheduler.runAfter(0, internal.clipRemoval.purgeClips, {})
    } else {
      console.log("clipRemoval: all clips and clip files removed")
    }
    return clips.length
  },
})

export const tokenBatch = internalQuery({
  args: {},
  returns: v.array(v.object({ _id: v.id("twitchUserTokens"), accessToken: v.string() })),
  handler: async (ctx) => {
    const tokens = await ctx.db.query("twitchUserTokens").take(TOKEN_BATCH)
    return tokens.map((token) => ({ _id: token._id, accessToken: token.accessToken }))
  },
})

export const deleteTokens = internalMutation({
  args: { ids: v.array(v.id("twitchUserTokens")) },
  returns: v.null(),
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      if (await ctx.db.get(id)) await ctx.db.delete(id)
    }
    return null
  },
})

export const revokeTwitchTokens = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const clientId = process.env.TWITCH_CLIENT_ID
    // Without the client id nothing can be revoked; keep the rows for a re-run.
    if (!clientId) throw new Error("TWITCH_CLIENT_ID is required to revoke stored Twitch tokens")
    const tokens = await ctx.runQuery(internal.clipRemoval.tokenBatch, {})
    for (const token of tokens) {
      try {
        // Revoking the access token ends the whole grant, refresh token included.
        // An already-expired token returns 400; either way the row is deleted.
        await fetch("https://id.twitch.tv/oauth2/revoke", {
          method: "POST",
          signal: AbortSignal.timeout(8_000),
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: clientId, token: token.accessToken }),
        })
      } catch (error) {
        console.warn("Twitch token revoke failed; deleting the stored token anyway", error)
      }
    }
    await ctx.runMutation(internal.clipRemoval.deleteTokens, { ids: tokens.map((t) => t._id) })
    if (tokens.length === TOKEN_BATCH) {
      await ctx.scheduler.runAfter(0, internal.clipRemoval.revokeTwitchTokens, {})
    } else {
      console.log("clipRemoval: all stored Twitch tokens revoked and deleted")
    }
    return null
  },
})
