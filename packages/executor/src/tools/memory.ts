/**
 * Memory Tools
 * 
 * Read/write to Cairn's memory tiers with proper manifests.
 */

import { z } from "zod";
import { registerTool, type ToolManifest } from "../manifest.js";

// ---- memory.read ----

const memoryReadInput = z.object({
    tier: z.enum(["hot", "warm", "cold"]),
    key: z.string().min(1),
});

const memoryReadOutput = z.object({
    value: z.unknown().optional(),
    found: z.boolean(),
});

export const memoryRead: ToolManifest<
    z.infer<typeof memoryReadInput>,
    z.infer<typeof memoryReadOutput>
> = {
    name: "memory.read",
    description: "Read a value from memory by tier and key",
    category: "memory",
    inputSchema: memoryReadInput,
    outputSchema: memoryReadOutput,
    costHint: "trivial",
    cacheable: false,
    safetyTier: "auto",
    sideEffects: ["reads:memory"],

    handler: async (input, ctx) => {
        const value = ctx.memoryRead(input.tier, input.key);
        return {
            ok: true,
            data: {
                value,
                found: value !== undefined,
            },
        };
    },
};

// ---- memory.write ----

const memoryWriteInput = z.object({
    tier: z.enum(["hot", "warm"]), // Can't write to cold
    key: z.string().min(1),
    value: z.unknown(),
});

const memoryWriteOutput = z.object({
    written: z.boolean(),
});

export const memoryWrite: ToolManifest<
    z.infer<typeof memoryWriteInput>,
    z.infer<typeof memoryWriteOutput>
> = {
    name: "memory.write",
    description: "Write a value to hot or warm memory",
    category: "memory",
    inputSchema: memoryWriteInput,
    outputSchema: memoryWriteOutput,
    costHint: "trivial",
    cacheable: false,
    safetyTier: "auto",
    sideEffects: ["writes:memory"],

    handler: async (input, ctx) => {
        await ctx.memoryWrite(input.tier, input.key, input.value);
        return {
            ok: true,
            data: { written: true },
        };
    },
};

// ---- memory.list ----

const memoryListInput = z.object({
    tier: z.enum(["hot", "warm", "cold"]),
    prefix: z.string().optional(),
});

const memoryListOutput = z.object({
    keys: z.array(z.string()),
});

export const memoryList: ToolManifest<
    z.infer<typeof memoryListInput>,
    z.infer<typeof memoryListOutput>
> = {
    name: "memory.list",
    description: "List keys in a memory tier, optionally filtered by prefix",
    category: "memory",
    inputSchema: memoryListInput,
    outputSchema: memoryListOutput,
    costHint: "trivial",
    cacheable: false,
    safetyTier: "auto",
    sideEffects: ["reads:memory"],

    handler: async (_input, _ctx) => {
        // TODO: Implement list functionality in memory module
        return {
            ok: true,
            data: { keys: [] },
            warnings: ["memory.list not fully implemented yet"],
        };
    },
};

// ---- Register all ----

export function registerMemoryTools(): void {
    registerTool(memoryRead);
    registerTool(memoryWrite);
    registerTool(memoryList);
}
