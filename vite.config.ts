import tailwindcss from "@tailwindcss/vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import contentCollections from "@content-collections/vite"
import { nitro } from "nitro/vite"
import { visualizer } from "rollup-plugin-visualizer"
import { defineConfig, loadEnv } from "vite"
import fs from "fs"
import mdx from "@mdx-js/rollup"
import remarkFrontmatter from "remark-frontmatter"
import remarkMdxFrontmatter from "remark-mdx-frontmatter"

const securityHeaders: Record<string, string> = {
  "strict-transport-security": "max-age=63072000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "cross-origin-opener-policy": "same-origin-allow-popups",
  "cross-origin-resource-policy": "same-origin",
  "origin-agent-cluster": "?1",
}

// Derive CONVEX_SITE_URL from CONVEX_DEPLOYMENT when not set explicitly.
// e.g. "dev:foo" -> "https://foo.convex.site"
function getConvexSiteUrl(deployment: string | undefined) {
  if (!deployment) return undefined
  const projectName = deployment.split(":")[1]
  return `https://${projectName}.convex.site`
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")

  // Parse wrangler.toml for fallback vars (Cloudflare Pages doesn't pass [vars] to build script)
  let wranglerVars: Record<string, string> = {};
  try {
    const wrangler = fs.readFileSync("wrangler.toml", "utf-8");
    const varsMatch = wrangler.match(/\[vars\]([\s\S]*?)(?:\[|$)/);
    if (varsMatch) {
      const varsBlock = varsMatch[1];
      const regex = /([A-Z_]+)\s*=\s*(?:"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)')/g;
      let m;
      while ((m = regex.exec(varsBlock)) !== null) {
        wranglerVars[m[1]] = m[2] || m[3];
      }
    }
  } catch (e) {
    console.warn("⚠️  Failed to read or parse wrangler.toml:", e);
  }

  const convexUrl = env.VITE_CONVEX_URL || wranglerVars.VITE_CONVEX_URL
  const convexSiteUrl = env.VITE_CONVEX_SITE_URL || wranglerVars.VITE_CONVEX_SITE_URL || getConvexSiteUrl(env.CONVEX_DEPLOYMENT)
  const siteUrl = env.VITE_SITE_URL || wranglerVars.VITE_SITE_URL || env.SITE_URL || wranglerVars.SITE_URL || "http://localhost:3000"

  if (!convexUrl) {
    throw new Error("❌ Build failed: VITE_CONVEX_URL is missing. Ensure it is set in env vars or [vars] within wrangler.toml.");
  }

  return {
    server: {
      port: 3000,
      warmup: {
        clientFiles: [
          "./src/router.tsx",
          "./src/routes/**/*.{ts,tsx}",
          "./src/components/**/*.tsx",
          "./src/lib/*.ts",
          "./src/styles.css",
        ],
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
    optimizeDeps: {
      include: [
        "@better-auth/core/db",
        "@better-auth/core/env",
        "@better-auth/core/error",
        "@better-auth/core/utils/db",
        "@better-auth/core/utils/error-codes",
        "@better-auth/core/utils/json",
        "@better-auth/core/utils/string",
        "@better-auth/utils/base64",
        "@better-auth/utils/binary",
        "@better-auth/utils/hmac",
        "@better-fetch/fetch",
        "@noble/hashes/hkdf.js",
        "@noble/hashes/sha2.js",
        "@tanstack/router-core",
        "@tanstack/router-core/ssr/client",
        "defu",
        "jose",
        "nanostores",
        "seroval",
      ],
    },
    ssr: {
      // Prevent AsyncLocalStorage context loss for Better Auth on the server.
      noExternal: ["@convex-dev/better-auth"],
    },
    define: {
      "process.env.VITE_CONVEX_URL": JSON.stringify(convexUrl),
      "process.env.VITE_CONVEX_SITE_URL": JSON.stringify(convexSiteUrl),
      "process.env.CONVEX_SITE_URL": JSON.stringify(convexSiteUrl),
      "process.env.SITE_URL": JSON.stringify(siteUrl),
      "import.meta.env.VITE_CONVEX_URL": JSON.stringify(convexUrl),
      "import.meta.env.VITE_CONVEX_SITE_URL": JSON.stringify(convexSiteUrl),
      "import.meta.env.VITE_SITE_URL": JSON.stringify(siteUrl),
    },
    plugins: [
      {
        enforce: "pre",
        ...mdx({
          remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
        }),
      },
      devtools(),
      contentCollections(),
      tailwindcss(),
      tanstackStart({
        srcDirectory: "src",
        prerender: {
          enabled: true,
          crawlLinks: true,
        },
        sitemap: {
          enabled: true,
          host: siteUrl,
        },
      }),
      viteReact(),
      nitro({
        preset: "cloudflare-pages",
        routeRules: {
          "/**": { headers: securityHeaders },
        },
      }),
      process.env.ANALYZE ? visualizer({
          filename: ".output/stats.html",
          open: true,
          gzipSize: true,
          brotliSize: true,
        }) : undefined,
    ].filter(Boolean) as any,
  }
})
