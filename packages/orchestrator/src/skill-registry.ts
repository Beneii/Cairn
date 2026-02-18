/**
 * Skill Registry — Cairn V2
 * 
 * Central registry of all skills. Each skill has:
 * - Strict input/output schemas
 * - A handler function
 * - Cost/safety metadata
 * 
 * Skills are the atomic unit of execution in V2.
 * They bridge to existing tools in packages/executor/src/tools.ts.
 */

import type { SkillManifest } from "@cairn/shared";
import { newId, now, bus } from "@cairn/shared";
import { getSkillMetrics, getAllSkillManifests, initRegistry } from "@cairn/skills";

// ---- Skill Handler Type ----

export type SkillHandler = (
    args: Record<string, any>,
    ctx: SkillContext,
) => Promise<SkillResult>;

export interface SkillContext {
    jobId: string;
    messageId: string;
    memoryRead: (tier: string, key: string) => unknown | undefined;
    memoryWrite: (tier: string, key: string, value: unknown) => Promise<void>;
    maxSkillCalls?: number;
}

export interface SkillResult {
    success: boolean;
    output: string;
    data?: any;
}

// ---- Registry ----

interface RegisteredSkill {
    manifest: SkillManifest;
    handler: SkillHandler;
}

const skills = new Map<string, RegisteredSkill>();
const jobGovernance = new Map<string, { calls: number; inFlight: Set<string> }>();

export function registerSkill(manifest: SkillManifest, handler: SkillHandler): void {
    if (skills.has(manifest.id)) {
        console.warn(`[skill-registry] Overwriting skill: ${manifest.id}`);
    }
    skills.set(manifest.id, { manifest, handler });
    console.log(`[skill-registry] Registered: ${manifest.id}`);
}

export function getSkill(id: string): RegisteredSkill | undefined {
    return skills.get(id);
}

export function getSkillDefinition(id: string): SkillManifest | undefined {
    return skills.get(id)?.manifest;
}

/**
 * List all skills (for classifier context).
 * Returns ONLY id + short description to minimize token usage.
 */
function metricSortKey(skillId: string): { successRate: number; p50: number } {
    try {
        const metrics = getSkillMetrics(skillId);
        if (!metrics || metrics.invocation_count === 0) {
            return { successRate: 0.5, p50: Number.MAX_SAFE_INTEGER };
        }

        return {
            successRate: metrics.success_count / metrics.invocation_count,
            p50: metrics.p50_latency_ms ?? Number.MAX_SAFE_INTEGER,
        };
    } catch {
        return { successRate: 0.5, p50: Number.MAX_SAFE_INTEGER };
    }
}

export function listSkills(): { id: string; description: string; inputSchema: object }[] {
    return Array.from(skills.values())
        .map((s) => ({
            id: s.manifest.id,
            description: s.manifest.description,
            inputSchema: s.manifest.inputSchema,
        }))
        .sort((a, b) => {
            const aKey = metricSortKey(a.id);
            const bKey = metricSortKey(b.id);

            if (bKey.successRate !== aKey.successRate) {
                return bKey.successRate - aKey.successRate;
            }

            if (aKey.p50 !== bKey.p50) {
                return aKey.p50 - bKey.p50;
            }

            return a.id.localeCompare(b.id);
        });
}

/**
 * Validate input arguments against a skill's inputSchema.
 * Returns { valid, missingFields, reason }.
 */
export function validateSkillInput(
    skillId: string,
    args: Record<string, any>,
): { valid: boolean; missingFields?: string[]; reason?: string } {
    const skill = skills.get(skillId);
    if (!skill) {
        return { valid: false, reason: `Skill not found: ${skillId}` };
    }

    const schema = skill.manifest.inputSchema;
    const required = schema.required || [];
    const missing = required.filter((field: string) => args[field] === undefined || args[field] === null || args[field] === "");

    if (missing.length > 0) {
        return {
            valid: false,
            missingFields: missing,
            reason: `Missing required fields: ${missing.join(", ")}`,
        };
    }

    return { valid: true };
}

/**
 * Execute a skill by ID with validated arguments.
 */
