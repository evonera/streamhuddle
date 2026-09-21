// Module-level registry of live Twitch embed players, keyed by stream id.
// Lets toolbar-level global controls (pause-all / play-all / quality) reach
// players without prop-drilling refs through the grid. Kick/YouTube/Custom
// are plain iframes with no JS API, so global playback controls are
// Twitch-only by platform limitation.

type TwitchEmbed = {
  pause: () => void
  play: () => void
  setMuted: (muted: boolean) => void
  setQuality: (quality: string) => void
}

const players = new Map<string, TwitchEmbed>()

export function registerTwitchPlayer(id: string, player: TwitchEmbed) {
  players.set(id, player)
}

export function unregisterTwitchPlayer(id: string) {
  players.delete(id)
}

export function pauseAllTwitch() {
  players.forEach((p) => {
    try {
      p.pause()
    } catch {
      // ignore detached players
    }
  })
}

export function playAllTwitch() {
  players.forEach((p) => {
    try {
      p.play()
    } catch {
      // ignore detached players
    }
  })
}

export function setAllTwitchQuality(quality: string) {
  players.forEach((p) => {
    try {
      p.setQuality(quality)
    } catch {
      // unavailable quality falls back inside the embed
    }
  })
}

export function twitchPlayerCount() {
  return players.size
}
