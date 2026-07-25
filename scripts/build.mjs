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
 * Why createBuilder() instead of build():
 * Vite's build() JS API only builds the *first* (client) environment and
 * resolves immediately. TanStack Start configures multiple environments
 * (client, ssr, nitro). createBuilder().buildApp() builds ALL of them in
 * sequence — client → ssr → nitro → prerender — and only resolves once
 * every environment's closeBundle hook has completed (including the full
 * prerender + sitemap write).
 *
 * After buildApp() resolves, process.exit(0) terminates the entire process
 * group, cleanly reaping any dangling wrangler/workerd handles without
 * needing pkill or any node_modules patches.
 *
 * References:
 * - Vite Environment API: https://vite.dev/guide/api-environment
 * - CF_PAGES=1 is injected by Cloudflare Pages into every build environment.
 */

import { createBuilder } from "vite"

async function runBuild() {
  console.log("🚀 Starting build…")
  try {
    const builder = await createBuilder()
    await builder.buildApp()
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
