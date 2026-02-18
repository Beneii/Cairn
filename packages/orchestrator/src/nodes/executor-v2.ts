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
    attempts: number;
    confidence: number;
}

export interface ExecutionResult {
    steps: ExecutionStepResult[];
    allSuccess: boolean;
    totalDurationMs: number;
}

// ---- Internal helpers ----

function getWorkerLimit(workerClass: "light" | "heavy", plan?: Plan): number {
    if (workerClass === "heavy") {
        const envLimit = Number.parseInt(process.env.CAIRN_MAX_HEAVY_WORKERS || "3", 10);
        const base = Number.isFinite(envLimit) ? envLimit : 3;
        const planLimit = plan?.governance?.maxParallelHeavyWorkers ?? base;
        return Math.min(Math.max(planLimit, 1), 3);
    }

    const envLimit = Number.parseInt(process.env.CAIRN_MAX_LIGHT_WORKERS || "4", 10);
    const base = Number.isFinite(envLimit) ? envLimit : 4;
    const planLimit = plan?.governance?.maxParallelLightWorkers ?? base;
    return Math.min(Math.max(planLimit, 1), 10);
}

function computeConfidence(step: PlanStep, success: boolean, attempts: number): number {
    const hint = step.confidenceHint ?? 0.7;
    if (!success) return Math.max(0.05, hint * 0.25);
    const retryPenalty = Math.max(0, attempts - 1) * 0.15;
    return Math.max(0.1, Math.min(1, hint - retryPenalty));
}

function getRetryBudget(step: PlanStep, plan: Plan): number {
    const planBudget = plan.governance?.maxRetriesPerStep ?? 1;
    const stepBudget = step.maxRetries ?? planBudget;
    return Math.min(Math.max(stepBudget, 0), 3);
}

async function runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
): Promise<void> {
    let cursor = 0;
    const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
        while (true) {
            const idx = cursor;
            cursor += 1;
            if (idx >= items.length) return;
            await worker(items[idx]);
        }
    });

    await Promise.all(runners);
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
    } catch {
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
            attempts: 1,
            confidence: 0.05,
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
            attempts: 1,
            confidence: 0.05,
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
            attempts: 1,
            confidence: result.success ? 0.8 : 0.2,
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
            const targetPath = match[2];

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
            if (!targetPath) return outputData;

            // Traverse path
            const parts = targetPath.split(".");
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

async function createHumanDecisionTicket(messageId: string, step: PlanStep, result: ExecutionStepResult, reason: string): Promise<void> {
    try {
        await initWarmMemory();
        const existing = memoryRead("warm" as any, "human_decision_tickets", { read: ["warm"], write: [] });
        const tickets = Array.isArray(existing) ? existing : [];
        const ticket = {
            id: newId(),
            createdAt: new Date().toISOString(),
            status: "open",
            messageId,
            skillId: step.skillId,
            reason,
            attempts: result.attempts,
            confidence: result.confidence,
            output: result.output.slice(0, 500),
        };
        await memoryWrite("warm" as any, "human_decision_tickets", [ticket, ...tickets].slice(0, 100), { read: [], write: ["warm"] });
        bus.emit("log:entry", {
            id: newId(),
            timestamp: now(),
            type: "agent",
            content: `[executor-v2] Human decision ticket created for ${step.skillId}: ${reason}`,
        });
    } catch (err) {
        console.warn("[executor-v2] failed to create human decision ticket", err);
    }
}

async function executeStepWithRetry(
    step: PlanStep,
    messageId: string,
    resolvedArgs: Record<string, any>,
    plan: Plan,
): Promise<ExecutionStepResult> {
    const retryBudget = getRetryBudget(step, plan);
    const totalAttempts = retryBudget + 1;

    let last: ExecutionStepResult | null = null;
    for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
        const base = await executeSingleSkill(step.skillId, resolvedArgs, messageId);
        last = {
            ...base,
            attempts: attempt,
            confidence: computeConfidence(step, base.success, attempt),
        };
        if (last.success) return last;
    }

    if (step.escalationSkillId && plan.governance?.escalationMode !== "none") {
        const escalation = await executeSingleSkill(step.escalationSkillId, {
            originalSkillId: step.skillId,
            originalArgs: resolvedArgs,
            reason: "step_failed_after_retries",
        }, messageId);

        if (escalation.success) {
            return {
                ...escalation,
                skillId: `${step.skillId}::escalated(${step.escalationSkillId})`,
                attempts: totalAttempts + 1,
                confidence: computeConfidence(step, true, totalAttempts + 1),
            };
        }
    }

    const failedResult = last || {
        skillId: step.skillId,
        success: false,
        output: "Execution failed before attempt loop could run",
        durationMs: 0,
        attempts: totalAttempts,
        confidence: 0.05,
    };

    if (plan.governance?.createHumanTicketOnFailure ?? true) {
        await createHumanDecisionTicket(messageId, step, failedResult, "step_failed_after_retries_and_escalation");
    }

    return failedResult;
}

