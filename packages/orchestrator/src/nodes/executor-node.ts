import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now, shortTime } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { memoryRead, memoryWrite } from "@cairn/memory";
import { executeTool } from "@cairn/executor";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";

const SYSTEM_PROMPT = `You are the Cairn executor. You execute tasks based on a plan.

Available tools:
- memory_read(tier, key): Read from memory
- memory_write(tier, key, value): Write to memory
- ledger_write(type, content): Log an entry

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
}`;

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

  let parsed: {
    action: string;
    tool?: string;
    args?: Record<string, unknown>;
    result?: string;
    summary?: string;
    reasoning?: string;
  };
  try {
    parsed = JSON.parse(response.content);
  } catch {
    parsed = {
      action: "complete",
      result: response.content,
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
          'You just ran a tool. Synthesize the result into a user-friendly response. Respond in JSON: { "result": "...", "summary": "..." }',
        userMessage: `Original task: ${job.input}\nTool used: ${parsed.tool}\nTool output: ${toolResult.output}`,
        maxTokens: 2000,
        responseFormat: "json_object",
      },
      "executor",
      job.id,
    );

    costs.push(followUp.cost);

    try {
      const followParsed = JSON.parse(followUp.content);
      parsed = {
        action: "complete",
        result: followParsed.result,
        summary: followParsed.summary,
      };
    } catch {
      parsed = {
        action: "complete",
        result: followUp.content,
        summary: "Execution complete",
      };
    }
  }

  // Create result artifact
  const resultArtifact: Artifact = {
    id: newId(),
    type: "result",
    content: parsed.result || parsed.summary || "Task complete",
    metadata: { tool_outputs: toolOutputs },
    origin_node: "executor",
    created_at: now(),
  };

  const updatedJob = updateJob(job.id, {
    status: "done",
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
    `Execution complete: ${(parsed.summary || "").substring(0, 200)}`,
  );

  return updatedJob;
}
