import { WorkflowManager } from "@convex-dev/workflow";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";

export const workflow = new WorkflowManager(components.workflow);

export const clipPipeline = workflow.define({
  args: {
    clipRecordId: v.id("clips"),
    broadcasterId: v.string(),
  },
  handler: async (step, args) => {
    try {
    // Step 1: Create clip on Twitch
    const clipId: string = await step.runAction(
      internal.clipActions.createTwitchClip,
      { broadcasterId: args.broadcasterId },
      { retry: { maxAttempts: 3, initialBackoffMs: 2000, base: 2 } }
    );

    // Step 2: Update status to "creating", wait for Twitch processing
    await step.runMutation(internal.clipActions.updateClipStatus, {
      clipRecordId: args.clipRecordId, 
      status: "creating", 
      clipId,
    });
    
    // Twitch processing delay
    await step.sleep(15_000); 

    // Step 3: Get download URL from Twitch
    const downloadUrl: string = await step.runAction(
      internal.clipActions.getClipDownloadUrl,
      { clipId, broadcasterId: args.broadcasterId },
      { retry: { maxAttempts: 3, initialBackoffMs: 3000, base: 2 } }
    );

    // Step 4: Download .mp4 file and store in R2
    await step.runMutation(internal.clipActions.updateClipStatus, {
      clipRecordId: args.clipRecordId, status: "downloading",
    });

    const r2Key: string = await step.runAction(
      internal.clipActions.downloadAndStoreInR2,
      { downloadUrl },
      { retry: { maxAttempts: 2, initialBackoffMs: 5000, base: 2 } }
    );

    // Step 5: Mark as ready
    await step.runMutation(internal.clipActions.updateClipStatus, {
      clipRecordId: args.clipRecordId, 
      status: "ready",
      r2Key,
    });

    return { r2Key };
    } catch (error) {
      await step.runMutation(internal.clipActions.updateClipStatus, {
        clipRecordId: args.clipRecordId,
        status: "failed",
      });
      throw error;
    }
  },
});
