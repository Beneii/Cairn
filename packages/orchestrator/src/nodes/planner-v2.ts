/**
 * Planner V2 — Cairn V2
 * 
 * Receives an ActionContract and produces a Plan with PlanStep[].
 * Constrained to registered skills only. Cannot invent tools.
 * Respects maxToolCalls. Defines termination.
 */

import { z } from "zod";
import type { ActionContract, Plan, PlanStep } from "@cairn/shared";
import { newId, now, bus } from "@cairn/shared";
import { callLLM } from "../llm.js";
import { listSkills, getSkillDefinition } from "../skill-registry.js";

// ---- Zod Schema ----

const PlanStepSchema = z.object({
    skillId: z.string(),
    arguments: z.record(z.string(), z.any()),
});

const PlanOutputSchema = z.object({
    steps: z.array(PlanStepSchema).min(1).max(10),
    maxToolCalls: z.number().int().min(1).max(20),
    riskLevel: z.enum(["low", "medium", "high"]),
});

// ---- System Prompt ----

function buildPlannerPrompt(skills: { id: string; description: string }[]): string {
    const skillList = skills.map((s) => `  - ${s.id}: ${s.description}`).join("\n");

    return `You are a planner for Cairn, a personal AI assistant.
You receive a task description and must produce a step-by-step plan using ONLY the available skills listed below.

## Available Skills
${skillList}

## Output Format (STRICT JSON)
{
  "steps": [
    { "skillId": "skill.id", "arguments": { ... } },
    ...
  ],
  "maxToolCalls": number,
  "riskLevel": "low" | "medium" | "high"
}

## Rules
- ONLY use skillIds from the Available Skills list. Never invent new skills.
- Each step must have valid arguments matching the skill's requirements.
- Order steps logically — if step 2 depends on step 1's output, say so.
- Keep plans minimal. Don't add unnecessary steps.
- maxToolCalls should be the total number of skill invocations.
- riskLevel: "low" for read-only, "medium" for writes, "high" for external-facing actions.
- Respond with ONLY valid JSON. No markdown, no explanation.`;
}

// ---- Planner ----

const MAX_PLAN_STEPS = 10;
const MAX_TOOL_CALLS = 20;

export async function createPlan(
    contract: ActionContract,
    userText: string,
): Promise<{ plan: Plan | null; cost_usd: number; error?: string }> {
    const skills = listSkills();
    const systemPrompt = buildPlannerPrompt(skills);

    const userMessage = `Task: ${contract.justification}
User said: "${userText}"
${contract.skillId ? `Primary skill hint: ${contract.skillId}` : ""}
${contract.arguments ? `Known arguments: ${JSON.stringify(contract.arguments)}` : ""}

Create a plan to accomplish this.`;

    try {
        const response = await callLLM(
            {
                model: "gpt-4o-mini",
                systemPrompt,
                userMessage,
                maxTokens: 600,
                responseFormat: "json_object",
                temperature: 0,
            },
            "planner",
            "plan-" + newId().slice(0, 8),
        );

        const parsed = tryParsePlan(response.content);
        if (!parsed) {
            bus.emit("log:entry", {
                id: newId(),
                timestamp: now(),
                type: "error",
                content: `Planner parse failed. Raw: ${response.content.substring(0, 200)}`,
            });

            return {
                plan: null,
                cost_usd: response.cost.cost_usd,
                error: "Failed to parse planner output",
            };
        }

        // Validate all skillIds exist
        const invalidSteps = parsed.steps.filter(
            (step) => !getSkillDefinition(step.skillId),
        );

        if (invalidSteps.length > 0) {
            const invalidIds = invalidSteps.map((s) => s.skillId).join(", ");
            bus.emit("log:entry", {
                id: newId(),
                timestamp: now(),
                type: "error",
                content: `Planner referenced unknown skills: ${invalidIds}. Filtering them out.`,
            });

            // Filter out invalid steps rather than failing entirely
            parsed.steps = parsed.steps.filter(
                (step) => getSkillDefinition(step.skillId) !== undefined,
            );

            if (parsed.steps.length === 0) {
                return {
                    plan: null,
                    cost_usd: response.cost.cost_usd,
                    error: `All planned skills were invalid: ${invalidIds}`,
                };
            }
        }

        // Enforce limits
        parsed.steps = parsed.steps.slice(0, MAX_PLAN_STEPS);
        parsed.maxToolCalls = Math.min(parsed.maxToolCalls, MAX_TOOL_CALLS);

        return { plan: parsed, cost_usd: response.cost.cost_usd };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        return { plan: null, cost_usd: 0, error: errorMsg };
    }
}

// ---- Parse Helper ----

function tryParsePlan(content: string): Plan | null {
    try {
        const raw = JSON.parse(content.trim());
        const result = PlanOutputSchema.safeParse(raw);
        if (result.success) {
            return result.data;
        }
        console.warn("[planner-v2] Schema validation failed:", result.error.issues);
        return null;
    } catch {
        return null;
    }
}
