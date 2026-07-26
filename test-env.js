export function getEnv(key) {
  const p = globalThis['process'];
  if (p && p.env) {
    return p.env[key];
  }
  return globalThis[key];
}
