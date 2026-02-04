import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now, shortTime } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { warmGet } from "@cairn/memory";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";

const SYSTEM_PROMPT = `You are the Cairn planner. You receive a user task and create an execution plan.

You have access to the user's preferences and context from warm memory.

Respond in JSON format:
{
  "plan": "string - describe the plan step by step",
  "steps": ["step 1", "step 2", ...],
  "response": "string - the response to deliver to the user",
  "needs_executor": boolean,
  "tools_needed": ["tool_name", ...]
}

Guidelines:
- For simple questions you can answer directly (needs_executor: false)
- For tasks requiring tool use, create a clear plan (needs_executor: true)
- Be thorough but concise in your plans
- If you can answer the question directly without tools, set needs_executor to false and put the answer in response`;

interface PlannerResult {
  plan: string;
  steps: string[];
  response: string;
  needs_executor: boolean;
  tools_needed: string[];
}

export async function runPlanner(
  job: Job,
): Promise<Job & { _plannerResult?: PlannerResult }> {
  const config = getNodeConfig("planner");
  checkCaller("orchestrator", "planner");
  checkTransition("gatekeeper", "planner");

  bus.emit("nucleus:state", "thinking");

  // Read warm memory for user context
  const preferences = warmGet("user_preferences") ?? {};
  const recentTasks = warmGet("recent_tasks") ?? [];

  const contextBlock = `User preferences: ${JSON.stringify(preferences)}
Recent tasks: ${JSON.stringify(recentTasks)}
User request: ${job.input}`;

  await appendEntry("agent", "planner", job.id, "Planner creating execution plan");

  const response = await callLLM(
    {
      model: config.assigned_model,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: contextBlock,
      maxTokens: config.max_tokens_per_call,
      responseFormat: "json_object",
    },
    "planner",
    job.id,
  );

  let parsed: PlannerResult;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    parsed = {
      plan: "Direct response",
      steps: [],
      response: response.content,
      needs_executor: false,
      tools_needed: [],
    };
  }

  // Create plan artifact
  const planArtifact: Artifact = {
    id: newId(),
    type: "plan",
    content: parsed.plan,
    metadata: { steps: parsed.steps, tools_needed: parsed.tools_needed },
    origin_node: "planner",
    created_at: now(),
  };

  const newStatus = parsed.needs_executor ? "running" : "done";

  const updatedJob = updateJob(job.id, {
    status: newStatus,
    nodes_traversed: [...job.nodes_traversed, "planner"],
    artifacts: [...job.artifacts, planArtifact],
    costs_so_far: [...job.costs_so_far, response.cost],
  });

  await appendEntry(
    "agent",
    "planner",
    job.id,
    `Plan: ${parsed.plan.substring(0, 200)}`,
  );

  // If no executor needed, send response directly
  if (!parsed.needs_executor) {
    bus.emit("chat:message", {
      id: newId(),
      role: "cairn",
      text: parsed.response,
      timestamp: shortTime(),
    });
  }

  return { ...updatedJob, _plannerResult: parsed };
}
