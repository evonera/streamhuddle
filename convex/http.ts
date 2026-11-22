import { corsRouter } from "convex-helpers/server/cors"
import { httpRouter } from "convex/server"
import { v } from "convex/values"

import { internal } from "./_generated/api"
import { httpAction, internalMutation } from "./_generated/server"
import { createAuth } from "./auth"
import { uploadAvatar } from "./avatars"
import { resend } from "./email"
import { getAllowedOrigins } from "./origins"
import { consumeLimit } from "./rateLimit"
import { getProfile } from "./streamerProfiles"

// ============================================================================
// Internal mutation for HTTP rate limiting
// ============================================================================

/**
 * Check API rate limit from HTTP actions.
 * Returns ok: true if allowed, ok: false with retryAt if rate limited.
 *
 * Note: Auth-related rate limiting (sign-in, sign-up, password reset) is handled
 * by Better Auth at the HTTP layer. This mutation is for non-auth API endpoints.
 * Exposed as internalMutation since it's only called from httpActions in this file.
 */
export const checkApiRateLimit = internalMutation({
  args: {
    key: v.string(),
    name: v.union(v.literal("apiRead"), v.literal("userAction")),
  },
  returns: v.object({
    ok: v.boolean(),
    retryAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const result = await consumeLimit(ctx, args.name, args.key)
    // The component's retryAfter is a duration (ms until retry), not a timestamp.
    return {
      ok: result.ok,
      retryAt: Date.now() + (result.retryAfter ?? 0),
    }
  },
})

// Create base HTTP router
const http = httpRouter()

http.route({ path: "/streamer-profile", method: "GET", handler: getProfile })

// Better Auth endpoints are reachable through Convex Site as well as the app
// proxy. Require a shared server-only header for browser-facing routes so a
// direct caller cannot select arbitrary rate-limit identities. Only JWKS and
// OIDC discovery stay public; browser and SSR token requests use the app proxy.
const authRequestHandler = httpAction(async (ctx, request) => {
  const path = new URL(request.url).pathname
  const isPublicConvexEndpoint =
    request.method === "GET" &&
    ["/api/auth/convex/jwks", "/api/auth/convex/.well-known/openid-configuration"].includes(path)
  const proxySecret = process.env.AUTH_PROXY_SECRET

  if (!isPublicConvexEndpoint) {
    if (!proxySecret) {
      return new Response("Auth proxy is not configured", { status: 503 })
    }
    if (request.headers.get("x-streamhuddle-auth-proxy") !== proxySecret) {
      return new Response("Unauthorized", { status: 401 })
    }
  }

  const headers = new Headers(request.headers)
  if (headers.get("x-streamhuddle-auth-proxy") !== proxySecret || !proxySecret) {
    headers.delete("x-streamhuddle-client-ip")
    headers.delete("x-better-auth-forwarded-host")
    headers.delete("x-better-auth-forwarded-proto")
  }
  headers.delete("x-streamhuddle-auth-proxy")
  headers.delete("cf-connecting-ip")
  headers.delete("x-forwarded-for")
  headers.delete("x-real-ip")
  headers.delete("x-forwarded-host")
  headers.delete("x-forwarded-proto")
  const originalHost = headers.get("x-better-auth-forwarded-host")
  const originalProto = headers.get("x-better-auth-forwarded-proto")
  if (originalHost) headers.set("x-forwarded-host", originalHost)
  if (originalProto) headers.set("x-forwarded-proto", originalProto)

  return await createAuth(ctx).handler(new Request(request, { headers }))
})

http.route({ pathPrefix: "/api/auth/", method: "GET", handler: authRequestHandler })
http.route({ pathPrefix: "/api/auth/", method: "POST", handler: authRequestHandler })
http.route({
  path: "/.well-known/openid-configuration",
  method: "GET",
  handler: httpAction(async (_ctx, request) =>
    Response.redirect(
      new URL(
        "/api/auth/convex/.well-known/openid-configuration",
        process.env.CONVEX_SITE_URL ?? request.url,
      ),
    ),
  ),
})

// Resend delivery events webhook. Point your Resend dashboard webhook at
// https://<your-project>.convex.site/resend-webhook and set
// RESEND_WEBHOOK_SECRET on the Convex deployment for signature verification.
// Signed events get forwarded to `onEmailEvent` (see convex/email.ts) and
// persisted to the component's `deliveryEvents` table automatically.
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    // Without the secret the component throws during signature verification
    // and Convex serializes the error (module paths included) to the caller.
    // Refuse cleanly so a half-configured deploy never leaks internals.
    if (!process.env.RESEND_WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      })
    }
    try {
      return await resend.handleResendEventWebhook(ctx, req)
    } catch (err) {
      console.error("[resend-webhook] event handling failed", err)
      return new Response(JSON.stringify({ error: "Webhook processing failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    }
  }),
})

import { createDodoWebhookHandler } from "@dodopayments/convex"

