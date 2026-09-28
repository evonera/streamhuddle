import { describe, expect, test } from "vitest"

import { parseStreamsParam, serializeStreamsParam, MAX_GRID_STREAMS } from "../../../src/lib/streams-param"

describe("parseStreamsParam", () => {
  test("parses platform-prefixed entries", () => {
    expect(parseStreamsParam("twitch:xqc,kick:adinross,youtube:VIDEO123")).toEqual([
      { platform: "twitch", channel: "xqc", displayName: "xqc" },
      { platform: "kick", channel: "adinross", displayName: "adinross" },
      { platform: "youtube", channel: "VIDEO123", displayName: "VIDEO123" },
    ])
  })

  test("bare names default to twitch and @ is stripped", () => {
    expect(parseStreamsParam("xqc, @shroud")).toEqual([
      { platform: "twitch", channel: "xqc", displayName: "xqc" },
      { platform: "twitch", channel: "shroud", displayName: "shroud" },
    ])
  })

  test("ignores empties and caps at MAX_GRID_STREAMS", () => {
    const many = Array.from({ length: 35 }, (_, i) => `s${i}`).join(",")
    const parsed = parseStreamsParam(` ,${many}, `)
    expect(parsed).toHaveLength(MAX_GRID_STREAMS)
    expect(parsed[0]).toMatchObject({ platform: "twitch", channel: "s0" })
  })

  test("drops entries with empty channels", () => {
    expect(parseStreamsParam("twitch:,kick:ok")).toEqual([
      { platform: "kick", channel: "ok", displayName: "ok" },
    ])
  })

  test("custom: prefix round-trips full URLs with colons", () => {
    expect(parseStreamsParam("custom:https://example.com/embed/abc")).toEqual([
      { platform: "custom", channel: "https://example.com/embed/abc", displayName: "https://example.com/embed/abc" },
    ])
  })
})

describe("serializeStreamsParam", () => {
  test("round-trips through parse", () => {
    const picks = [
      { platform: "twitch", username: "xqc" },
      { platform: "kick", username: "adinross" },
    ]
    const param = serializeStreamsParam(picks)
    expect(param).toBe("twitch:xqc,kick:adinross")
    expect(parseStreamsParam(param)).toHaveLength(2)
  })

  test("custom picks round-trip through parse", () => {
    const picks = [{ platform: "custom", platformId: "https://example.com/embed/abc" }]
    const param = serializeStreamsParam(picks)
    expect(param).toBe("custom:https%3A%2F%2Fexample.com%2Fembed%2Fabc")
    expect(parseStreamsParam(param)).toEqual([
      { platform: "custom", channel: "https://example.com/embed/abc", displayName: "https://example.com/embed/abc" },
    ])
  })

  test("commas inside custom URLs survive the round-trip", () => {
    const picks = [
      { platform: "custom", platformId: "https://example.com/embed/a,b" },
      { platform: "twitch", username: "xqc" },
    ]
    const parsed = parseStreamsParam(serializeStreamsParam(picks))
    expect(parsed).toEqual([
      { platform: "custom", channel: "https://example.com/embed/a,b", displayName: "https://example.com/embed/a,b" },
      { platform: "twitch", channel: "xqc", displayName: "xqc" },
    ])
  })

  test("readable entries stay unencoded", () => {
    expect(serializeStreamsParam([{ platform: "twitch", username: "xqc" }])).toBe("twitch:xqc")
  })
})
