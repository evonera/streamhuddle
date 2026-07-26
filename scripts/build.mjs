import { execSync } from "child_process";
import fs from "fs";
import path from "path";

console.log("🚀 Starting build…");
try {
  // 1. Run Vite build
  execSync("npx vite build", { stdio: "inherit" });

  // 2. Prepare Cloudflare Pages output directory structure
  console.log("📦 Structuring output for Cloudflare Pages...");
  const distDir = path.resolve("dist");
  const tmpDir = path.resolve("dist-tmp");
  
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir);

  // Move client assets to the root of the output directory
  fs.renameSync(path.join(distDir, "client"), tmpDir);

  // Move server build to _worker.js directory
  const workerDir = path.join(tmpDir, "_worker.js");
  fs.renameSync(path.join(distDir, "server"), workerDir);

  // 3. Create Cloudflare Pages entrypoint with static asset fallback
  const workerEntry = `
import server from "./server.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Only fetch from ASSETS if the URL has a file extension (static assets).
    // This prevents Cloudflare Pages' SPA fallback from swallowing SSR routes and API calls.
    const hasExtension = /\\.[a-zA-Z0-9]+$/.test(url.pathname);
    
    if (hasExtension) {
      try {
        const assetResponse = await env.ASSETS.fetch(request);
        if (assetResponse.status !== 404) {
          return assetResponse;
        }
      } catch (err) {
        // Ignore errors from asset fetch
      }
    }

    // Pass environment variables to globalThis so they are accessible 
    // via process.env polyfills if needed (e.g., Better Auth).
    Object.assign(globalThis, env);
    if (!globalThis.process) {
      globalThis.process = { env: env };
    } else if (!globalThis.process.env) {
      globalThis.process.env = env;
    } else {
      Object.assign(globalThis.process.env, env);
    }

    // Fallback to SSR
    return server.fetch(request, env, ctx);
  }
};
`;
  fs.writeFileSync(path.join(workerDir, "index.js"), workerEntry.trim());

  // 4. Replace dist with the restructured output
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.renameSync(tmpDir, distDir);

  console.log("✅ Build complete. Output structured for Cloudflare Pages.");
  process.exit(0);
} catch (err) {
  console.error("❌ Build failed:", err);
  process.exit(1);
}
