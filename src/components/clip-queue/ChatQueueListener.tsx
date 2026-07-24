import { useEffect } from "react"
import tmi from "tmi.js"
import { useMutation } from "convex/react"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

/**
 * Extract a Twitch clip URL from a chat message.
 * Supports both clips.twitch.tv/ClipSlug and twitch.tv/channel/clip/ClipSlug formats.
 */
function extractTwitchClipUrl(message: string): string | null {
  const match = message.match(
    /https?:\/\/(?:clips\.twitch\.tv\/|(?:www\.)?twitch\.tv\/\w+\/clip\/)[\w-]+/
  )
  return match ? match[0] : null
}

interface ChatQueueListenerProps {
  channelName: string
  creatorId: Id<"creators">
}

/**
 * Invisible component that connects to a Twitch chat channel via tmi.js
 * and listens for !queue commands. When a viewer types:
 *   !queue https://clips.twitch.tv/FunnyClip123
 * it fires the submitClip mutation to add it to the streamer's clip queue.
 *
 * MUST run client-side — Convex serverless functions cannot hold WebSocket connections.
 */
export function ChatQueueListener({ channelName, creatorId }: ChatQueueListenerProps) {
  const submitClip = useMutation(api.clipQueue.submitClip)

  useEffect(() => {
    const client = new tmi.Client({
      channels: [channelName],
      connection: { reconnect: true },
    })

    client.connect().catch(console.error)

    client.on("message", (_channel, tags, message) => {
      // Only respond to !queue command
      if (!message.toLowerCase().startsWith("!queue")) return

      const url = extractTwitchClipUrl(message)
      if (!url) return

      submitClip({
        creatorId,
        clipUrl: url,
        title: `Clip from ${tags["display-name"] ?? "viewer"}`,
      }).catch((err) => {
        // Silently handle auth errors (viewer not logged in) and rate limits
        console.warn("[ChatQueueListener] Failed to submit clip:", err.message)
      })
    })

    return () => {
      client.disconnect().catch(console.error)
    }
  }, [channelName, creatorId, submitClip])

  return null // Invisible listener component
}
