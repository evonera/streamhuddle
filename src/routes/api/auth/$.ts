import { createFileRoute } from "@tanstack/react-router"

import { proxyAuthHandler } from "@/lib/auth-server"

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => proxyAuthHandler(request),
      POST: ({ request }) => proxyAuthHandler(request),
    },
  },
})
