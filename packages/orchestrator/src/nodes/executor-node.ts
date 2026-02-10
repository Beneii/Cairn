import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now, shortTime } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { memoryRead, memoryWrite } from "@cairn/memory";
import { executeTool, executeTools } from "@cairn/executor";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";
import { z } from "zod";

const SYSTEM_PROMPT = `You are Cairn's executor — the part of the system that takes action. You have tools and you use them. You must output valid JSON.

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
- note_create(content): Create a persistent note/document in the dashboard
- research_ingest(url): Ingest web content or PDF into cold memory

### Browser (Secure)
- browser_navigate(url): Navigate to a URL
- browser_click(selector): Click an element
- browser_fill(selector, value): Fill an input field (use browser_type for search bars)
- browser_type(selector, text, delay?): Type text into an input (wait+click+type)
- browser_press(key): Press a key (e.g. Enter)
- browser_screenshot(url?): Take a screenshot

### Browser Usage Pattern (How to Search)
### Browser Usage Pattern (How to Search)
### Browser Usage Pattern (How to Search)
To search on a website (e.g. YouTube, Google):
1. browser_navigate(url) (e.g., https://www.youtube.com)
2. browser_type(selector, query) (e.g., 'input[name="search_query"]', 'openclaw')
   - DO NOT USE browser_fill for search bars.
   - DO NOT USE browser_click on the input first (browser_type handles it).
3. browser_press(key) (e.g., 'Enter')
4. Wait for page load (implicitly handled)

IMPORTANT: You MUST chain these tools in a SINGLE response. Do not returning after navigation.
Example tools array:
[
  { "name": "browser_navigate", "args": { "url": "..." } },
  { "name": "browser_type", "args": { "selector": "...", "text": "..." } },
  { "name": "browser_press", "args": { "key": "Enter" } }
]

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

1. Use tool(s):
{
  "action": "tool",
  "tools": [
    { "name": "tool_name", "args": { ... } },
    { "name": "tool_name_2", "args": { ... } }
  ],
  "reasoning": "Execute these steps in order"
}

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
  "tasks_read",
  "tasks_create",
  "tasks_complete",
  "note_create",
  "research_ingest",
  "browser_navigate",
  "browser_click",
  "browser_fill",
  "browser_type",
  "browser_press",
  "browser_screenshot",
  "browser_close",
] as const;

// Zod schemas for LLM response validation (security hardening)
const ExecutorToolActionSchema = z.object({
  action: z.literal("tool"),
  tools: z.array(z.object({
    name: z.enum(ALLOWED_EXECUTOR_TOOLS),
    args: z.record(z.string(), z.unknown()).optional(),
  })),
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

  // Handle tool calls
  if (parsed.action === "tool" && "tools" in parsed && Array.from(parsed.tools as any[]).length > 0) {
    const tools = parsed.tools as { name: string; args?: Record<string, unknown> }[];
    const toolResults = await executeTools(
      tools.map(t => ({ name: t.name, args: t.args || {} })),
      {
        jobId: job.id,
        nodeName: "executor",
        allowedTools: config.allowed_tools,
        memoryRead: (tier: string, key: string) =>
          memoryRead(tier as "hot" | "warm" | "cold", key, memAccess),
        memoryWrite: (tier: string, key: string, value: any) =>
          memoryWrite(tier as "hot" | "warm", key, value, memAccess),
      },
    );

    for (let i = 0; i < tools.length; i++) {
      toolOutputs.push(`${tools[i].name}: ${toolResults[i].output}`);
    }

    // Follow-up LLM call to synthesize the results
    const followUp = await callLLM(
      {
        model: config.assigned_model,
        systemPrompt:
          'You just ran tools. Synthesize the results into a clear, user-friendly response. You must output valid JSON.\n\n' +
          'For web_search results, format as a readable list with titles and URLs.\n' +
          'For other tools, present the information clearly.\n\n' +
          'If the task was SUCCESSFUL, respond with:\n' +
          '{ "result": "formatted response text", "summary": "brief summary" }\n\n' +
          'If the task COULD NOT be completed, respond with:\n' +
          '{ "action": "blocked", "reason": "why it failed", "result": "explanation for user" }',
        userMessage: `Original task: ${job.input}\nTools used: ${tools.map(t => t.name).join(', ')}\nOutputs: ${toolResults.map((r: any) => r.output).join('\n---\n')}`,
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
