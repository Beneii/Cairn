/**
 * Tool Manifest System
 *
 * Every tool has a manifest defining its contract, cost, safety tier, and side effects.
 * Tools return structured JSON, never prose.
 */
import { z } from "zod";
export declare const ToolOutputSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    data: z.ZodOptional<z.ZodUnknown>;
    error: z.ZodOptional<z.ZodString>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodString>>;
    next_actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type ToolOutput = z.infer<typeof ToolOutputSchema>;
export type CostHint = "trivial" | "cheap" | "medium" | "expensive";
export type SideEffectType = "reads:memory" | "writes:memory" | "reads:calendar" | "writes:calendar" | "reads:email" | "sends:email" | "reads:web" | "writes:file" | "sends:notification" | "sends:message" | "spends:money" | "none";
export type SafetyTier = "auto" | "notify" | "approve" | "never";
export interface ToolManifest<TInput = unknown, TOutput = unknown> {
    name: string;
    description: string;
    category: string;
    inputSchema: z.ZodSchema<TInput>;
    outputSchema: z.ZodSchema<TOutput>;
    costHint: CostHint;
    cacheable: boolean;
    cacheTTLSeconds?: number;
    safetyTier: SafetyTier;
    sideEffects: SideEffectType[];
    requiresApprovalReason?: string;
    handler: ToolHandler<TInput, TOutput>;
}
export interface ToolContext {
    jobId: string;
    goalId?: string;
    nodeName: string;
    memoryRead: (tier: string, key: string) => unknown | undefined;
    memoryWrite: (tier: string, key: string, value: unknown) => Promise<void>;
}
export type ToolHandler<TInput, TOutput> = (input: TInput, ctx: ToolContext) => Promise<ToolOutput & {
    data?: TOutput;
}>;
export declare function registerTool<TInput, TOutput>(manifest: ToolManifest<TInput, TOutput>): void;
export declare function getTool(name: string): ToolManifest | undefined;
export declare function getAllTools(): ToolManifest[];
export declare function getToolsByCategory(category: string): ToolManifest[];
export declare function getToolsBySafetyTier(tier: SafetyTier): ToolManifest[];
export interface ExecuteResult {
    ok: boolean;
    output: ToolOutput;
    manifest: ToolManifest;
    durationMs: number;
    cached: boolean;
    approvalRequired: boolean;
}
export declare function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<ExecuteResult>;
export interface ToolDescription {
    name: string;
    description: string;
    category: string;
    costHint: CostHint;
    safetyTier: SafetyTier;
    inputSchema: Record<string, unknown>;
}
export declare function describeTools(): ToolDescription[];
//# sourceMappingURL=manifest.d.ts.map