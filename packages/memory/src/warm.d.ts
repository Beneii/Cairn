import * as Automerge from "@automerge/automerge";
export declare function initWarmMemory(): Promise<void>;
export declare function warmGet<T = unknown>(key: string): T | undefined;
export declare function warmSet(key: string, value: any): Promise<void>;
export declare function warmDelete(key: string): Promise<void>;
export declare function warmGetAll(): Record<string, any>;
export declare function getRawDoc(): Automerge.Doc<Record<string, any>>;
export declare function mergeChanges(binary: Uint8Array): Promise<void>;
//# sourceMappingURL=warm.d.ts.map