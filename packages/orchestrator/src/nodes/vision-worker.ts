
import { getNodeConfig, checkCaller } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import type { Job } from "@cairn/shared";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";
import { newId, now } from "@cairn/shared";

const VISION_PROMPT = `You are a computer vision specialist. 
Your job is to analyze the provided image(s) and the user's request.

1. Describe what you see relevant to the user's prompt.
2. If the user asks a specific question, answer it.
3. If the user asks for a task, extract all relevant details from the image to help the Planner or Executor.

Output clear, concise text. Do not output markdown code blocks unless requested.`;

export async function runVisionWorker(job: Job): Promise<Job> {
    const config = getNodeConfig("vision_worker");
    checkCaller("orchestrator", "vision_worker");

    await appendEntry(
        "agent",
        "vision_worker",
        job.id,
        `Analyzing ${job.attachments?.length || 0} images for request: "${job.input}"`
    );

    // Call LLM with Vision support
    const response = await callLLM(
        {
            model: config.assigned_model, // Use cloud model (gpt-4o)
            systemPrompt: VISION_PROMPT,
            userMessage: job.input,
            maxTokens: config.max_tokens_per_call,
            attachments: job.attachments,
        },
        "vision_worker",
        job.id
    );

    const resultArtifact = {
        id: newId(),
        type: "result", // Standard result
        content: response.content,
        metadata: {
            model: config.assigned_model
        },
        origin_node: "vision_worker",
        created_at: now(),
    };

    updateJob(job.id, {
        status: "done",
        artifacts: [...job.artifacts, resultArtifact],
        costs_so_far: [...job.costs_so_far, response.cost],
        nodes_traversed: [...job.nodes_traversed, "vision_worker"],
    });

    return {
        ...job,
        status: "done",
        artifacts: [...job.artifacts, resultArtifact],
        costs_so_far: [...job.costs_so_far, response.cost],
        nodes_traversed: [...job.nodes_traversed, "vision_worker"],
    };
}
