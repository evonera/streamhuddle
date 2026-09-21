/**
 * Server-only runtime env lookup.
 *
 * Use ONLY inside server functions / server routes (createServerFn handlers,
 * `*.server.ts`, `src/routes/api/**`). Those modules also ship a client stub,
 * so static `process.env.FOO` member access would be replaced at build time by
 * vite.config.ts `define` (or baked as undefined). The dynamic
 * `process.env[key]` lookup below survives bundling untouched and reads the
 * real runtime environment on the server.
 *
 * Never call this from client-rendered code — secrets must not reach the
 * browser. Public config belongs in `import.meta.env.VITE_*` / `src/lib/site.ts`.
 */
export function getEnv(key: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[key]
}
