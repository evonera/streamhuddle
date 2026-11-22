/**
 * Rate Limiting Configuration
 *
 * Uses the @convex-dev/rate-limiter component for application-level rate limiting.
 *
 * Authentication-related rate limiting (sign-in, sign-up, password reset)
 * is handled by Better Auth at the HTTP layer. See convex/auth.ts.
 *
 * @see https://www.convex.dev/components/rate-limiter
 */

import type { GenericCtx } from "@convex-dev/better-auth"
import { requireRunMutationCtx } from "@convex-dev/better-auth/utils"
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter"

import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import type { MutationCtx } from "./_generated/server"

/**
 * Rate limiter instance using the component.
 * Defines all application rate limits in one place.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  // Anonymous reads on the public HTTP API, keyed by client IP. Sharded for throughput.
  apiRead: {
    kind: "token bucket",
    rate: 100,
    period: MINUTE,
    capacity: 20,
    shards: 2,
  },

  // Authenticated user actions (profile and avatar mutations), keyed by user id.
  userAction: {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },

  // Count upload attempts before accepting bytes, including abandoned requests.
  avatarUpload: {
    kind: "fixed window",
    rate: 6,
    period: HOUR,
    capacity: 6,
  },

  streamerRead: { kind: "token bucket", rate: 20, period: MINUTE, capacity: 20 },
  // Reserve four Helix calls per cache miss. This global budget protects other
  // Twitch features even when callers use many addresses or usernames.
  streamerProvider: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 40 },

  clipJob: { kind: "fixed window", rate: 6, period: HOUR, capacity: 6 },

  // Public view-count increments, keyed by layout id. Caps refresh/view spam
  // at ~30 counted views per layout per minute while keeping counts roughly right.
  viewIncrement: {
    kind: "fixed window",
    rate: 30,
    period: MINUTE,
    capacity: 30,
  },
})

export type RateLimitName =
  | "apiRead"
  | "userAction"
  | "avatarUpload"
  | "viewIncrement"
  | "streamerRead"
  | "streamerProvider"
  | "clipJob"

/** Better Auth supplies the normalized IP/path key and the effective rule.
 * Its default memory store isn't durable; the adapter's read/update fallback
 * isn't atomic. Use the component's transactional consume for every attempt.
 */
export function authRateLimitStorage(ctx: GenericCtx<DataModel>) {
  return {
    get: async (_key: string) => {
      throw new Error("Atomic auth rate-limit consume is required")
    },
    set: async () => {
      throw new Error("Atomic auth rate-limit consume is required")
    },
    consume: async (key: string, rule: { window: number; max: number }) => {
      const result = await rateLimiter.limit(requireRunMutationCtx(ctx), "auth", {
        key,
        // Start a new bucket at its first request. The component otherwise
        // chooses a random initial offset, shortening a new auth window.
        config: {
          kind: "fixed window",
          rate: rule.max,
          capacity: rule.max,
          period: rule.window * 1000,
          start: Date.now(),
        },
      })
      return {
        allowed: result.ok,
        retryAfter: result.retryAfter == null ? null : Math.ceil(result.retryAfter / 1000),
      }
    },
  }
}

/**
 * Apply a rate limit and throw automatically if exceeded.
 */
export async function rateLimitWithThrow(
  ctx: MutationCtx,
  name: RateLimitName,
  key?: string,
  count?: number,
) {
  return rateLimiter.limit(ctx, name, { key, count, throws: true })
}

/**
 * Consume rate limit tokens without throwing.
 * Returns { ok, retryAfter } so HTTP callers can build a 429 response.
 */
export async function consumeLimit(
  ctx: MutationCtx,
  name: RateLimitName,
  key?: string,
  count?: number,
) {
  return rateLimiter.limit(ctx, name, { key, count })
}