http.route({
  path: "/dodopayments-webhook",
  method: "POST",
  handler: process.env.DODO_PAYMENTS_WEBHOOK_SECRET
    ? createDodoWebhookHandler({
        // The adapter reads DODO_PAYMENTS_WEBHOOK_SECRET itself and verifies
        // the raw body before invoking onPayload. Browser redirects grant no access.
        onPayload: async (ctx, payload) => {
          if (payload.type === "payment.succeeded") {
            const payment = payload.data
            const productId = process.env.DODO_PRO_PRODUCT_ID
            if (
              !productId ||
              payment.subscription_id ||
              payment.status !== "succeeded" ||
              !payment.product_cart?.some(
                (item) => item.product_id === productId && item.quantity > 0,
              )
            )
              return
            await ctx.runMutation(internal.payments.recordProPayment, {
              paymentId: payment.payment_id,
              customerId: payment.customer.customer_id,
              productId,
              appUserId:
                typeof payment.metadata.streamhuddle_user_id === "string"
                  ? payment.metadata.streamhuddle_user_id
                  : undefined,
              fullyRefunded:
                payment.refund_status === "full" ||
                payment.refunds.some(
                  (refund) => !refund.is_partial && refund.status === "succeeded",
                ),
            })
            for (const dispute of payment.disputes) {
              await ctx.runMutation(internal.payments.recordProDispute, {
                paymentId: payment.payment_id,
                disputeId: dispute.dispute_id,
                won: dispute.dispute_status === "dispute_won",
                eventAt: payload.timestamp.getTime(),
              })
            }
          } else if (payload.type === "refund.succeeded") {
            // Partial refunds can be goodwill adjustments; reconcile those
            // manually according to the refund policy, without revoking Pro.
            if (!payload.data.is_partial) {
              await ctx.runMutation(internal.payments.recordProRefund, {
                paymentId: payload.data.payment_id,
              })
            }
          } else if (payload.data.payload_type === "Dispute") {
            await ctx.runMutation(internal.payments.recordProDispute, {
              paymentId: payload.data.payment_id,
              disputeId: payload.data.dispute_id,
              won: payload.type === "dispute.won",
              eventAt: payload.timestamp.getTime(),
            })
          }
        },
      })
    : httpAction(
        async () =>
          new Response(JSON.stringify({ error: "Webhook not configured" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
})

// CORS configuration for custom API endpoints. Origins read from `SITE_URL` +
// `TRUSTED_ORIGINS` (see `convex/origins.ts`) so multi-host deploys (Vercel
// + Netlify + custom domain) all reach `/api/*` from the same Convex backend.
const corsConfig = {
  allowedOrigins: getAllowedOrigins(),
  allowCredentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  browserCacheMaxAge: 86400,
}

// Create CORS-enabled router for custom API routes
const cors = corsRouter(http, corsConfig)

cors.route({ path: "/api/avatar", method: "POST", handler: uploadAvatar })

// ============================================================================
// Public API Endpoints (rate limited with CORS)
// ============================================================================

/**
 * Health check endpoint
 * GET /api/health
 */
cors.route({
  path: "/api/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        status: "healthy",
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  }),
})

/**
 * Extract the client IP from x-forwarded-for header.
 * Handles comma-separated lists (proxies add IPs to the list).
 */
function getClientIp(request: Request): string {
  // Check trusted proxies (Cloudflare, Vercel, etc.) only if explicitly configured
  if (process.env.TRUSTED_PROXY === "true") {
    const realIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip")
    if (realIp) return realIp.trim()
  }

  // Fallback to x-forwarded-for rightmost IP (Convex appends client IP here)
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const ips = forwardedFor.split(",")
    return ips[ips.length - 1].trim()
  }
  return "unknown"
}

/**
 * Get public user profile by ID
 * GET /api/users?id=...
 * Rate limited by IP address
 */
cors.route({
  path: "/api/users",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!(await ctx.auth.getUserIdentity())) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }
    const url = new URL(request.url)
    const userId = url.searchParams.get("id")

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Rate limit by client IP (handles x-forwarded-for properly)
    const ip = getClientIp(request)
    const rateLimitResult = await ctx.runMutation(internal.http.checkApiRateLimit, {
      key: `api:${ip}`,
      name: "apiRead",
    })

    if (!rateLimitResult.ok) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAt: rateLimitResult.retryAt,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((rateLimitResult.retryAt - Date.now()) / 1000)),
          },
        },
      )
    }

    // getUser normalizes the id internally and returns null on malformed input
    // or missing record, so we treat both as 404.
    const user = await ctx.runQuery(internal.users.getUser, { userId })

    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }),
})

/**
 * List users with pagination
 * GET /api/users/list?cursor=...&limit=...
 * Rate limited by IP address
 */
cors.route({
  path: "/api/users/list",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!(await ctx.auth.getUserIdentity())) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    }
    const url = new URL(request.url)
    const cursor = url.searchParams.get("cursor") || undefined
    const limit = parseInt(url.searchParams.get("limit") || "20", 10)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return new Response(JSON.stringify({ error: "Limit must be between 1 and 100" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Rate limit by client IP (handles x-forwarded-for properly)
    const ip = getClientIp(request)
    const rateLimitResult = await ctx.runMutation(internal.http.checkApiRateLimit, {
      key: `api:${ip}`,
      name: "apiRead",
    })

    if (!rateLimitResult.ok) {
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded",
          retryAt: rateLimitResult.retryAt,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(Math.ceil((rateLimitResult.retryAt - Date.now()) / 1000)),
          },
        },
      )
    }

    const result = await ctx.runQuery(internal.users.listUsers, { cursor, limit })

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }),
})

// Export the underlying HTTP router (cors.http is the actual HttpRouter)
export default http
