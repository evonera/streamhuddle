import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start"
import { getRequest } from "@tanstack/react-start/server"
import { ConvexHttpClient } from "convex/browser"
import type { FunctionReference, FunctionReturnType, OptionalRestArgs } from "convex/server"

import { requestAuthToken } from "@/lib/auth-token.server"
import { proxyHeaders } from "@/lib/server-proxy"

// Static member access only: vite.config.ts's define block replaces these
// expressions with literals at build time (dynamic process.env[key] lookups
// would miss the substitution and read the runtime environment instead).
const convexUrl = process.env.VITE_CONVEX_URL
const convexSiteUrl = process.env.VITE_CONVEX_SITE_URL

if (!convexUrl || !convexSiteUrl) {
  throw new Error(
    "VITE_CONVEX_URL and VITE_CONVEX_SITE_URL must be set at build time " +
      "(run setup, or see .env.example). Auth cannot start without them.",
  )
}

export const { handler } = convexBetterAuthReactStart({ convexUrl, convexSiteUrl })

export async function getToken(): Promise<string | undefined> {
  return requestAuthToken(getRequest(), convexSiteUrl!)
}

async function authenticatedClient() {
  const client = new ConvexHttpClient(convexUrl!)
  const token = await getToken()
  if (token !== undefined) client.setAuth(token)
  return client
}

export async function fetchAuthQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgs<Query>
): Promise<FunctionReturnType<Query>> {
  return (await authenticatedClient()).query(query, ...args)
}

export async function fetchAuthMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation,
  ...args: OptionalRestArgs<Mutation>
): Promise<FunctionReturnType<Mutation>> {
  return (await authenticatedClient()).mutation(mutation, ...args)
}

export async function fetchAuthAction<Action extends FunctionReference<"action">>(
  action: Action,
  ...args: OptionalRestArgs<Action>
): Promise<FunctionReturnType<Action>> {
  return (await authenticatedClient()).action(action, ...args)
}

/**
 * Forward browser auth mutations only through the app server. The shared value
 * is a Cloudflare Pages runtime secret and a Convex environment variable; it
 * is never exposed to the browser bundle.
 */
export function proxyAuthHandler(request: Request): Promise<Response> | Response {
  const headers = proxyHeaders(request)
  if (!headers) return new Response("Auth proxy is not configured", { status: 503 })
  return handler(new Request(request, { headers }))
}
