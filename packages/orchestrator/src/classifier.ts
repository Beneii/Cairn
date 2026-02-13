/**
 * LLM Intent Classifier — Cairn V2 (Advisory)
 * 
 * Stateless classifier. Receives:
 * - userText
 * - working state flags
 * - list of available skills (id + short description only)
 * 
 * Does NOT receive: chat history, tool results, RAG data, large memory.
 * 
 * Returns IntentClassification with strict JSON + retry-once repair.
 */

import { z } from "zod";
import type { IntentClassification, FailureStatus } from "@cairn/shared";
import { newId, now, bus } from "@cairn/shared";
import { callLLM } from "./llm.js";
import { listSkills } from "./skill-registry.js";

// ---- Zod Schema for strict parsing ----

const IntentClassificationSchema = z.object({
    intent: z.string().min(1).max(200),
    recommendedAction: z.enum(["none", "skill", "plan"]),
    suggestedSkillId: z.string().nullish(),
    suggestedArguments: z.record(z.string(), z.any()).nullish(),
    needsPlanner: z.boolean().default(false),
    confidence: z.number().min(0).max(1),
});

// ---- System Prompt ----

function buildClassifierPrompt(skills: { id: string; description: string }[]): string {
    const skillList = skills.map((s) => `  - ${s.id}: ${s.description}`).join("\n");

    return `You are an intent classifier for Cairn, a personal AI assistant.
Your job is to classify the user's intent and recommend an action. You are advisory — your output is used by a deterministic system to decide what happens next.

## Available Skills
${skillList}

## Output Format (STRICT JSON)
Respond with exactly this structure:
{
  "intent": "short description of what user wants",
  "recommendedAction": "none" or "skill" or "plan",
  "suggestedSkillId": "ONE skill id string from the list above, or omit",
  "suggestedArguments": { "key": "value" },
  "needsPlanner": false,
  "confidence": 0.8
}

## CRITICAL RULES
- recommendedAction MUST be exactly one of these three strings: "none", "skill", "plan"
  - Do NOT put a skill ID in recommendedAction. Use "skill" and put the ID in suggestedSkillId.
- suggestedSkillId MUST be a single string, NEVER an array.
  - If multiple skills are needed, set recommendedAction to "plan" and put the PRIMARY skill in suggestedSkillId.
- "none": User is chatting, asking a question, or no action is needed.
- "skill": A single skill from the list can handle this.
- "plan": Multiple steps or skills are needed.
- needsPlanner: true ONLY for multi-step tasks requiring multiple skills.
- ONLY use skill IDs from the list above. Never invent skill IDs.
- Respond with ONLY valid JSON. No markdown, no explanation.`;
}

// ---- Repair prompt ----

const REPAIR_PROMPT = `Your previous response had errors. Fix it and respond with ONLY valid JSON.

CRITICAL CONSTRAINTS:
- recommendedAction must be exactly: "none", "skill", or "plan" (NOT a skill ID like "note.create")
- suggestedSkillId must be a single string (NOT an array)
- If you previously used a skill ID as recommendedAction, move it to suggestedSkillId and set recommendedAction to "skill"

Schema:
{
  "intent": "string",
  "recommendedAction": "none" | "skill" | "plan",
  "suggestedSkillId": "string or omit",
  "suggestedArguments": {},
  "needsPlanner": false,
  "confidence": 0.8
}
Respond with ONLY the JSON. No explanation.`;

// ---- Classifier ----

export interface ClassifierResult {
    classification: IntentClassification | null;
    status: FailureStatus;
    cost_usd: number;
}

export async function classifyIntent(
    userText: string,
    workingState?: Record<string, any>,
): Promise<ClassifierResult> {
    const skills = listSkills();
    const systemPrompt = buildClassifierPrompt(skills);

    // Build user message with optional working state
    let userMessage = userText;
    if (workingState && Object.keys(workingState).length > 0) {
        userMessage += `\n\n[Working State: ${JSON.stringify(workingState)}]`;
    }

    let totalCost = 0;

    // Attempt 1: classify
    try {
        const response = await callLLM(
            {
                model: "gpt-4o-mini",
                systemPrompt,
                userMessage,
                maxTokens: 300,
                responseFormat: "json_object",
                temperature: 0,
            },
            "classifier",
            "classify-" + newId().slice(0, 8),
        );

        totalCost += response.cost.cost_usd;

        const parsed = tryParse(response.content);
        if (parsed) {
            return { classification: parsed, status: "SUCCESS", cost_usd: totalCost };
        }

        // Attempt 2: repair
        bus.emit("log:entry", {
            id: newId(),
            timestamp: now(),
            type: "error",
            content: `Classifier parse failed, attempting repair. Raw: ${response.content.substring(0, 200)}`,
        });

        const repairResponse = await callLLM(
            {
                model: "gpt-4o-mini",
                systemPrompt: REPAIR_PROMPT,
                userMessage: `Original input: "${userText}"\nYour broken response: ${response.content}`,
                maxTokens: 300,
                responseFormat: "json_object",
                temperature: 0,
            },
            "classifier",
            "repair-" + newId().slice(0, 8),
        );

        totalCost += repairResponse.cost.cost_usd;

        const repaired = tryParse(repairResponse.content);
        if (repaired) {
            return { classification: repaired, status: "SUCCESS", cost_usd: totalCost };
        }

        // Both attempts failed
        bus.emit("log:entry", {
            id: newId(),
            timestamp: now(),
            type: "error",
            content: `Classifier repair also failed. Returning PARSE_ERROR_CLASSIFIER.`,
        });

        return { classification: null, status: "PARSE_ERROR_CLASSIFIER", cost_usd: totalCost };
    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        // Check for model availability issues
        if (errorMsg.includes("not running") || errorMsg.includes("ECONNREFUSED") || errorMsg.includes("not available")) {
            return { classification: null, status: "MODEL_NOT_AVAILABLE", cost_usd: totalCost };
        }

        bus.emit("log:entry", {
            id: newId(),
            timestamp: now(),
            type: "error",
            content: `Classifier infrastructure error: ${errorMsg}`,
        });

        return { classification: null, status: "INFRASTRUCTURE_FAIL", cost_usd: totalCost };
    }
}

// ---- Parse Helper ----

function normalizeRaw(raw: any): any {
    if (!raw || typeof raw !== "object") return raw;

    // Fix 1: suggestedSkillId is an array → take first element
    if (Array.isArray(raw.suggestedSkillId)) {
        raw.suggestedSkillId = raw.suggestedSkillId[0] ?? null;
        // Multiple skills = plan
        if (!raw.needsPlanner) raw.needsPlanner = true;
        if (raw.recommendedAction === "skill") raw.recommendedAction = "plan";
    }

    // Fix 2: recommendedAction contains a skill ID instead of enum value
    const validActions = new Set(["none", "skill", "plan"]);
    if (raw.recommendedAction && !validActions.has(raw.recommendedAction)) {
        // Move the skill ID to suggestedSkillId
        if (!raw.suggestedSkillId) {
            raw.suggestedSkillId = raw.recommendedAction;
        }
        raw.recommendedAction = "skill";
    }

    return raw;
}

function tryParse(content: string): IntentClassification | null {
    try {
        let raw = JSON.parse(content.trim());
        raw = normalizeRaw(raw);
        const result = IntentClassificationSchema.safeParse(raw);
        if (result.success) {
            return result.data;
        }
        console.warn("[classifier] Schema validation failed:", result.error.issues);
        return null;
    } catch {
        return null;
    }
}
