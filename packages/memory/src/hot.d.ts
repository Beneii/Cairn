export declare function hotGet<T = unknown>(key: string): T | undefined;
export declare function hotSet(key: string, value: unknown, ttlMs?: number): void;
export declare function hotDelete(key: string): void;
export declare function hotClear(): void;
export declare function hotPurgeExpired(): number;
//# sourceMappingURL=hot.d.ts.map