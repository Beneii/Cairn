const store = new Map();
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
export function hotGet(key) {
    const entry = store.get(key);
    if (!entry)
        return undefined;
    if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return undefined;
    }
    return entry.value;
}
export function hotSet(key, value, ttlMs = DEFAULT_TTL_MS) {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
export function hotDelete(key) {
    store.delete(key);
}
export function hotClear() {
    store.clear();
}
export function hotPurgeExpired() {
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
//# sourceMappingURL=hot.js.map