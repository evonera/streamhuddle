import { getToken } from "@convex-dev/better-auth/utils"
import { afterEach, expect, test, vi } from "vitest"

import { requestAuthToken } from "../../../src/lib/auth-token.server"

vi.mock("@convex-dev/better-auth/utils", () => ({ getToken: vi.fn<typeof getToken>() }))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

test("SSR token helpers authenticate the proxy and preserve session credentials", async () => {
  vi.stubEnv("AUTH_PROXY_SECRET", "server-only-test-secret")
  vi.mocked(getToken).mockResolvedValue({ isFresh: true, token: "convex-jwt" })
  const request = new Request("https://example.com/profile", {
    headers: {
      cookie: "better-auth.session_token=valid-session",
      "cf-connecting-ip": "203.0.113.9",
      "x-streamhuddle-auth-proxy": "forged",
      "x-streamhuddle-client-ip": "198.51.100.1",
    },
  })
  Object.defineProperty(request, "cf", { value: {} })
  expect(await requestAuthToken(request, "https://test.convex.site")).toBe("convex-jwt")
  const forwarded = vi.mocked(getToken).mock.calls[0][1]
  expect(forwarded.get("cookie")).toContain("valid-session")
  expect(forwarded.get("x-streamhuddle-auth-proxy")).toBe("server-only-test-secret")
  expect(forwarded.get("x-streamhuddle-client-ip")).toBe("203.0.113.9")
  expect(forwarded.has("cf-connecting-ip")).toBe(false)
})
