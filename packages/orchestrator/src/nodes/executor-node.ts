import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now, shortTime } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { memoryRead, memoryWrite } from "@cairn/memory";
import { executeTool } from "@cairn/executor";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";
import { z } from "zod";

const SYSTEM_PROMPT = `You are the Cairn executor. You execute tasks based on a plan.

Available tools:
- memory_read(tier, key): Read from memory (tier: "hot" or "warm")
- memory_write(tier, key, value): Write to memory to remember things
- ledger_write(type, content): Log an entry
- web_search(query): Search the web for information
- fetch_url(url): Fetch the content of a public URL

Memory Strategy:
- ALWAYS use memory_write to store important information you learn
- Store to "warm" tier for long-term (user preferences, facts about the user)
- Store to "hot" tier for session-only context
- Examples of what to remember:
  * User location/preferences (e.g., "user_location": "Ultimo, Sydney")
  * Work/personal details (e.g., "user_work_location": "UTS")
  * Preferences (e.g., "apartment_preferences": "near transit, quiet area")
  * Important facts learned during conversation

If you need to use a tool, respond with JSON:
{
  "action": "tool",
  "tool": "tool_name",
  "args": { ... },
  "reasoning": "why"
}

If the task is complete or you can answer directly, respond with:
{
  "action": "complete",
  "result": "the final output text for the user",
  "summary": "brief summary for logs"
}

If the task CANNOT be completed (blocked, couldn't find what was requested, no results, etc), respond with:
{
  "action": "blocked",
  "reason": "why the task is blocked",
  "result": "explanation for the user about what happened and why you couldn't complete it"
}

IMPORTANT: Use "blocked" when you tried but couldn't fulfill the request (e.g., no search results, item not found, service unavailable). Don't mark blocked tasks as complete.

Remember: If you learned something important about the user, use memory_write before completing!`;

// Whitelist of allowed tool names (security hardening)
const ALLOWED_EXECUTOR_TOOLS = [
  "memory_read",
  "memory_write",
  "ledger_write",
  "web_search",
  "fetch_url",
] as const;

// Zod schemas for LLM response validation (security hardening)
const ExecutorToolActionSchema = z.object({
  action: z.literal("tool"),
  tool: z.enum(ALLOWED_EXECUTOR_TOOLS),
  args: z.record(z.string(), z.unknown()).optional(),
  reasoning: z.string().max(500).optional(),
});

const ExecutorCompleteActionSchema = z.object({
  action: z.literal("complete"),
  result: z.string().max(5000), // Limit output size
  summary: z.string().max(500).optional(),
});

const ExecutorBlockedActionSchema = z.object({
  action: z.literal("blocked"),
  reason: z.string().max(500),
  result: z.string().max(5000), // Explanation for user
});

const ExecutorActionSchema = z.union([
  ExecutorToolActionSchema,
  ExecutorCompleteActionSchema,
  ExecutorBlockedActionSchema,
]);

const ExecutorSynthesisSuccessSchema = z.object({
  result: z.string().max(5000), // Limit output size
  summary: z.string().max(500).optional(),
});

const ExecutorSynthesisBlockedSchema = z.object({
  action: z.literal("blocked"),
  reason: z.string().max(500),
  result: z.string().max(5000),
});

const ExecutorSynthesisSchema = z.union([
  ExecutorSynthesisSuccessSchema,
  ExecutorSynthesisBlockedSchema,
]);

