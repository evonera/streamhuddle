import { afterEach, expect, test, vi } from "vitest"

import { proxyHeaders } from "../../../src/lib/server-proxy"

afterEach(() => vi.unstubAllEnvs())

test("trusts platform metadata and overwrites all caller-supplied proxy identities", () => {
  vi.stubEnv("AUTH_PROXY_SECRET", "test-secret")
  const request = new Request("https://example.com", {
    headers: {
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "198.51.100.1",
      "x-real-ip": "198.51.100.2",
      "x-streamhuddle-client-ip": "198.51.100.3",
      "x-streamhuddle-auth-proxy": "forged",
      "x-better-auth-forwarded-host": "attacker.example",
      "x-better-auth-forwarded-proto": "http",
    },
  })
  expect(proxyHeaders(request)?.get("x-streamhuddle-client-ip")).toBe("0.0.0.0")
  Object.defineProperty(request, "cf", { value: {} })
  const result = proxyHeaders(request)
  expect(result?.get("x-streamhuddle-client-ip")).toBe("203.0.113.7")
  expect(result?.get("x-streamhuddle-auth-proxy")).toBe("test-secret")
  for (const header of [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "x-better-auth-forwarded-host",
    "x-better-auth-forwarded-proto",
  ])
    expect(result?.has(header)).toBe(false)
})
