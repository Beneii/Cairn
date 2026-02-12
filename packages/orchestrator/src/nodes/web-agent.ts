import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now, shortTime } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";
import { getTool, executeTool } from "@cairn/executor";
import { z } from "zod";

const SYSTEM_PROMPT = `You are Cairn's Web Agent. Your job is to interact with the web to achieve a goal.
You operate in an autonomous loop: Observe -> Decide -> Act.

## Capabilities
You have high-level browser tools:
- browser_navigate(url)
- browser_click(selector)
- browser_type(selector, text, delay)
- browser_press(key)
- browser_screenshot()
- browser_close()

## Strategy
1. **Observe**: Look at the page summary (elements, URL, title).
2. **Plan**: Decide the next small step.
3. **Act**: Execute ONE or MORE tools to move toward the goal.
4. **Repeat**: Continue until the task is complete or you are stuck.

## Selection Tips
- Use 'input[name="search_query"]' for YouTube search.
- Use 'Enter' after typing to submit.
- If you see a consent modal, click 'Accept' or similar.

## Output Format
You MUST respond in JSON:
{
  "action": "tool" | "complete" | "fail",
  "reasoning": "Explain your thought process",
  "tools": [
    { "name": "tool_name", "args": { ... } }
  ],
  "result_for_user": "Final answer if complete"
}`;

const WebAgentResponseSchema = z.object({
    action: z.enum(["tool", "complete", "fail"]),
    reasoning: z.string(),
    tools: z.array(z.object({
        name: z.string(),
        args: z.record(z.string(), z.unknown())
    })).optional(),
    result_for_user: z.string().optional()
});

export async function runWebAgent(job: Job): Promise<Job> {
    const config = getNodeConfig("web_agent");
    checkCaller("orchestrator", "web_agent");
    const prevNode = job.nodes_traversed[job.nodes_traversed.length - 1] || "gatekeeper";
    checkTransition(prevNode, "web_agent");

    let currentJob = job;
    let turns = 0;
    const MAX_TURNS = 10;

    const browserObserve = getTool("browser_observe"); // We need to register this
    if (!browserObserve) {
        throw new Error("browser_observe tool not found. Ensure it is registered in executor/src/tools.ts");
    }

    await appendEntry("agent", "web_agent", job.id, "Starting autonomous Web Agent session");

    const messages: any[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Goal: ${job.input}` }
    ];

    while (turns < MAX_TURNS) {
        turns++;

        // 1. OBSERVE
        const observation = await browserObserve({}, { jobId: job.id, nodeName: "web_agent", allowedTools: [], memoryRead: () => undefined, memoryWrite: async () => { } } as any);

        messages.push({
            role: "user",
            content: `Current Observation (Turn ${turns}/${MAX_TURNS}):\n${observation.output}`
        });

        // 2. DECIDE
        const response = await callLLM({
            model: config.assigned_model,
            systemPrompt: SYSTEM_PROMPT, // fallback
            userMessage: `Goal: ${job.input}`, // fallback
            messages: messages,
            maxTokens: 1000,
            responseFormat: "json_object"
        }, "web_agent", job.id);

        messages.push({ role: "assistant", content: response.content });

        try {
            const parsed = WebAgentResponseSchema.parse(JSON.parse(response.content));

            await appendEntry("agent", "web_agent", job.id, `Turn ${turns}: ${parsed.reasoning}`);

            if (parsed.action === "complete") {
                const resultArtifact: Artifact = {
                    id: newId(),
                    type: "result",
                    content: parsed.result_for_user || "Task complete",
                    metadata: { turns },
                    origin_node: "web_agent",
                    created_at: now()
                };

                bus.emit("chat:message", {
                    id: newId(),
                    role: "cairn",
                    text: parsed.result_for_user || "Task complete",
                    timestamp: shortTime()
                });

                return updateJob(currentJob.id, {
                    status: "done",
                    nodes_traversed: [...currentJob.nodes_traversed, "web_agent"],
                    artifacts: [...currentJob.artifacts, resultArtifact],
                    costs_so_far: [...currentJob.costs_so_far, response.cost]
                });
            }

            if (parsed.action === "fail") {
                return updateJob(currentJob.id, {
                    status: "failed",
                    nodes_traversed: [...currentJob.nodes_traversed, "web_agent"],
                    artifacts: [...currentJob.artifacts, { id: newId(), type: "error", content: parsed.reasoning, metadata: {}, origin_node: "web_agent", created_at: now() }],
                    costs_so_far: [...currentJob.costs_so_far, response.cost]
                });
            }

            // 3. ACT
            if (parsed.tools && parsed.tools.length > 0) {
                for (const toolCall of parsed.tools) {
                    await appendEntry("agent", "web_agent", job.id, `Executing: ${toolCall.name}`);
                    const result = await executeTool(
                        { name: toolCall.name, args: toolCall.args as any },
                        { jobId: job.id, nodeName: "web_agent", allowedTools: [], memoryRead: () => undefined, memoryWrite: async () => { } }
                    );
                    // Use result.output or artifacts if needed
                }
            }

        } catch (err) {
            console.error("[web-agent] Loop error:", err);
            break;
        }
    }

    return updateJob(currentJob.id, { status: "failed", nodes_traversed: [...currentJob.nodes_traversed, "web_agent"] });
}
