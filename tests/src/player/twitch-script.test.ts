import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

type TwitchWindow = Window & { Twitch?: { Player: unknown } }

describe("Twitch embed script loading", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    delete (window as TwitchWindow).Twitch
    document.body.replaceChildren()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as TwitchWindow).Twitch
    document.body.replaceChildren()
  })

  test("shares one request across cells and resolves when the API is present", async () => {
    const { loadTwitchScript } = await import("../../../src/components/player/twitch-script")
    const first = loadTwitchScript()
    expect(loadTwitchScript()).toBe(first)
    expect(document.querySelectorAll("script")).toHaveLength(1)
    ;(window as TwitchWindow).Twitch = { Player: function FakePlayer() {} }
    document.querySelector("script")!.dispatchEvent(new Event("load"))
    await expect(first).resolves.toBeUndefined()
  })

  test("allows a fresh attempt after a script network failure", async () => {
    const { loadTwitchScript } = await import("../../../src/components/player/twitch-script")
    const first = loadTwitchScript()
    const rejection = first.catch((error: unknown) => error)
    document.querySelector("script")!.dispatchEvent(new Event("error"))
    expect(await rejection).toMatchObject({ message: "Twitch embed script could not be loaded" })
    expect(document.querySelector("script")).toBeNull()
    const retry = loadTwitchScript()
    expect(retry).not.toBe(first)
    ;(window as TwitchWindow).Twitch = { Player: function FakePlayer() {} }
    document.querySelector("script")!.dispatchEvent(new Event("load"))
    await expect(retry).resolves.toBeUndefined()
  })

  test("times out a request that never fires load or error", async () => {
    const { loadTwitchScript } = await import("../../../src/components/player/twitch-script")
    const request = loadTwitchScript()
    const rejection = request.catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(await rejection).toMatchObject({ message: "Twitch embed script could not be loaded" })
    expect(document.querySelector("script")).toBeNull()
  })

  test("rejects a loaded script that does not supply the Twitch player API", async () => {
    const { loadTwitchScript } = await import("../../../src/components/player/twitch-script")
    const request = loadTwitchScript()
    const rejection = request.catch((error: unknown) => error)
    document.querySelector("script")!.dispatchEvent(new Event("load"))
    expect(await rejection).toMatchObject({ message: "Twitch embed script could not be loaded" })
  })
})
