import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";
import { z } from "zod";

const SYSTEM_PROMPT = `You are Cairn's Critic — a specialized agent that reviews the work of the Executor.
Your job is to ensure that the Executor's output actually solves the user's request and aligns with their goals.

## Your Evaluation Criteria:
1. **Accuracy**: Did the executor correctly use tools and report findings?
2. **Intent Match**: Does the final response actually answer what the user asked?
3. **Goal Alignment**: If the task relates to a goal, was it handled proactively?
4. **Safety & Policy**: Did the executor follow policy (redaction, etc)?

## Available Tools Context
The Executor has access to:
- Memory: memory_read, memory_write, vector_search
- Info: web_search, fetch_url, gmail_read, calendar_read
- Goals/Tasks: goals_read, goals_update, tasks_read, tasks_create, tasks_complete
- System: ledger_write, note_create, research_ingest
- Browser: browser_navigate, browser_click, browser_type, browser_press, browser_fill, browser_screenshot

## Response Format (JSON):
Respond with ONE of these structures:

1. Accept the result:
{ "action": "accept", "reasoning": "why it is correct" }

2. Require refinement:
{ "action": "refine", "feedback": "what needs to be fixed or improved", "reasoning": "why it failed the first pass" }

CRITICAL: If the result is "mostly correct" but missing a key detail, use "refine". If it's perfect, use "accept".`;

const CriticResponseSchema = z.object({
    action: z.enum(["accept", "refine"]),
    feedback: z.string().max(1000).optional(),
    reasoning: z.string().max(1000).optional(),
});

export type CriticResult = z.infer<typeof CriticResponseSchema>;

export async function runCriticNode(job: Job): Promise<Job & { _criticResult?: CriticResult }> {
    const config = getNodeConfig("critic");
    checkCaller("orchestrator", "critic");
    checkTransition("executor", "critic");

    bus.emit("nucleus:state", "thinking");

    const resultArtifact = job.artifacts.find(a => a.type === "result" || a.type === "blocked");
    const toolOutputs = resultArtifact?.metadata?.tool_outputs || [];

    const contextBlock = `
User Request: ${job.input}
Executor's Final Output: ${resultArtifact?.content || "No result found"}
Tool Outputs used during execution:
${Array.isArray(toolOutputs) ? toolOutputs.join("\n") : "None"}
  `.trim();

    await appendEntry("agent", "critic", job.id, "Critic reviewing executor output");

    const response = await callLLM(
        {
            model: config.assigned_model,
            systemPrompt: SYSTEM_PROMPT,
            userMessage: contextBlock,
            maxTokens: config.max_tokens_per_call,
            responseFormat: "json_object",
        },
        "critic",
        job.id,
    );

    let parsed: CriticResult;
    try {
        parsed = CriticResponseSchema.parse(JSON.parse(response.content));
    } catch (err) {
        console.error("[critic] Validation failed, defaulting to accept:", err);
        parsed = { action: "accept", reasoning: "Validation failed during critique" };
    }

    const criticArtifact: Artifact = {
        id: newId(),
        type: "critic_report",
        content: parsed.action === "accept" ? "Result accepted" : `Refinement required: ${parsed.feedback}`,
        metadata: { ...parsed },
        origin_node: "critic",
        created_at: now(),
    };

    const updatedJob = updateJob(job.id, {
        nodes_traversed: [...job.nodes_traversed, "critic"],
        artifacts: [...job.artifacts, criticArtifact],
        costs_so_far: [...job.costs_so_far, response.cost],
    });

    await appendEntry(
        "agent",
        "critic",
        job.id,
        `Criticism: ${parsed.action.toUpperCase()} - ${parsed.reasoning?.substring(0, 100)}`,
    );

    return { ...updatedJob, _criticResult: parsed };
}
