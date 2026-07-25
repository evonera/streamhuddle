#!/usr/bin/env node
/**
 * build.mjs — Clean Cloudflare Pages build runner.
 *
 * Why this exists:
 * TanStack Start's prerenderer (prerenderWithVite) spins up a Vite preview
 * server, which under the `cloudflare-pages` Nitro preset spawns
 * `wrangler pages dev` (and its child `workerd` V8 runtime). Even after
 * all pages are crawled and the sitemap is written, those child processes
 * keep Node's event loop alive. `vite build` therefore never exits on its
 * own, causing Cloudflare Pages CI builds to hang until the 20-minute
 * timeout kicks in.
 *
 * Fix: invoke Vite's JS API so we hold a reference to the resolved Promise.
 * After `await build()` resolves (meaning every plugin's `closeBundle()` hook
 * has fired and prerendering + sitemap are fully written), we call
 * `process.exit(0)`. This immediately terminates the entire process group,
 * cleaning up wrangler/workerd handles without needing pkill or any patches.
 *
 * References:
 * - CF_PAGES=1 is injected by Cloudflare Pages into every build environment.
 * - process.exit(0) after Vite's build() resolves is safe because all output
 *   files have already been flushed to disk by that point.
 */

import { build } from "vite"

async function runBuild() {
  console.log("🚀 Starting build…")
  try {
    await build()
    console.log("✅ Build + prerender complete. Exiting cleanly.")
    // Force-exit to reap dangling wrangler/workerd preview handles that
    // would otherwise keep the event loop alive indefinitely.
    process.exit(0)
  } catch (err) {
    console.error("❌ Build failed:", err)
    process.exit(1)
  }
}

runBuild()
