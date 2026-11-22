export type TwitchEmbedPlayer = {
  pause: () => void
  play: () => void
  setMuted: (muted: boolean) => void
  setQuality: (quality: string) => void
  addEventListener: (event: string, callback: () => void) => void
}

type TwitchApi = {
  Player: {
    new (id: string, options: Record<string, unknown>): TwitchEmbedPlayer
    READY: string
  }
}

export function getTwitchApi(): TwitchApi | undefined {
  return (window as Window & { Twitch?: TwitchApi }).Twitch
}

let scriptPromise: Promise<void> | null = null

/** Share one script request across cells; a failed request can be retried. */
export function loadTwitchScript(): Promise<void> {
  if (getTwitchApi()?.Player) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://player.twitch.tv/js/embed/v1.js"
    const timer = window.setTimeout(() => fail(), 10_000)
    const clear = () => {
      window.clearTimeout(timer)
      script.removeEventListener("load", loaded)
      script.removeEventListener("error", fail)
    }
    const fail = () => {
      clear()
      script.remove()
      reject(new Error("Twitch embed script could not be loaded"))
    }
    const loaded = () => {
      if (!getTwitchApi()?.Player) return fail()
      clear()
      resolve()
    }
    script.addEventListener("load", loaded, { once: true })
    script.addEventListener("error", fail, { once: true })
    document.body.appendChild(script)
  }).catch((error: unknown) => {
    scriptPromise = null
    throw error
  })
  return scriptPromise
}
