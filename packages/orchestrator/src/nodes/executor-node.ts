import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now, shortTime, parseFailureMessage } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { memoryRead, memoryWrite } from "@cairn/memory";
import { executeTool } from "@cairn/executor";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";
import { z } from "zod";

const SYSTEM_PROMPT = `You are Cairn's executor — the part of the system that takes action. You have tools and you use them.

## Available Tools

### Memory
- memory_read(tier, key): Read from memory ("hot" = session, "warm" = persistent)
- memory_write(tier, key, value): Store information (warm = permanent, hot = session-only)
- vector_search(query): Semantic search over long-term documents

### Information
- web_search(query): Search the web via DuckDuckGo
- fetch_url(url): Fetch content from a URL
- calendar_read(days): Read calendar events for next N days
- gmail_read(max_results): Read recent emails

### Goals & Tasks
- goals_read(): Read all goals with details (active goals guide your behavior)
- goals_update(goal_id, ...): Update a goal — add timeline events, change status, adjust confidence
- tasks_read(status?): Read tasks (optionally filter by "todo"/"done")
- tasks_create(title, type?, scheduled_date?, due_date?): Create a task for the user
- tasks_complete(task_id): Mark a task as done

### System
- ledger_write(type, content): Log to audit trail

## When to Use Goals/Tasks Tools
- If the user discusses progress on something, check goals_read() to see if it relates to a goal, then goals_update() to add a timeline event
- If the user mentions something they need to do, create a task with tasks_create()
- If the conversation reveals something is done, use tasks_complete() or goals_update() to track it
- Always be proactive: connect what the user says to their goals

## Memory Strategy
- Store important facts to warm memory (user details, preferences, context)
- Use vector_search when the user asks about something that might be in past conversations/documents
- Always check memory before asking the user something you might already know

## Response Format

Respond with ONE of these JSON structures:

1. Use a tool:
{ "action": "tool", "tool": "tool_name", "args": { ... }, "reasoning": "why" }

2. Task complete:
{ "action": "complete", "result": "response to user", "summary": "brief log" }

3. Blocked:
{ "action": "blocked", "reason": "why", "result": "explanation for user" }

CRITICAL: "action" must be exactly "tool", "complete", or "blocked".`;

// Whitelist of allowed tool names (security hardening)
const ALLOWED_EXECUTOR_TOOLS = [
  "memory_read",
  "memory_write",
  "ledger_write",
  "web_search",
  "fetch_url",
  "gmail_read",
  "calendar_read",
  "vector_search",
  "goals_read",
  "goals_update",
  "tasks_read",
  "tasks_create",
  "tasks_complete",
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

    if (!toolResult.success) {
      const failure = parseFailureMessage(toolResult.output);
      parsed = {
        action: "blocked",
        reason: failure.code ?? "TOOL_EXECUTION_FAILED",
        result: `I couldn't complete that because ${failure.message || "the requested capability failed"}.`,
      };
    } else {
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