/**
 * Execute a full plan. Supports lightweight parallel groups with governance caps.
 * Stops on first failure in sequential mode; parallel groups complete then halt if any failed.
 */
export async function executePlan(
    plan: Plan,
    messageId: string,
): Promise<ExecutionResult> {
    await ensureSkillRegistry();

    const results: ExecutionStepResult[] = [];
    const overallStart = Date.now();
    let toolCallCount = 0;
    const maxLightWorkers = getWorkerLimit("light", plan);
    const maxHeavyWorkers = getWorkerLimit("heavy", plan);

    const steps = plan.steps;
    for (let i = 0; i < steps.length; i += 1) {
        if (toolCallCount >= plan.maxToolCalls) {
            bus.emit("log:entry", {
                id: newId(),
                timestamp: now(),
                type: "agent",
                content: `Plan execution stopped: reached maxToolCalls (${plan.maxToolCalls})`,
            });
            break;
        }

        const current = steps[i];
        const parallelClass = current.workerClass === "heavy" ? "heavy" : current.workerClass === "light" ? "light" : null;
        const isParallelRoot = !!parallelClass && !!current.parallelGroup;

        if (!isParallelRoot) {
            const resolvedArgs = resolveArguments(current.arguments, results);
            const stepResult = await executeStepWithRetry(current, messageId, resolvedArgs, plan);
            results.push(stepResult);
            toolCallCount += 1;

            const minConfidence = plan.governance?.minConfidenceForAutonomy ?? 0.35;
            if (stepResult.success && stepResult.confidence < minConfidence) {
                await createHumanDecisionTicket(messageId, current, stepResult, `low_confidence_success_below_${minConfidence}`);
            }

            if (!stepResult.success) {
                bus.emit("log:entry", {
                    id: newId(),
                    timestamp: now(),
                    type: "error",
                    content: `Plan execution stopped at step ${toolCallCount}: ${current.skillId} failed`,
                });
                break;
            }
            continue;
        }

        const groupId = current.parallelGroup!;
        const group: { step: PlanStep; index: number; out?: ExecutionStepResult }[] = [];
        while (i < steps.length) {
            const candidate = steps[i];
            const candidateClass = candidate.workerClass === "heavy" ? "heavy" : candidate.workerClass === "light" ? "light" : null;
            if (candidateClass === parallelClass && candidate.parallelGroup === groupId) {
                group.push({ step: candidate, index: i });
                i += 1;
                continue;
            }
            break;
        }
        i -= 1;

        const classLimit = parallelClass === "heavy" ? maxHeavyWorkers : maxLightWorkers;
        const allowed = Math.min(classLimit, Math.max(1, plan.maxToolCalls - toolCallCount));
        await runWithConcurrency(group, allowed, async (entry) => {
            const resolvedArgs = resolveArguments(entry.step.arguments, results);
            entry.out = await executeStepWithRetry(entry.step, messageId, resolvedArgs, plan);
        });

        toolCallCount += group.length;
        group.sort((a, b) => a.index - b.index);
        const minConfidence = plan.governance?.minConfidenceForAutonomy ?? 0.35;
        for (const entry of group) {
            if (entry.out) {
                results.push(entry.out);
                if (entry.out.success && entry.out.confidence < minConfidence) {
                    await createHumanDecisionTicket(messageId, entry.step, entry.out, `low_confidence_success_below_${minConfidence}`);
                }
            }
        }

        if (group.some((g) => !g.out?.success)) {
            bus.emit("log:entry", {
                id: newId(),
                timestamp: now(),
                type: "error",
                content: `Plan execution halted after parallel group '${groupId}' due to failures`,
            });
            break;
        }
    }

    return {
        steps: results,
        allSuccess: results.length > 0 && results.every((r) => r.success),
        totalDurationMs: Date.now() - overallStart,
    };
}