export async function runExecutorNode(job: Job): Promise<Job> {
  const config = getNodeConfig("executor");
  checkCaller("orchestrator", "executor");
  checkTransition("planner", "executor");

  bus.emit("nucleus:state", "tooling", [
    {
      id: "exec-1",
      name: "executor",
      action: "executing",
      model: config.assigned_model,
    },
  ]);

  const planArtifact = job.artifacts.find((a) => a.type === "plan");
  const planText = planArtifact ? planArtifact.content : job.input;

  await appendEntry("agent", "executor", job.id, "Executor running plan");

  const memAccess = {
    read: config.memory_access,
    write: config.memory_write,
  };

  const response = await callLLM(
    {
      model: config.assigned_model,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: `Task: ${job.input}\nPlan: ${planText}`,
      maxTokens: config.max_tokens_per_call,
      responseFormat: "json_object",
    },
    "executor",
    job.id,
  );

  // Parse and validate LLM response with Zod
  let parsed: {
    action: string;
    tool?: string;
    args?: Record<string, unknown>;
    result?: string;
    summary?: string;
    reasoning?: string;
    reason?: string; // For blocked action
  };

  try {
    const jsonParsed = JSON.parse(response.content);
    const validationResult = ExecutorActionSchema.safeParse(jsonParsed);

    if (!validationResult.success) {
      console.error("[executor] Validation failed:", validationResult.error);
      await appendEntry(
        "agent",
        "executor",
        job.id,
        `LLM response validation failed: ${validationResult.error.message}`,
      );
      // Fall back to treating content as direct result
      parsed = {
        action: "complete",
        result: response.content.substring(0, 5000), // Truncate for safety
        summary: "Direct response",
      };
    } else {
      parsed = validationResult.data;
    }
  } catch (err) {
    console.error("[executor] JSON parse error:", err);
    await appendEntry(
      "agent",
      "executor",
      job.id,
      `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    parsed = {
      action: "complete",
      result: response.content.substring(0, 5000), // Truncate for safety
      summary: "Direct response",
    };
  }

  const toolOutputs: string[] = [];
  const costs = [...job.costs_so_far, response.cost];

  // Handle tool call (single pass for MVP)
  if (parsed.action === "tool" && parsed.tool) {
    const toolResult = await executeTool(
      { name: parsed.tool, args: parsed.args || {} },
      {
        jobId: job.id,
        nodeName: "executor",
        allowedTools: config.allowed_tools,
        memoryRead: (tier, key) =>
          memoryRead(tier as "hot" | "warm" | "cold", key, memAccess),
        memoryWrite: (tier, key, value) =>
          memoryWrite(tier as "hot" | "warm", key, value, memAccess),
      },
    );
    toolOutputs.push(`${parsed.tool}: ${toolResult.output}`);

    // Follow-up LLM call to synthesize the result
    const followUp = await callLLM(
      {
        model: config.assigned_model,
        systemPrompt:
          'You just ran a tool. Synthesize the result into a clear, user-friendly response.\n\n' +
          'For web_search results, format as a readable list with titles and URLs (not raw JSON).\n' +
          'For other tools, present the information clearly and concisely.\n\n' +
          'If the task was SUCCESSFUL, respond with:\n' +
          '{ "result": "formatted response text", "summary": "brief summary" }\n\n' +
          'If the task COULD NOT be completed (no results found, item not available, etc), respond with:\n' +
          '{ "action": "blocked", "reason": "why it failed", "result": "explanation for user" }',
        userMessage: `Original task: ${job.input}\nTool used: ${parsed.tool}\nTool output: ${toolResult.output}`,
        maxTokens: 2000,
        responseFormat: "json_object",
      },
      "executor",
      job.id,
    );

    costs.push(followUp.cost);

    // Parse and validate follow-up synthesis with Zod
    try {
      const followParsed = JSON.parse(followUp.content);
      const validationResult = ExecutorSynthesisSchema.safeParse(followParsed);

      if (!validationResult.success) {
        console.error("[executor] Synthesis validation failed:", validationResult.error);
        await appendEntry(
          "agent",
          "executor",
          job.id,
          `Synthesis validation failed: ${validationResult.error.message}`,
        );
        parsed = {
          action: "complete",
          result: followUp.content.substring(0, 5000), // Truncate for safety
          summary: "Execution complete",
        };
      } else {
        const data = validationResult.data;
        if ("action" in data && data.action === "blocked") {
          // Synthesis indicated the task is blocked
          parsed = {
            action: "blocked",
            result: data.result,
            reason: data.reason,
          };
        } else {
          // Successful synthesis
          parsed = {
            action: "complete",
            result: data.result,
            summary: "summary" in data ? data.summary : undefined,
          };
        }
      }
    } catch (err) {
      console.error("[executor] Synthesis parse error:", err);
      await appendEntry(
        "agent",
        "executor",
        job.id,
        `Synthesis parse failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      parsed = {
        action: "complete",
        result: followUp.content.substring(0, 5000), // Truncate for safety
        summary: "Execution complete",
      };
    }
  }

  // Determine job status based on action
  const isBlocked = parsed.action === "blocked";
  const jobStatus = isBlocked ? "failed" : "done";

  // Create result artifact
  const resultArtifact: Artifact = {
    id: newId(),
    type: isBlocked ? "blocked" : "result",
    content: parsed.result || parsed.summary || "Task complete",
    metadata: {
      tool_outputs: toolOutputs,
      ...(isBlocked && parsed.reason ? { blocked_reason: parsed.reason } : {}),
    },
    origin_node: "executor",
    created_at: now(),
  };

  const updatedJob = updateJob(job.id, {
    status: jobStatus,
    nodes_traversed: [...job.nodes_traversed, "executor"],
    artifacts: [...job.artifacts, resultArtifact],
    costs_so_far: costs,
  });

  // Send final response to UI
  bus.emit("chat:message", {
    id: newId(),
    role: "cairn",
    text: parsed.result || "Task completed.",
    timestamp: shortTime(),
    tools: toolOutputs.length > 0 ? toolOutputs : undefined,
  });

  bus.emit("nucleus:state", "idle");

  await appendEntry(
    "agent",
    "executor",
    job.id,
    isBlocked
      ? `Execution blocked: ${(parsed.reason || "").substring(0, 200)}`
      : `Execution complete: ${(parsed.summary || "").substring(0, 200)}`,
  );

  return updatedJob;
}
