import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now, shortTime } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { warmGet } from "@cairn/memory";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";
import { z } from "zod";

const SYSTEM_PROMPT = `You are the Cairn planner. You receive a user task and create an execution plan.

You have access to the user's preferences and context from warm memory. Use this context to personalize responses.

The executor node has access to the following tools:
- memory_read(tier, key): Read from memory (tier: "hot" for session, "warm" for persistent)
- memory_write(tier, key, value): Write to memory to remember important information
- ledger_write(type, content): Log an entry
- web_search(query): Search the web for information
- fetch_url(url): Fetch the content of a public URL

Memory Guidelines:
- Use memory_write to remember: user preferences, learned facts, important context
- Examples: location preferences, work details, recurring requests, personal info
- Check memory first before asking the user for info you might already know

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
- Include memory_read in tools_needed if you should check stored context first
- Include memory_write in tools_needed if you should remember something important
- Be thorough but concise in your plans`;

// Whitelist of allowed tool names (security hardening)
const ALLOWED_TOOLS = [
  "memory_read",
  "memory_write",
  "ledger_write",
  "web_search",
  "fetch_url",
] as const;

// Zod schema for LLM response validation (security hardening)
const PlannerResponseSchema = z.object({
  plan: z.string().max(2000), // Limit output size
  steps: z.array(z.string().max(500)).max(20), // Max 20 steps, each 500 chars
  response: z.string().max(2000), // Limit output size
  needs_executor: z.boolean(),
  tools_needed: z.array(z.enum(ALLOWED_TOOLS)), // Only allow whitelisted tools
});

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

  // Parse and validate LLM response with Zod
  let parsed: PlannerResult;

  try {
    const jsonParsed = JSON.parse(response.content);
    const validationResult = PlannerResponseSchema.safeParse(jsonParsed);

    if (!validationResult.success) {
      console.error("[planner] Validation failed:", validationResult.error);
      await appendEntry(
        "agent",
        "planner",
        job.id,
        `LLM response validation failed: ${validationResult.error.message}`,
      );
      // Fall back to safe defaults - treat raw content as direct response
      parsed = {
        plan: "Direct response",
        steps: [],
        response: response.content.substring(0, 2000), // Truncate for safety
        needs_executor: false,
        tools_needed: [],
      };
    } else {
      parsed = validationResult.data;
    }
  } catch (err) {
    console.error("[planner] JSON parse error:", err);
    await appendEntry(
      "agent",
      "planner",
      job.id,
      `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    parsed = {
      plan: "Direct response",
      steps: [],
      response: response.content.substring(0, 2000), // Truncate for safety
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
