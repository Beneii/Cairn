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
    suggestedSkillId: z.string().optional(),
    suggestedArguments: z.record(z.string(), z.any()).optional(),
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
{
  "intent": "short description of what user wants",
  "recommendedAction": "none" | "skill" | "plan",
  "suggestedSkillId": "skill.id (only if recommendedAction is 'skill' or 'plan')",
  "suggestedArguments": { key: value } (only if you can extract arguments),
  "needsPlanner": true/false,
  "confidence": 0.0-1.0
}

## Rules
- "none": User is chatting, asking a question you can answer directly, or no action needed.
- "skill": A single skill can handle this request.
- "plan": Multiple skills or complex multi-step reasoning needed.
- needsPlanner: Set true ONLY for multi-step tasks that require sequencing multiple skills.
- For skill suggestions, ONLY use skill IDs from the list above. Never invent skills.
- Extract arguments whenever possible (e.g. task title, search query).
- If unsure, use recommendedAction: "none" with lower confidence.

## Important
- You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.
- Do NOT use any skill IDs not in the list above.`;
}

// ---- Repair prompt ----

const REPAIR_PROMPT = `Your previous response was not valid JSON. Please respond with ONLY a valid JSON object matching this exact schema:
{
  "intent": "string",
  "recommendedAction": "none" | "skill" | "plan",
  "suggestedSkillId": "string (optional)",
  "suggestedArguments": {} (optional),
  "needsPlanner": boolean,
  "confidence": number (0-1)
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

function tryParse(content: string): IntentClassification | null {
    try {
        const raw = JSON.parse(content.trim());
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
