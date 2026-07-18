import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";

export const workflow = new WorkflowManager(components.workflow);

export const clipPipeline = workflow.define({
  args: {
    clipRecordId: v.id("clips"),
    broadcasterIds: v.array(v.string()),
    duration: v.number(),
  },
  handler: async (step, args) => {
    try {
    // Step 1: Create clips on Twitch concurrently
    const clipIds: string[] = await Promise.all(
      args.broadcasterIds.map(broadcasterId =>
        step.runAction(
          internal.clipActions.createTwitchClip,
          { broadcasterId, clipRecordId: args.clipRecordId, duration: args.duration },
          { retry: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 } }
        )
      )
    );

    // Step 2: Update status to "creating", wait for Twitch processing
    await step.runMutation(internal.clipActions.updateClipStatus, {
      clipRecordId: args.clipRecordId, 
      status: "creating", 
      clipIds,
    });
    
    // Twitch processing delay
    await step.sleep(15_000); 

    // Step 3: Get download URLs via thumbnail trick
    const downloadUrls: string[] = await step.runAction(
      internal.clipActions.getClipDownloadUrlsViaThumbnail,
      { clipIds },
      { retry: { maxAttempts: 3, initialBackoffMs: 3000, base: 2 } }
    );

    // Step 4: Download .mp4 files concurrently and store in R2
    await step.runMutation(internal.clipActions.updateClipStatus, {
      clipRecordId: args.clipRecordId, status: "downloading",
    });

    const r2Keys: string[] = await step.runAction(
      internal.clipActions.downloadAndStoreInR2,
      { downloadUrls },
      { retry: { maxAttempts: 2, initialBackoffMs: 5000, base: 2 } }
    );

    // Step 5: Mark as ready
    await step.runMutation(internal.clipActions.updateClipStatus, {
      clipRecordId: args.clipRecordId, 
      status: "ready",
      r2Keys,
    });

    return { r2Keys };
    } catch (error) {
      await step.runMutation(internal.clipActions.updateClipStatus, {
        clipRecordId: args.clipRecordId,
        status: "failed",
      });
      throw error;
    }
  },
});
