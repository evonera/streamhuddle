import { WorkflowManager, vWorkflowId, vResultValidator } from "@convex-dev/workflow"
import { v } from "convex/values"

import { components, internal } from "./_generated/api"
import { internalMutation } from "./_generated/server"

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: { maxParallelism: 4, retryActionsByDefault: false },
})

export const clipPipeline = workflow.define({
  args: {
    clipRecordId: v.id("clips"),
    broadcasterIds: v.array(v.string()),
    duration: v.number(),
  },
  returns: v.object({ r2Keys: v.array(v.string()) }),
  handler: async (step, args): Promise<{ r2Keys: Array<string> }> => {
    try {
      // Step 1: Create clips on Twitch concurrently
      const clipIds: Array<string> = await Promise.all(
        args.broadcasterIds.map((broadcasterId) =>
          step.runAction(
            internal.clipActions.createTwitchClip,
            { broadcasterId, clipRecordId: args.clipRecordId, duration: args.duration },
            // Twitch has no idempotency key for Create Clip. Retrying an
            // ambiguous POST can create another clip after the first succeeded.
            { retry: false },
          ),
        ),
      )

      // Step 2: Update status to "creating", wait for Twitch processing
      await step.runMutation(internal.clipActions.updateClipStatus, {
        clipRecordId: args.clipRecordId,
        status: "creating",
        clipIds,
      })

      // Twitch processing delay
      await step.sleep(15_000)

      // Step 3: Get download URLs via thumbnail trick
      const downloadUrls: Array<string> = await step.runAction(
        internal.clipActions.getClipDownloadUrlsViaThumbnail,
        { clipIds },
        { retry: { maxAttempts: 3, initialBackoffMs: 3000, base: 2 } },
      )

      // Step 4: Download .mp4 files concurrently and store in R2
      await step.runMutation(internal.clipActions.updateClipStatus, {
        clipRecordId: args.clipRecordId,
        status: "downloading",
      })

      const r2Keys: Array<string> = await step.runAction(
        internal.clipActions.downloadAndStoreInR2,
        { downloadUrls, clipRecordId: args.clipRecordId },
        { retry: { maxAttempts: 2, initialBackoffMs: 5000, base: 2 } },
      )

      // Step 5: Mark as ready
      await step.runMutation(internal.clipActions.updateClipStatus, {
        clipRecordId: args.clipRecordId,
        status: "ready",
        r2Keys,
      })

      return { r2Keys }
    } catch (error) {
      await step.runMutation(internal.clipActions.updateClipStatus, {
        clipRecordId: args.clipRecordId,
        status: "failed",
      })
      throw error
    }
  },
})

export const onClipComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ clipRecordId: v.id("clips"), streamCount: v.number() }),
  },
  returns: v.null(),
  handler: async (ctx, { workflowId, result, context }) => {
    const clip = await ctx.db.get(context.clipRecordId)
    if (result.kind !== "success" || !clip) {
      if (clip) await ctx.db.patch(clip._id, { status: "failed" })
      // Deterministic keys cover interrupted uploads that never reached attach.
      const keys = new Set(
        clip?.streams.flatMap((stream) => (stream.r2Key ? [stream.r2Key] : [])) ?? [],
      )
      for (let index = 0; index < Math.min(context.streamCount, 4); index++) {
        keys.add(`clips/${context.clipRecordId}/${index}.mp4`)
      }
      await ctx.scheduler.runAfter(0, internal.clipActions.cleanupClipFiles, { keys: [...keys] })
    }
    await workflow.cleanup(ctx, workflowId)
    return null
  },
})
