#!/usr/bin/env node
/**
 * build.mjs — Clean Cloudflare Pages build runner.
 *
 * Strategy:
 * On Cloudflare Pages (CF_PAGES=1), prerendering is disabled in vite.config.ts,
 * so the build is just client + SSR + Nitro bundling. We run it via Vite's
 * createBuilder().buildApp() so we hold the Promise and can call process.exit(0)
 * after everything finishes, preventing any lingering handles from keeping the
 * Node event loop alive.
 *
 * Locally (CF_PAGES unset), prerendering IS enabled, so the same approach
 * works — buildApp() resolves after prerender + sitemap complete, then we exit.
 */

import { createBuilder } from "vite"

async function runBuild() {
  console.log("🚀 Starting build…")
  try {
    const builder = await createBuilder()
    await builder.buildApp()
    console.log("✅ Build complete. Exiting cleanly.")
    // Force-exit to reap any dangling handles (wrangler/workerd, etc.)
    process.exit(0)
  } catch (err) {
    console.error("❌ Build failed:", err)
    process.exit(1)
  }
}

runBuild()
