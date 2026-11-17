import { getToken as getConvexToken } from "@convex-dev/better-auth/utils"

import { proxyHeaders } from "./server-proxy"

/** SSR must use the same trusted boundary as browser auth, not a public bucket. */
export async function requestAuthToken(request: Request, convexSiteUrl: string) {
  const headers = proxyHeaders(request)
  if (!headers) throw new Error("Auth proxy is not configured")
  headers.delete("content-length")
  headers.delete("transfer-encoding")
  headers.delete("connection")
  headers.set("accept-encoding", "identity")
  return (await getConvexToken(convexSiteUrl, headers)).token
}