export async function executeSkill(
    skillId: string,
    args: Record<string, any>,
    ctx: SkillContext,
): Promise<SkillResult> {
    const skill = skills.get(skillId);
    if (!skill) {
        return { success: false, output: `Skill not found: ${skillId}` };
    }

    // Governance Checks
    if (!skill.manifest.enabled) {
        return { success: false, output: `Skill ${skillId} is disabled by governance policy.` };
    }

    if (skill.manifest.riskLevel === "high") {
        console.warn(`[GOVERNANCE] Executing HIGH RISK skill: ${skillId}`);
        // In verify mode or future phases, we might enforce confirmation here
    }

    const maxSkillCalls = ctx.maxSkillCalls ?? 12;
    const governance = jobGovernance.get(ctx.jobId) || { calls: 0, inFlight: new Set<string>() };

    if (governance.calls >= maxSkillCalls) {
        return {
            success: false,
            output: `Skill ${skillId} blocked: execution budget exceeded for job (${maxSkillCalls}).`,
        };
    }

    if (governance.inFlight.has(skillId)) {
        return {
            success: false,
            output: `Skill ${skillId} blocked: duplicate in-flight invocation for this job.`,
        };
    }

    governance.calls += 1;
    governance.inFlight.add(skillId);
    jobGovernance.set(ctx.jobId, governance);

    const start = Date.now();
    try {
        const result = await skill.handler(args, ctx);
        const durationMs = Date.now() - start;

        bus.emit("log:entry", {
            id: newId(),
            timestamp: now(),
            type: "tool",
            content: `Skill ${skillId} completed in ${durationMs}ms: ${result.success ? "OK" : "FAIL"}`,
        });

        return result;
    } catch (err) {
        const durationMs = Date.now() - start;
        const errorMsg = err instanceof Error ? err.message : String(err);

        bus.emit("log:entry", {
            id: newId(),
            timestamp: now(),
            type: "error",
            content: `Skill ${skillId} failed in ${durationMs}ms: ${errorMsg}`,
        });

        return { success: false, output: `Skill execution error: ${errorMsg}` };
    } finally {
        const tracked = jobGovernance.get(ctx.jobId);
        tracked?.inFlight.delete(skillId);
    }
}

/**
 * Get total number of registered skills.
 */
export function getSkillCount(): number {
    return skills.size;
}

// ---- Bridge: wrap existing tool functions as skill handlers ----

function wrapToolAsSkill(toolFn: (args: Record<string, unknown>, ctx: any) => Promise<{ success: boolean; output: string }>): SkillHandler {
    return async (args, ctx) => {
        const toolCtx = {
            jobId: ctx.jobId,
            nodeName: "skill_executor",
            memoryRead: ctx.memoryRead,
            memoryWrite: ctx.memoryWrite,
        };
        const result = await toolFn(args, toolCtx);
        return {
            success: result.success,
            output: result.output,
        };
    };
}

/**
 * Initialize the skill registry with default skills.
 * Bridges existing tools from @cairn/executor into the V2 skill system.
 */
export async function initSkillRegistry(): Promise<void> {
    // Initialize the central registry (loads default manifests)
    initRegistry();

    // Dynamic import of existing tool registry (ESM-compatible)
    const { getTool: getExistingTool } = await import("@cairn/executor");

    // Get authoritative manifests from @cairn/skills
    const manifests = getAllSkillManifests();

    // Map old tool names to new skill IDs (for legacy bridge)
    // In Phase 1, we manually map them based on our known DEFAULT_SKILLS migration
    const skillIdToToolName: Record<string, string> = {
        "task.create": "tasks_create",
        "task.read": "tasks_read",
        "task.complete": "tasks_complete",
        "calendar.read": "calendar_read",
        "web.search": "web_search",
        "web.fetch": "fetch_url",
        "memory.read": "memory_read",
        "memory.write": "memory_write",
        "note.create": "note_create",
        "goal.read": "goals_read",
        "goal.update": "goals_update",
        "vector.search": "vector_search",
        "email.read": "gmail_read",
        "research.ingest": "research_ingest",
        "weather.get": "weather_get",
        "system.model_pull": "model_pull",
    };

    for (const manifest of manifests) {
        // Skip if disabled (though registerSkill check would catch it too, but cleaner to skip registration)
        // Actually, we should register it but executeSkill will block it. 
        // But if we don't have a handler, we can't really register it fully.

        const toolName = skillIdToToolName[manifest.id];

        if (!toolName) {
            console.warn(`[skill-registry] No backing tool mapped for skill "${manifest.id}"`);
            continue;
        }

        const toolFn = getExistingTool(toolName);
        if (toolFn) {
            registerSkill(manifest, wrapToolAsSkill(toolFn));
        } else {
            // Register with a "tool not available" handler
            registerSkill(manifest, async () => ({
                success: false,
                output: `Skill ${manifest.id} backing tool "${toolName}" not available.`,
            }));
            console.warn(`[skill-registry] Tool "${toolName}" not found for skill "${manifest.id}"`);
        }
    }

    console.log(`[skill-registry] Initialized with ${skills.size} skills`);
}

/**
 * Lazy initialization (called once at first use).
 */
let initialized = false;
let initPromise: Promise<void> | null = null;
export async function ensureSkillRegistry(): Promise<void> {
    if (initialized) return;
    if (!initPromise) {
        initPromise = initSkillRegistry().then(() => { initialized = true; });
    }
    await initPromise;
}
