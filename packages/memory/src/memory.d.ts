import type { MemoryTier } from "@cairn/shared";
export interface MemoryAccess {
    read: MemoryTier[];
    write: ("hot" | "warm")[];
}
export declare function memoryRead(tier: MemoryTier, key: string, access: MemoryAccess): unknown | undefined;
export declare function memoryWrite(tier: "hot" | "warm", key: string, value: unknown, access: MemoryAccess): Promise<void>;
//# sourceMappingURL=memory.d.ts.map