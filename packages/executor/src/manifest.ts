/**
 * Tool Manifest System
 * 
 * Every tool has a manifest defining its contract, cost, safety tier, and side effects.
 * Tools return structured JSON, never prose.
 */

import { z } from "zod";

// ---- Standard Output Contract ----
// Every tool must return this shape

export const ToolOutputSchema = z.object({
    ok: z.boolean(),
    data: z.unknown().optional(),
    error: z.string().optional(),
    warnings: z.array(z.string()).optional(),
    next_actions: z.array(z.string()).optional(),
});

export type ToolOutput = z.infer<typeof ToolOutputSchema>;

// ---- Cost Hints ----

export type CostHint =
    | "trivial"    // Local computation only
    | "cheap"      // Fast API call or cache hit
    | "medium"     // API call with rate limit concern
    | "expensive"; // Slow API, vision model, or external service

// ---- Side Effects ----

export type SideEffectType =
    | "reads:memory"
    | "writes:memory"
    | "reads:calendar"
    | "writes:calendar"
    | "reads:email"
    | "sends:email"
    | "reads:web"
    | "writes:file"
    | "sends:notification"
    | "sends:message"      // External party
    | "spends:money"
    | "none";

// ---- Safety Tiers ----

export type SafetyTier = "auto" | "notify" | "approve" | "never";

// ---- Tool Manifest ----

export interface ToolManifest<TInput = unknown, TOutput = unknown> {
    // Identity
    name: string;                      // "calendar.list_events"
    description: string;               // Human-readable purpose
    category: string;                  // "calendar", "memory", "web", etc.

    // Schemas (validated before/after execution)
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;

    // Cost & Performance
    costHint: CostHint;
    cacheable: boolean;                // Can results be cached?
    cacheTTLSeconds?: number;          // How long to cache

    // Safety
    safetyTier: SafetyTier;
    sideEffects: SideEffectType[];
    requiresApprovalReason?: string;   // Why approval is needed

    // Execution
    handler: ToolHandler<TInput, TOutput>;
}

// ---- Tool Handler ----

export interface ToolContext {
    jobId: string;
    goalId?: string;
    nodeName: string;
    memoryRead: (tier: string, key: string) => unknown | undefined;
    memoryWrite: (tier: string, key: string, value: unknown) => Promise<void>;
}

export type ToolHandler<TInput, TOutput> = (
    input: TInput,
    ctx: ToolContext
) => Promise<ToolOutput & { data?: TOutput }>;

// ---- Registry ----

const manifests = new Map<string, ToolManifest>();

export function registerTool<TInput, TOutput>(
    manifest: ToolManifest<TInput, TOutput>
): void {
    if (manifests.has(manifest.name)) {
        console.warn(`[tools] Overwriting tool: ${manifest.name}`);
    }
    manifests.set(manifest.name, manifest as ToolManifest);
    console.log(`[tools] Registered: ${manifest.name} (${manifest.safetyTier})`);
}

export function getTool(name: string): ToolManifest | undefined {
    return manifests.get(name);
}

export function getAllTools(): ToolManifest[] {
    return Array.from(manifests.values());
}

export function getToolsByCategory(category: string): ToolManifest[] {
    return getAllTools().filter(t => t.category === category);
}

export function getToolsBySafetyTier(tier: SafetyTier): ToolManifest[] {
    return getAllTools().filter(t => t.safetyTier === tier);
}

// ---- Execution ----

export interface ExecuteResult {
    ok: boolean;
    output: ToolOutput;
    manifest: ToolManifest;
    durationMs: number;
    cached: boolean;
    approvalRequired: boolean;
}

export async function executeTool(
    name: string,
    input: unknown,
    ctx: ToolContext
): Promise<ExecuteResult> {
    const manifest = getTool(name);

    if (!manifest) {
        return {
            ok: false,
            output: { ok: false, error: `Unknown tool: ${name}` },
            manifest: undefined as unknown as ToolManifest,
            durationMs: 0,
            cached: false,
            approvalRequired: false,
        };
    }

    // Validate input
    const inputResult = manifest.inputSchema.safeParse(input);
    if (!inputResult.success) {
        return {
            ok: false,
            output: {
                ok: false,
                error: `Invalid input: ${inputResult.error.message}`,
                warnings: inputResult.error.issues.map(i => i.message),
            },
            manifest,
            durationMs: 0,
            cached: false,
            approvalRequired: false,
        };
    }

    // Check if approval required
    if (manifest.safetyTier === "approve" || manifest.safetyTier === "never") {
        return {
            ok: false,
            output: {
                ok: false,
                error: manifest.safetyTier === "never"
                    ? `Tool "${name}" is never allowed without human action`
                    : `Tool "${name}" requires approval`,
                warnings: manifest.requiresApprovalReason
                    ? [manifest.requiresApprovalReason]
                    : undefined,
            },
            manifest,
            durationMs: 0,
            cached: false,
            approvalRequired: true,
        };
    }

    // Execute
    const start = Date.now();
    try {
        const output = await manifest.handler(inputResult.data, ctx);

        // Validate output
        const outputResult = ToolOutputSchema.safeParse(output);
        if (!outputResult.success) {
            console.error(`[tools] Tool ${name} returned invalid output:`, outputResult.error);
        }

        return {
            ok: output.ok,
            output,
            manifest,
            durationMs: Date.now() - start,
            cached: false,
            approvalRequired: false,
        };
    } catch (err) {
        return {
            ok: false,
            output: {
                ok: false,
                error: err instanceof Error ? err.message : "Unknown error",
            },
            manifest,
            durationMs: Date.now() - start,
            cached: false,
            approvalRequired: false,
        };
    }
}

// ---- Tool Discovery (for LLM) ----

export interface ToolDescription {
    name: string;
    description: string;
    category: string;
    costHint: CostHint;
    safetyTier: SafetyTier;
    inputSchema: Record<string, unknown>;
}

export function describeTools(): ToolDescription[] {
    return getAllTools().map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
        costHint: t.costHint,
        safetyTier: t.safetyTier,
        inputSchema: JSON.parse(JSON.stringify(t.inputSchema)),
    }));
}
