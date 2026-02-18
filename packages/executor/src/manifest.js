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
// ---- Registry ----
const manifests = new Map();
export function registerTool(manifest) {
    if (manifests.has(manifest.name)) {
        console.warn(`[tools] Overwriting tool: ${manifest.name}`);
    }
    manifests.set(manifest.name, manifest);
    console.log(`[tools] Registered: ${manifest.name} (${manifest.safetyTier})`);
}
export function getTool(name) {
    return manifests.get(name);
}
export function getAllTools() {
    return Array.from(manifests.values());
}
export function getToolsByCategory(category) {
    return getAllTools().filter(t => t.category === category);
}
export function getToolsBySafetyTier(tier) {
    return getAllTools().filter(t => t.safetyTier === tier);
}
export async function executeTool(name, input, ctx) {
    const manifest = getTool(name);
    if (!manifest) {
        return {
            ok: false,
            output: { ok: false, error: `Unknown tool: ${name}` },
            manifest: undefined,
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
    }
    catch (err) {
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
export function describeTools() {
    return getAllTools().map(t => ({
        name: t.name,
        description: t.description,
        category: t.category,
        costHint: t.costHint,
        safetyTier: t.safetyTier,
        inputSchema: JSON.parse(JSON.stringify(t.inputSchema)),
    }));
}
//# sourceMappingURL=manifest.js.map