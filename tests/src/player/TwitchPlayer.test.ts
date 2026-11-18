import { createElement } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { TwitchPlayer } from "../../../src/components/player/TwitchPlayer"
import { twitchPlayerCount } from "../../../src/components/player/twitch-registry"

const mocks = vi.hoisted(() => ({ load: vi.fn<() => Promise<void>>(), api: vi.fn<() => unknown>() }))
vi.mock("../../../src/components/player/twitch-script", () => ({
  loadTwitchScript: mocks.load,
  getTwitchApi: mocks.api,
}))

describe("Twitch player recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.load.mockReset()
    mocks.api.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test("shows a useful fallback after script failure and initializes after Retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.load.mockRejectedValueOnce(new Error("blocked")).mockResolvedValue(undefined)
    const player = { setMuted: vi.fn<(muted: boolean) => void>(), setQuality: vi.fn<(quality: string) => void>(), addEventListener: vi.fn<(event: string, callback: () => void) => void>(), play: vi.fn<() => void>(), pause: vi.fn<() => void>() }
    const constructor = vi.fn<() => typeof player>(function () { return player })
    Object.assign(constructor, { READY: "ready" })
    mocks.api.mockReturnValue({ Player: constructor })

    await act(async () => { render(createElement(TwitchPlayer, { channel: "streamer", streamId: "retry-test" })) })
    expect(screen.getByRole("alert").textContent).toContain("Unable to load Twitch")
    expect(screen.getByRole("link", { name: "Watch on Twitch" }).getAttribute("href")).toBe("https://www.twitch.tv/streamer")
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry" })) })
    expect(constructor).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("alert")).toBeNull()
    await act(async () => { player.addEventListener.mock.calls[0][1]() })
    expect(twitchPlayerCount()).toBe(1)
    cleanup()
    expect(twitchPlayerCount()).toBe(0)
  })

  test("shows recovery when the embed never becomes ready", async () => {
    mocks.load.mockResolvedValue(undefined)
    const constructor = vi.fn<() => { addEventListener: (event: string, callback: () => void) => void; setMuted: (muted: boolean) => void; setQuality: (quality: string) => void }>(function () { return { addEventListener: vi.fn<(event: string, callback: () => void) => void>(), setMuted: vi.fn<(muted: boolean) => void>(), setQuality: vi.fn<(quality: string) => void>() } })
    Object.assign(constructor, { READY: "ready" })
    mocks.api.mockReturnValue({ Player: constructor })
    await act(async () => { render(createElement(TwitchPlayer, { channel: "streamer" })) })
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000) })
    expect(screen.getByRole("alert").textContent).toContain("taking too long")
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy()
  })

  test("rejects an unsafe channel without requesting a script or linking it", async () => {
    await act(async () => { render(createElement(TwitchPlayer, { channel: '"><script>' })) })
    expect(screen.getByRole("alert").textContent).toContain("invalid")
    expect(mocks.load).not.toHaveBeenCalled()
    expect(screen.queryByRole("link")).toBeNull()
  })
})
