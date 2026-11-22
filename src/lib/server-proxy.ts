import { z } from "zod"

import { getEnv } from "./env"

const ipAddress = z.union([z.ipv4(), z.ipv6()])

export function proxyHeaders(request: Request): Headers | null {
  const secret = getEnv("AUTH_PROXY_SECRET")
  if (!secret) return null
  const headers = new Headers(request.headers)
  headers.delete("x-forwarded-for")
  headers.delete("x-real-ip")
  headers.delete("x-streamhuddle-client-ip")
  headers.delete("x-forwarded-host")
  headers.delete("x-forwarded-proto")
  headers.delete("x-better-auth-forwarded-host")
  headers.delete("x-better-auth-forwarded-proto")
  // Cloudflare's Request.cf is runtime metadata, not an inbound HTTP header.
  // Other runtimes share a conservative bucket instead of trusting callers.
  const candidate = "cf" in request ? request.headers.get("cf-connecting-ip") : null
  const trustedIp = ipAddress.safeParse(candidate)
  headers.set("x-streamhuddle-client-ip", trustedIp.success ? trustedIp.data : "0.0.0.0")
  headers.delete("cf-connecting-ip")
  headers.set("x-streamhuddle-auth-proxy", secret)
  return headers
}
