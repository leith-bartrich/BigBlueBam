import { countRealSuperusers } from './auth.service.js';

const CACHE_TTL_MS = 30_000;

let cachedValue: boolean | null = null;
let cachedAt = 0;

export async function isBootstrapRequired(): Promise<boolean> {
  const now = Date.now();
  if (cachedValue !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedValue;
  }
  const count = await countRealSuperusers();
  cachedValue = count === 0;
  cachedAt = now;
  return cachedValue;
}

export function invalidateBootstrapRequiredCache(): void {
  cachedValue = null;
  cachedAt = 0;
}
