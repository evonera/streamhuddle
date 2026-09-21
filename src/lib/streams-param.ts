export type ParsedStreamRef = {
  platform: "twitch" | "kick" | "youtube" | "custom"
  channel: string
  displayName: string
}

/**
 * Parse a `?streams=` instant-watch param: comma-separated entries of the form
 * `platform:value` (e.g. `twitch:xqc`, `kick:adinross`, `youtube:VIDEO_ID`,
 * `custom:https://example.com/embed`) or bare Twitch usernames.
 * Capped at 20 entries.
 */
export function parseStreamsParam(param: string): Array<ParsedStreamRef> {
  return param
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((entry) => {
      // Custom URLs contain colons (https://...), so match the prefix first
      // instead of splitting on every colon.
      if (entry.toLowerCase().startsWith("custom:")) {
        const channel = entry.slice("custom:".length).trim()
        if (!channel) return null
        return { platform: "custom" as const, channel, displayName: channel }
      }
      const [maybePlatform, ...rest] = entry.split(":")
      const hasPlatform = rest.length > 0 && ["twitch", "kick", "youtube"].includes(maybePlatform.toLowerCase())
      if (hasPlatform) {
        const platform = maybePlatform.toLowerCase() as "twitch" | "kick" | "youtube"
        const channel = rest.join(":").trim()
        if (!channel) return null
        return { platform, channel, displayName: channel }
      }
      // Bare name = Twitch username
      const channel = entry.replace(/^@/, "")
      if (!channel) return null
      return { platform: "twitch" as const, channel, displayName: channel }
    })
    .filter((x): x is ParsedStreamRef => x !== null)
}

/** Serialize roster/custom picks back into a `?streams=` param (Play Now links). */
export function serializeStreamsParam(
  picks: Array<{ platform: string; username?: string; platformId?: string }>,
): string {
  return picks
    .map((c) => `${c.platform}:${c.platform === "custom" && c.platformId ? c.platformId : (c.username ?? "")}`)
    .filter((s) => !s.endsWith(":"))
    .join(",")
}
