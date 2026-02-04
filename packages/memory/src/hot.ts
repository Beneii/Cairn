interface HotEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, HotEntry>();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function hotGet<T = unknown>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function hotSet(
  key: string,
  value: unknown,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function hotDelete(key: string): void {
  store.delete(key);
}

export function hotClear(): void {
  store.clear();
}

export function hotPurgeExpired(): number {
  let purged = 0;
  const current = Date.now();
  for (const [key, entry] of store) {
    if (current > entry.expiresAt) {
      store.delete(key);
      purged++;
    }
  }
  return purged;
}
