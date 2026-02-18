/**
 * Executor V2 — Cairn V2
 * 
 * Dumb executor. No LLM. No interpretation.
 * 
 * For each step in a plan:
 * 1. Validate skillId exists in registry
 * 2. Validate input against SkillDefinition.inputSchema
 * 3. Execute skill handler
 * 4. Log latency, status, cost
 * 
 * Returns execution trace for observability.
 */

import * as fs from "fs";
import * as path from "path";
import type { Plan, PlanStep } from "@cairn/shared";
import { newId, now, bus } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { recordSkillInvocation } from "@cairn/skills";
import {
    getSkillDefinition,
    validateSkillInput,
    executeSkill,
    ensureSkillRegistry,
    type SkillContext,
    type SkillResult,
} from "../skill-registry.js";
import {
    memoryRead,
    memoryWrite,
    initWarmMemory
} from "@cairn/memory";

// ---- Types ----

export interface ExecutionStepResult {
    skillId: string;
    success: boolean;
    output: string;
    durationMs: number;
}

export interface ExecutionResult {
    steps: ExecutionStepResult[];
    allSuccess: boolean;
    totalDurationMs: number;
}

// ---- Executor ----

/**
 * Execute a single skill with validated arguments.
 */
export async function executeSingleSkill(
    skillId: string,
    args: Record<string, any>,
    messageId: string,
): Promise<ExecutionStepResult> {
    await ensureSkillRegistry();

    const start = Date.now();
    try {
        fs.appendFileSync(path.join(process.cwd(), "debug-executor.log"), `[${new Date().toISOString()}] Executing ${skillId} args: ${JSON.stringify(args)}\n`);
    } catch (e) {
        // ignore
    }

    // 1. Validate skill exists
    const skillDef = getSkillDefinition(skillId);
    if (!skillDef) {
        return {
            skillId,
            success: false,
            output: `Skill not found: ${skillId}`,
            durationMs: Date.now() - start,
        };
    }

    // 2. Validate input
    const validation = validateSkillInput(skillId, args);
    if (!validation.valid) {
        bus.emit("log:entry", {
            id: newId(),
            timestamp: now(),
            type: "error",
            content: `Skill ${skillId} validation failed: ${validation.reason}. Args: ${JSON.stringify(args)}`
        });

        return {
            skillId,
            success: false,
            output: `Invalid input: ${validation.reason}`,
            durationMs: Date.now() - start,
        };
    }

    // 3. Build context
    const ctx: SkillContext = {
        jobId: messageId,
        messageId,
        memoryRead: (tier, key) => memoryRead(tier as any, key, { read: ["hot", "warm", "cold"], write: [] }),
        memoryWrite: async (tier, key, value) => {
            if (tier === "warm") await initWarmMemory();
            return memoryWrite(tier as any, key, value, { read: [], write: ["hot", "warm"] });
        },
    };

    // 4. Execute
    bus.emit("log:entry", {
        id: newId(),
        timestamp: now(),
        type: "tool",
        content: `Executing skill: ${skillId}(${JSON.stringify(args)})`,
    });

    try {
        const result = await executeSkill(skillId, args, ctx);
        const durationMs = Date.now() - start;

        try {
            recordSkillInvocation({
                skill_id: skillId,
                latency_ms: durationMs,
                success: result.success,
            });
        } catch (metricsErr) {
            console.warn("[executor-v2] failed to record skill metrics:", metricsErr);
        }

        // 5. Log
        await appendEntry(
            "tool",
            "executor-v2",
            messageId,
            `Skill ${skillId}: ${result.success ? "OK" : "FAIL"} in ${durationMs}ms`,
        );

        bus.emit("log:entry", {
            id: newId(),
            timestamp: now(),
            type: "tool",
            content: `Skill ${skillId} result (${durationMs}ms): ${result.output.substring(0, 200)}`,
        });

        return {
            skillId,
            success: result.success,
            output: result.output,
            durationMs,
        };
    } catch (err) {
        const durationMs = Date.now() - start;
        try {
            recordSkillInvocation({
                skill_id: skillId,
                latency_ms: durationMs,
                success: false,
            });
        } catch (metricsErr) {
            console.warn("[executor-v2] failed to record skill metrics:", metricsErr);
        }
        throw err;
    }
}


/**
 * Recursively resolve variable references in arguments.
 * Supported syntax: {{stepN.output.path.to.value}}
 */
function resolveArguments(
    args: any,
    previousSteps: ExecutionStepResult[],
): any {
    if (typeof args === "string") {
        // Match {{stepN.output...}}
        const match = args.match(/^{{step(\d+)\.output(?:\.(.+))?}}$/);
        if (match) {
            const stepIndex = parseInt(match[1], 10) - 1; // 1-based index to 0-based
            const path = match[2];

            const step = previousSteps[stepIndex];
            if (!step || !step.success) {
                return args; // Cannot resolve, keep literal
            }

            // Parse output if it's JSON
            let outputData: any;
            try {
                outputData = JSON.parse(step.output);
            } catch {
                outputData = step.output;
            }

            // Return full output if no path
            if (!path) return outputData;

            // Traverse path
            const parts = path.split(".");
            let current = outputData;
            for (const part of parts) {
                if (current && typeof current === "object" && part in current) {
                    current = current[part];
                } else {
                    return args; // Path not found
                }
            }
            return current;
        }
        return args;
    }

    if (Array.isArray(args)) {
        return args.map((item) => resolveArguments(item, previousSteps));
    }

    if (args && typeof args === "object") {
        const resolved: any = {};
        for (const [key, value] of Object.entries(args)) {
            resolved[key] = resolveArguments(value, previousSteps);
        }
        return resolved;
    }

    return args;
}

/**
 * Execute a full plan (multiple steps in sequence).
 * Stops on first failure unless step is marked as non-critical.
 */
export async function executePlan(
    plan: Plan,
    messageId: string,
): Promise<ExecutionResult> {
    await ensureSkillRegistry();

    const results: ExecutionStepResult[] = [];
    const overallStart = Date.now();
    let toolCallCount = 0;

    for (const step of plan.steps) {
        // Enforce maxToolCalls
        if (toolCallCount >= plan.maxToolCalls) {
            bus.emit("log:entry", {
                id: newId(),
                timestamp: now(),
                type: "agent",
                content: `Plan execution stopped: reached maxToolCalls (${plan.maxToolCalls})`,
            });
            break;
        }

        // Resolve variables
        const resolvedArgs = resolveArguments(step.arguments, results);

        const stepResult = await executeSingleSkill(step.skillId, resolvedArgs, messageId);
        results.push(stepResult);
        toolCallCount++;

        // Stop on failure
        if (!stepResult.success) {
            bus.emit("log:entry", {
                id: newId(),
                timestamp: now(),
                type: "error",
                content: `Plan execution stopped at step ${toolCallCount}: ${step.skillId} failed`,
            });
            break;
        }
    }

    return {
        steps: results,
        allSuccess: results.every((r) => r.success),
        totalDurationMs: Date.now() - overallStart,
    };
}

