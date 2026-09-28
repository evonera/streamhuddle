export type ParsedStreamRef = {
  platform: "twitch" | "kick" | "youtube" | "custom"
  channel: string
  displayName: string
}

/** Absolute per-grid cell cap. 30 concurrent embeds is the practical ceiling
 * before RAM/bandwidth collapse; offline roster cells mount no player. */
export const MAX_GRID_STREAMS = 30

/**
 * Parse a `?streams=` instant-watch param: comma-separated entries of the form
 * `platform:value` (e.g. `twitch:xqc`, `kick:adinross`, `youtube:VIDEO_ID`,
 * `custom:https://example.com/embed`) or bare Twitch usernames.
 * Each entry is URI-decoded independently so custom URLs containing commas
 * survive the round-trip (see serializeStreamsParam). Capped at MAX_GRID_STREAMS entries.
 */
export function parseStreamsParam(param: string): Array<ParsedStreamRef> {
  return param
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_GRID_STREAMS)
    .map((rawEntry) => {
      // Decode per-entry (never the whole list): commas inside custom URLs
      // are encoded as %2C by the serializer and only restored here.
      let entry = rawEntry
      try {
        entry = decodeURIComponent(rawEntry)
      } catch {
        // Malformed escape sequences: fall back to the raw entry.
      }
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

/** Serialize roster/custom picks back into a `?streams=` param (Play Now links).
 * Only the value half is URI-encoded, so `twitch:xqc` stays human-readable
 * while commas (or other reserved characters) inside custom URLs cannot
 * corrupt neighbouring entries. */
export function serializeStreamsParam(
  picks: Array<{ platform: string; username?: string; platformId?: string }>,
): string {
  return picks
    .map((c) => {
      const value = c.platform === "custom" && c.platformId ? c.platformId : (c.username ?? "")
      if (!value) return null
      return `${c.platform}:${encodeURIComponent(value)}`
    })
    .filter((s): s is string => s !== null)
    .join(",")
}
