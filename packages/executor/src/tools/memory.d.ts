/**
 * Memory Tools
 *
 * Read/write to Cairn's memory tiers with proper manifests.
 */
import { z } from "zod";
import { type ToolManifest } from "../manifest.js";
declare const memoryReadInput: z.ZodObject<{
    tier: z.ZodEnum<{
        hot: "hot";
        warm: "warm";
        cold: "cold";
    }>;
    key: z.ZodString;
}, z.core.$strip>;
declare const memoryReadOutput: z.ZodObject<{
    value: z.ZodOptional<z.ZodUnknown>;
    found: z.ZodBoolean;
}, z.core.$strip>;
export declare const memoryRead: ToolManifest<z.infer<typeof memoryReadInput>, z.infer<typeof memoryReadOutput>>;
declare const memoryWriteInput: z.ZodObject<{
    tier: z.ZodEnum<{
        hot: "hot";
        warm: "warm";
    }>;
    key: z.ZodString;
    value: z.ZodUnknown;
}, z.core.$strip>;
declare const memoryWriteOutput: z.ZodObject<{
    written: z.ZodBoolean;
}, z.core.$strip>;
export declare const memoryWrite: ToolManifest<z.infer<typeof memoryWriteInput>, z.infer<typeof memoryWriteOutput>>;
declare const memoryListInput: z.ZodObject<{
    tier: z.ZodEnum<{
        hot: "hot";
        warm: "warm";
        cold: "cold";
    }>;
    prefix: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
declare const memoryListOutput: z.ZodObject<{
    keys: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
export declare const memoryList: ToolManifest<z.infer<typeof memoryListInput>, z.infer<typeof memoryListOutput>>;
export declare function registerMemoryTools(): void;
export {};
//# sourceMappingURL=memory.d.ts.map