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

import type { SkillDefinition } from "@cairn/shared";
import { newId, now, bus } from "@cairn/shared";

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
}

export interface SkillResult {
    success: boolean;
    output: string;
    data?: any;
}

// ---- Registry ----

interface RegisteredSkill {
    definition: SkillDefinition;
    handler: SkillHandler;
}

const skills = new Map<string, RegisteredSkill>();

export function registerSkill(definition: SkillDefinition, handler: SkillHandler): void {
    if (skills.has(definition.id)) {
        console.warn(`[skill-registry] Overwriting skill: ${definition.id}`);
    }
    skills.set(definition.id, { definition, handler });
    console.log(`[skill-registry] Registered: ${definition.id}`);
}

export function getSkill(id: string): RegisteredSkill | undefined {
    return skills.get(id);
}

export function getSkillDefinition(id: string): SkillDefinition | undefined {
    return skills.get(id)?.definition;
}

/**
 * List all skills (for classifier context).
 * Returns ONLY id + short description to minimize token usage.
 */
export function listSkills(): { id: string; description: string }[] {
    return Array.from(skills.values()).map((s) => ({
        id: s.definition.id,
        description: s.definition.description,
    }));
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

    const schema = skill.definition.inputSchema;
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

// ---- Default Skill Definitions ----

const DEFAULT_SKILLS: { definition: SkillDefinition; toolName: string }[] = [
    {
        toolName: "tasks_create",
        definition: {
            id: "task.create",
            description: "Create a new task for the user.",
            inputSchema: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Task title" },
                    type: { type: "string", enum: ["one-off", "recurring"], description: "Task type" },
                    due_date: { type: "string", description: "Due date (ISO format)" },
                    scheduled_date: { type: "string", description: "Scheduled date (YYYY-MM-DD)" },
                },
                required: ["title"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "trivial",
        },
    },
    {
        toolName: "tasks_read",
        definition: {
            id: "task.read",
            description: "Read current tasks, optionally filtered by status.",
            inputSchema: {
                type: "object",
                properties: {
                    status: { type: "string", enum: ["todo", "done", "archived"], description: "Filter by status" },
                },
                required: [],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "trivial",
        },
    },
    {
        toolName: "tasks_complete",
        definition: {
            id: "task.complete",
            description: "Mark a task as completed.",
            inputSchema: {
                type: "object",
                properties: {
                    task_id: { type: "string", description: "ID of the task to complete" },
                },
                required: ["task_id"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "trivial",
        },
    },
    {
        toolName: "calendar_read",
        definition: {
            id: "calendar.read",
            description: "Read calendar events for the next N days.",
            inputSchema: {
                type: "object",
                properties: {
                    days: { type: "number", description: "Number of days to look ahead (default 1)" },
                },
                required: [],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "cheap",
        },
    },
    {
        toolName: "web_search",
        definition: {
            id: "web.search",
            description: "Search the web using DuckDuckGo.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query" },
                },
                required: ["query"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "cheap",
        },
    },
    {
        toolName: "fetch_url",
        definition: {
            id: "web.fetch",
            description: "Fetch content from a URL (first 2000 chars).",
            inputSchema: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL to fetch" },
                },
                required: ["url"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "cheap",
        },
    },
    {
        toolName: "memory_read",
        definition: {
            id: "memory.read",
            description: "Read a value from memory (hot, warm, or cold tier).",
            inputSchema: {
                type: "object",
                properties: {
                    tier: { type: "string", enum: ["hot", "warm", "cold"], description: "Memory tier" },
                    key: { type: "string", description: "Memory key" },
                },
                required: ["tier", "key"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "trivial",
        },
    },
    {
        toolName: "memory_write",
        definition: {
            id: "memory.write",
            description: "Write a value to memory (hot or warm tier).",
            inputSchema: {
                type: "object",
                properties: {
                    tier: { type: "string", enum: ["hot", "warm"], description: "Memory tier" },
                    key: { type: "string", description: "Memory key" },
                    value: { description: "Value to store" },
                },
                required: ["tier", "key", "value"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "trivial",
        },
    },
    {
        toolName: "note_create",
        definition: {
            id: "note.create",
            description: "Create a persistent note in the dashboard.",
            inputSchema: {
                type: "object",
                properties: {
                    content: { type: "string", description: "Note content" },
                },
                required: ["content"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "trivial",
        },
    },
    {
        toolName: "goals_read",
        definition: {
            id: "goal.read",
            description: "Read active goals the user is working toward.",
            inputSchema: {
                type: "object",
                properties: {},
                required: [],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "trivial",
        },
    },
    {
        toolName: "goals_update",
        definition: {
            id: "goal.update",
            description: "Update a goal (status, timeline, confidence).",
            inputSchema: {
                type: "object",
                properties: {
                    goal_id: { type: "string", description: "Goal ID to update" },
                    status: { type: "string", description: "New status" },
                    confidence: { type: "number", description: "New confidence (0-1)" },
                    timeline_message: { type: "string", description: "Timeline event message" },
                    timeline_type: { type: "string", description: "Timeline event type" },
                },
                required: ["goal_id"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "trivial",
        },
    },
    {
        toolName: "vector_search",
        definition: {
            id: "vector.search",
            description: "Semantic search over long-term memory documents.",
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Search query" },
                },
                required: ["query"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "medium",
        },
    },
    {
        toolName: "gmail_read",
        definition: {
            id: "email.read",
            description: "Read recent emails from Gmail.",
            inputSchema: {
                type: "object",
                properties: {
                    max_results: { type: "number", description: "Max emails to return (default 5)" },
                },
                required: [],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "cheap",
        },
    },
    {
        toolName: "research_ingest",
        definition: {
            id: "research.ingest",
            description: "Ingest web content or PDF into long-term memory.",
            inputSchema: {
                type: "object",
                properties: {
                    url: { type: "string", description: "URL to ingest" },
                },
                required: ["url"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "expensive",
        },
    },
    {
        toolName: "weather_get",
        definition: {
            id: "weather.get",
            description: "Get current weather and forecast.",
            inputSchema: {
                type: "object",
                properties: {
                    location: { type: "string", description: "City or location name" },
                },
                required: ["location"],
            },
            outputSchema: { type: "object", properties: { success: { type: "boolean" }, output: { type: "string" } } },
            requiresPlanner: false,
            costEstimate: "trivial",
        },
    },
];

/**
 * Initialize the skill registry with default skills.
 * Bridges existing tools from @cairn/executor into the V2 skill system.
 */
export async function initSkillRegistry(): Promise<void> {
    // Dynamic import of existing tool registry (ESM-compatible)
    const { getTool: getExistingTool } = await import("@cairn/executor");

    for (const { definition, toolName } of DEFAULT_SKILLS) {
        const toolFn = getExistingTool(toolName);
        if (toolFn) {
            registerSkill(definition, wrapToolAsSkill(toolFn));
        } else {
            // Register with a "tool not available" handler
            registerSkill(definition, async () => ({
                success: false,
                output: `Skill ${definition.id} backing tool "${toolName}" not available.`,
            }));
            console.warn(`[skill-registry] Tool "${toolName}" not found for skill "${definition.id}"`);
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
