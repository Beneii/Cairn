/**
 * Response Composer — Cairn V2
 * 
 * Composes the final user-facing response from execution results.
 * - Simple skill results → deterministic templates
 * - Complex results → optional LLM polish
 * - Errors → clear, actionable messages
 */

import type { ActionContract, FailureStatus, Plan } from "@cairn/shared";
import { callLLM } from "./llm.js";
import { isLLMAvailable } from "./llm.js";
import type { SkillResult } from "./skill-registry.js";

// ---- Deterministic Templates ----

const SKILL_TEMPLATES: Record<string, (result: SkillResult, args?: Record<string, any>) => string> = {
    "task.create": (r, a) => r.success ? `✅ Task created: "${a?.title || "untitled"}"` : `❌ Couldn't create task: ${r.output}`,
    "task.complete": (r) => r.success ? `✅ Task completed.` : `❌ ${r.output}`,
    "task.read": (r) => r.success ? formatTaskList(r.output) : `❌ ${r.output}`,
    "note.create": (r) => r.success ? `📝 Note saved.` : `❌ ${r.output}`,
    "goal.read": (r) => r.success ? formatGoalList(r.output) : `❌ ${r.output}`,
    "goal.update": (r) => r.success ? `✅ Goal updated.` : `❌ ${r.output}`,
};

function formatTaskList(output: string): string {
    try {
        const data = JSON.parse(output);
        if (data.count === 0) return "📋 No tasks found.";
        const tasks = data.tasks || [];
        const lines = tasks.map((t: any) => `- ${t.status === "done" ? "✅" : "⬜"} ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""}`);
        return `📋 **${data.count} tasks:**\n${lines.join("\n")}`;
    } catch {
        return output;
    }
}

function formatGoalList(output: string): string {
    try {
        const data = JSON.parse(output);
        if (data.active_count === 0) return "🎯 No active goals.";
        const goals = data.active || [];
        const lines = goals.map((g: any) => `- 🎯 **${g.title}** (${g.priority}, ${Math.round(g.confidence * 100)}% confidence)`);
        return `🎯 **${data.active_count} active goals:**\n${lines.join("\n")}`;
    } catch {
        return output;
    }
}

// ---- Error Templates ----

const ERROR_MESSAGES: Record<FailureStatus, string> = {
    SUCCESS: "",
    PARSE_ERROR_CLASSIFIER: "I had trouble understanding that. Could you rephrase?",
    CONTRACT_VALIDATION_FAIL: "I couldn't figure out exactly what action to take. Could you be more specific?",
    SKILL_NOT_FOUND: "I don't have a capability for that yet.",
    MODEL_NOT_AVAILABLE: "My AI models aren't available right now. Please check that Ollama is running or that API keys are configured.",
    TOOL_TIMEOUT: "That took too long. Please try again.",
    INFRASTRUCTURE_FAIL: "Something went wrong on my end. Check the logs for details.",
};

// ---- Public API ----

/**
 * Compose a response for a direct (non-skill) result.
 */
export function composeDirectResponse(
    directResponse: string | undefined,
    status: FailureStatus,
): string {
    if (status !== "SUCCESS") {
        return ERROR_MESSAGES[status] || "Something went wrong.";
    }
    return directResponse || "👍";
}

/**
 * Compose a response for a skill execution result.
 */
export function composeSkillResponse(
    skillId: string,
    result: SkillResult,
    args?: Record<string, any>,
): string {
    // Try deterministic template first
    const template = SKILL_TEMPLATES[skillId];
    if (template) {
        return template(result, args);
    }

    // Generic response
    if (result.success) {
        return result.output;
    }
    return `❌ ${result.output}`;
}

/**
 * Compose a response for a plan execution with multiple results.
 */
export async function composePlanResponse(
    plan: Plan,
    results: { skillId: string; result: SkillResult }[],
): Promise<string> {
    const allSuccess = results.every((r) => r.result.success);

    // If all simple and successful, just concatenate
    if (allSuccess && results.length <= 2) {
        return results
            .map((r) => composeSkillResponse(r.skillId, r.result))
            .join("\n\n");
    }

    // For complex results, try LLM polish if available
    if (isLLMAvailable()) {
        try {
            const summaryData = results.map((r) => ({
                skill: r.skillId,
                success: r.result.success,
                output: r.result.output.substring(0, 500),
            }));

            const response = await callLLM(
                {
                    model: "gpt-4o-mini",
                    systemPrompt: "You are composing a brief, natural response for the user summarizing what was accomplished. Keep it concise and conversational. Use emoji sparingly.",
                    userMessage: `Plan results:\n${JSON.stringify(summaryData, null, 2)}`,
                    maxTokens: 500,
                    temperature: 0.3,
                },
                "responder",
                "compose-" + Date.now(),
            );

            return response.content;
        } catch {
            // Fall through to deterministic
        }
    }

    // Deterministic fallback
    const lines = results.map((r) => {
        const status = r.result.success ? "✅" : "❌";
        return `${status} ${r.skillId}: ${r.result.output.substring(0, 100)}`;
    });
    return lines.join("\n");
}

/**
 * Compose a clarification response.
 */
export function composeClarification(message: string): string {
    return message;
}

/**
 * Compose an error response from a FailureStatus.
 */
export function composeErrorResponse(status: FailureStatus): string {
    return ERROR_MESSAGES[status] || "Something went wrong.";
}
