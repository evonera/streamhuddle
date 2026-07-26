export function getEnv(key: string): string | undefined {
  // Use bracket notation to prevent Vite/esbuild from statically replacing process.env.VAR_NAME
  const p = globalThis['process'] as any;
  if (p && p.env) {
    return p.env[key];
  }
  return (globalThis as any)[key];
}
