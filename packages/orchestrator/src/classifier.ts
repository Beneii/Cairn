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

    // Current date/time context for resolving relative references
    const tz = process.env.TIMEZONE || "Australia/Sydney";
    const nowLocal = new Date().toLocaleString("en-AU", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    const todayISO = new Date().toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD

    return `You are a JSON classification engine. You receive user text and output a JSON object classifying the intent.

## Input Context
- Date: ${todayISO}
- Time: ${nowLocal}

## Classification Rules
1. Map the user's intent to exactly ONE of these actions:
   - "none": Casual chat, greetings, or questions you can answer directly without tools.
   - "skill": A specific single tool/skill can handle the request.
   - "plan": Complex requests requiring multiple steps or tools.

2. Resolve relative dates (tomorrow, next friday) to ISO format in arguments.

## Available Skills
${skillList}

## Output Schema
You must output a JSON object satisfying this TypeScript interface:

interface Classification {
  intent: string; // Brief description of what the user wants
  recommendedAction: "none" | "skill" | "plan";
  suggestedSkillId: string | null; // The exact ID of the skill to use
  suggestedArguments: Record<string, any> | null;
  needsPlanner: boolean; // True if multi-step
  confidence: number; // 0.0 to 1.0
}

## Examples
Input: "Remind me to call Mom tomorrow"
Output: { "intent": "Create reminder", "recommendedAction": "skill", "suggestedSkillId": "task.create", "suggestedArguments": { "title": "Call Mom", "due_date": "${todayISO}" }, "needsPlanner": false, "confidence": 0.95 }

Input: "What's the weather in Paris?"
Output: { "intent": "Get weather", "recommendedAction": "skill", "suggestedSkillId": "weather.get", "suggestedArguments": { "location": "Paris" }, "needsPlanner": false, "confidence": 0.95 }

Input: "Research quantum physics and write a summary"
Output: { "intent": "Research topic", "recommendedAction": "plan", "suggestedSkillId": "web.search", "suggestedArguments": { "query": "quantum physics" }, "needsPlanner": true, "confidence": 0.9 }
`;
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
