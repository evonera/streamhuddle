import type { ConvexQueryClient } from "@convex-dev/react-query"
import type { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  useRouteContext,
} from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { lazy, Suspense } from "react"

import { DefaultCatchBoundary } from "@/components/default-catch-boundary"
import { NotFound } from "@/components/not-found"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { WebVitals } from "@/components/web-vitals"
import { getToken } from "@/lib/auth-server"
import { BetterAuthConvexProvider } from "@/lib/convex-auth"
import { seo } from "@/lib/seo"
import {
  AUTHOR_GITHUB,
  AUTHOR_NAME,
  AUTHOR_URL,
  REPO_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from "@/lib/site"

import appCss from "../styles.css?url"

const Devtools = null

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken()
})

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en-US",
      publisher: { "@id": `${SITE_URL}/#person` },
    },
    {
      "@type": "SoftwareSourceCode",
      "@id": `${SITE_URL}/#sourcecode`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      codeRepository: REPO_URL,
      programmingLanguage: ["TypeScript", "TSX", "CSS"],
      runtimePlatform: "Bun",
      license: "https://opensource.org/licenses/MIT",
      author: { "@id": `${SITE_URL}/#person` },
    },
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: AUTHOR_NAME,
      url: AUTHOR_URL,
      sameAs: [AUTHOR_GITHUB],
    },
  ],
}

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
  convexQueryClient: ConvexQueryClient
}>()({
  beforeLoad: async (ctx) => {
    const token = await getAuth()
    if (token) {
      ctx.context.convexQueryClient.serverHttpClient?.setAuth(token)
    }
    return {
      isAuthenticated: !!token,
      token,
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { name: "color-scheme", content: "light dark" },
      { name: "format-detection", content: "telephone=no" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: SITE_NAME },
      // Uncomment and fill in after registering in Google Search Console / Bing Webmaster.
      // { name: "google-site-verification", content: "YOUR_TOKEN" },
      // { name: "msvalidate.01", content: "YOUR_TOKEN" },
      ...seo({
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        image: "/favicon.png",
      }),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // rel=canonical is per-route (links don't dedupe across route heads).
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Fediverse verification: fill in your own profile URL.
      // { rel: "me", href: "https://mastodon.social/@ramonclaudio" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(jsonLd),
      },
    ],
  }),
  errorComponent: DefaultCatchBoundary,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const context = useRouteContext({ from: Route.id })
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <HeadContent />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background focus:ring-2 focus:ring-ring focus:outline-none"
        >
          Skip to content
        </a>
        <BetterAuthConvexProvider
          client={context.convexQueryClient.convexClient}
          initialToken={context.token}
        >
          <ThemeProvider>
            <WebVitals />
            <main id="main">{children}</main>
            <Toaster />
            {Devtools ? (
              <Suspense fallback={null}>
                <Devtools />
              </Suspense>
            ) : null}
          </ThemeProvider>
        </BetterAuthConvexProvider>
        <Scripts />
      </body>
    </html>
  )
}
