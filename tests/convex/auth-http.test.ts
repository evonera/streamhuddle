// @vitest-environment edge-runtime
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

import { components } from "../../convex/_generated/api"
import { authRateLimitStorage } from "../../convex/rateLimit"
import { initConvexTest, seedAuthedUser } from "../../convex/test.helpers"

const headers = {
  "Content-Type": "application/json",
  "x-streamhuddle-auth-proxy": "test-proxy-secret",
  "x-streamhuddle-client-ip": "203.0.113.20",
}
const body = JSON.stringify({ email: "missing@example.com", password: "valid-test-password" })

beforeEach(() => {
  vi.stubEnv("AUTH_PROXY_SECRET", "test-proxy-secret")
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-auth-secret-with-at-least-32-characters")
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site")
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("auth proxy boundary", () => {
  test("direct callers cannot authorize themselves with spoofed IP headers or path suffixes", async () => {
    const t = initConvexTest()
    for (const path of [
      "/api/auth/sign-in/email",
      "/api/auth/convex/token",
      "/api/auth/convex/token/extra",
    ]) {
      expect(
        (
          await t.fetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json", "cf-connecting-ip": "198.51.100.1" },
            body,
          })
        ).status,
      ).toBe(401)
    }
  })

  test("rotating forwarded IPs still shares one durable auth bucket across handler instances", async () => {
    const t = initConvexTest()
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await t.fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          ...headers,
          "x-forwarded-for": `198.51.100.${attempt}`,
          "x-real-ip": `198.51.100.${attempt}`,
          "cf-connecting-ip": `198.51.100.${attempt}`,
        },
        body,
      })
      expect(response.status).toBe(401)
    }
    const denied = await t.fetch("/api/auth/sign-in/email", { method: "POST", headers, body })
    expect(denied.status).toBe(429)
    expect(Number(denied.headers.get("X-Retry-After"))).toBeGreaterThan(0)
    expect(
      (
        await t.fetch("/api/auth/sign-in/email", {
          method: "POST",
          headers: { ...headers, "x-streamhuddle-client-ip": "203.0.113.21" },
          body,
        })
      ).status,
    ).toBe(401)
  })

  test("concurrent attempts consume the same transactional budget", async () => {
    const t = initConvexTest()
    const responses = await Promise.all(
      Array.from({ length: 12 }, () =>
        t.fetch("/api/auth/sign-in/email", { method: "POST", headers, body }),
      ),
    )
    expect(responses.filter((response) => response.status === 401)).toHaveLength(5)
    expect(responses.filter((response) => response.status === 429)).toHaveLength(7)
  })

  test("direct token abuse cannot exhaust SSR's trusted token bucket; discovery remains public", async () => {
    const t = initConvexTest()
    for (let i = 0; i < 110; i++) {
      expect(
        (
          await t.fetch("/api/auth/convex/token", {
            headers: { "x-streamhuddle-client-ip": `198.51.100.${i}` },
          })
        ).status,
      ).toBe(401)
    }
    expect((await t.fetch("/api/auth/convex/token", { headers })).status).toBe(401)
    expect((await t.fetch("/api/auth/convex/.well-known/openid-configuration")).status).toBe(200)
    expect((await t.fetch("/.well-known/openid-configuration")).status).toBe(302)
  })

  test("live sessions still resolve and mint Convex tokens through the trusted helper endpoint", async () => {
    const t = initConvexTest()
    const { session } = await seedAuthedUser(t)
    const storedSession = await t.run((ctx) =>
      ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "session",
        where: [{ field: "_id", value: session._id }],
      }),
    )
    const authenticatedHeaders = { ...headers, Authorization: `Bearer ${storedSession.token}` }
    const profile = await t.fetch("/api/auth/get-session", { headers: authenticatedHeaders })
    expect(profile.status).toBe(200)
    expect((await profile.json()).user.emailVerified).toBe(true)
    const token = await t.fetch("/api/auth/convex/token", {
      headers: authenticatedHeaders,
    })
    expect(token.status).toBe(200)
    expect((await token.json()).token).toEqual(expect.any(String))
    expect((await t.fetch("/api/auth/convex/jwks")).status).toBe(200)
  })

  test("the hour-long reset rule remains enforced after a minute", async () => {
    vi.useFakeTimers()
    try {
      const t = initConvexTest()
      const consume = () =>
        t.action((ctx) => authRateLimitStorage(ctx).consume("reset-test", { window: 3600, max: 3 }))
      for (let i = 0; i < 3; i++) expect((await consume()).allowed).toBe(true)
      vi.setSystemTime(Date.now() + 65_000)
      const denied = await consume()
      expect(denied.allowed).toBe(false)
      expect(denied.retryAfter).toBeGreaterThan(60)
      vi.setSystemTime(Date.now() + 3600_000)
      expect((await consume()).allowed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})
