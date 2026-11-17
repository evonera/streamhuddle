import { emptyStreamerData } from "@convex/streamerData"
import type { StreamerData } from "@convex/streamerData"

import { proxyHeaders } from "./server-proxy"

export async function requestStreamerProfile(
  request: Request,
  username: string,
): Promise<StreamerData> {
  if (!/^[a-zA-Z0-9_]{1,25}$/.test(username)) return emptyStreamerData("not-found")
  const headers = proxyHeaders(request)
  const siteUrl = process.env.VITE_CONVEX_SITE_URL
  if (!headers || !siteUrl) return emptyStreamerData("unavailable")
  // No browser cookies or unrelated request headers are needed by this relay.
  const relayHeaders = new Headers({
    "x-streamhuddle-auth-proxy": headers.get("x-streamhuddle-auth-proxy")!,
    "x-streamhuddle-client-ip": headers.get("x-streamhuddle-client-ip")!,
  })
  const url = new URL("/streamer-profile", siteUrl)
  url.searchParams.set("username", username.toLowerCase())
  try {
    for (let attempt = 0; attempt < 13; attempt++) {
      const response = await fetch(url, {
        headers: relayHeaders,
        signal: AbortSignal.timeout(30_000),
      })
      if (response.status === 202) {
        // Another instance owns the durable cache lease. Poll the same cache
        // rather than issuing a second set of Twitch requests.
        await new Promise((resolve) => setTimeout(resolve, 2_000))
        continue
      }
      if (response.status === 429) return emptyStreamerData("rate-limited")
      if (!response.ok) return emptyStreamerData("unavailable")
      return response.json() as Promise<StreamerData>
    }
  } catch (error) {
    console.error("Streamer profile request failed", error)
  }
  return emptyStreamerData("unavailable")
}
