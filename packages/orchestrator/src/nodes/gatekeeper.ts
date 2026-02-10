import { getNodeConfig, checkCaller } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, shortTime } from "@cairn/shared";
import type { Job } from "@cairn/shared";
import { callLLM } from "../llm.js";
import { createJob, updateJob } from "../jobs.js";
import { z } from "zod";
import { getActiveGoals } from "@cairn/goals";
import { getTasks } from "@cairn/tasks";
import { warmGet } from "@cairn/memory";

const SYSTEM_PROMPT = `You are the Cairn gatekeeper. You receive user messages and decide whether to handle them directly or route to the planner.

You know the user's active goals and tasks. Use this context to give better acknowledgements and make smarter routing decisions.

## Response Format (JSON)
{
  "intent": "greeting" | "question" | "task" | "note",
  "complexity": "small" | "medium" | "large",
  "acknowledgement": "brief, warm response to the user",
  "needs_planner": true/false,
  "needs_web_agent": true/false,
  "is_task": true/false
}

## Routing Rules
- Simple greetings: handle directly (needs_planner: false, needs_web_agent: false)
- Memory operations (remembering, recalling): ALWAYS route to planner
- Web searches, YouTube, browsing, "go to website": ALWAYS set needs_web_agent: true, needs_planner: false.
- General tasks and goals: route to planner (needs_planner: true)
- If a request involves browsing AND complex multi-goal planning, route to planner first.
- If it's a direct web action (e.g. "search openclaw on youtube"), route to web_agent directly.

## Kanban Suitability (is_task)
- Set "is_task": true if the message represents a concrete objective, to-do, task, or significant note that should be tracked on a Kanban board.
- Set "is_task": false for simple greetings ("hi"), acknowledgements ("thanks", "ok"), or small talk that doesn't need a persistent card.

## Style
- Be warm and conversational, not robotic
- Keep acknowledgements brief (1 sentence)
- When routing to planner, your acknowledgement is NOT shown — the planner/executor will respond`;

// Zod schema for LLM response validation (security hardening)
const GatekeeperResponseSchema = z.object({
  intent: z.enum(["greeting", "question", "task", "note"]),
  complexity: z.enum(["small", "medium", "large"]),
  acknowledgement: z.string().max(500), // Limit output size
  needs_planner: z.boolean(),
  needs_web_agent: z.boolean(),
  is_task: z.boolean(),
});

import type { ChatAttachment } from "@cairn/shared";

export async function runGatekeeper(userInput: string, attachments?: ChatAttachment[]): Promise<Job> {
  const config = getNodeConfig("gatekeeper");
  checkCaller("system", "gatekeeper");

  bus.emit("nucleus:state", "thinking");

  await appendEntry(
    "agent",
    "gatekeeper",
    "pending",
    `Gatekeeper processing: "${userInput.substring(0, 100)}"`,
  );
  console.log(`[gatekeeper] Attachments received: ${attachments?.length || 0}`);

  // IMMEDIATE ROUTING: If images are present, route directly to vision_worker
  if (attachments && attachments.length > 0) {
    console.log(`[gatekeeper] Image detected, routing to vision_worker`);
    const job = createJob(userInput, attachments);

    updateJob(job.id, {
      intent: "task",
      complexity: "medium",
      nodes_traversed: ["gatekeeper"],
      status: "running", // It's running because it needs to go to vision_worker
      metadata: { needs_vision: true }
    });

    return {
      ...job,
      intent: "task",
      complexity: "medium",
      nodes_traversed: ["gatekeeper"],
      status: "running",
      metadata: { needs_vision: true }
    };
  }


  // Fetch context for better gating
  const activeGoals = getActiveGoals();
  const history = warmGet<{ role: string; content: string }[]>("chat_history") || [];

  const historyBlock = history.length > 0
    ? `\nRecent Chat History:\n${history.map(m => `${m.role}: ${m.content}`).join("\n")}`
    : "";

  const activeTasks = getTasks({ status: "todo" });

  const goalsBlock = activeGoals.length > 0
    ? `\nActive Goals:\n${activeGoals.map(g => `- ${g.title}`).join("\n")}`
    : "";

  const tasksBlock = activeTasks.length > 0
    ? `\nOpen Tasks:\n${activeTasks.map((t: any) => `- ${t.title}`).join("\n")}`
    : "";

  const response = await callLLM(
    {
      model: config.assigned_model,
      systemPrompt: SYSTEM_PROMPT + goalsBlock + tasksBlock + historyBlock,
      userMessage: userInput,
      maxTokens: config.max_tokens_per_call,
      responseFormat: "json_object",
    },
    "gatekeeper",
    "pending",
  );

  // Parse and validate LLM response with Zod
  let parsed: {
    intent: string;
    complexity: string;
    acknowledgement: string;
    needs_planner: boolean;
    needs_web_agent: boolean;
    is_task: boolean;
  };

  try {
    const jsonParsed = JSON.parse(response.content);
    const validationResult = GatekeeperResponseSchema.safeParse(jsonParsed);

    if (!validationResult.success) {
      console.error("[gatekeeper] Validation failed:", validationResult.error);
      await appendEntry(
        "agent",
        "gatekeeper",
        "error",
        `LLM response validation failed: ${validationResult.error.message}`,
      );
      // Fall back to safe defaults
      parsed = {
        intent: "task",
        complexity: "small",
        acknowledgement: "Let me look into that.",
        needs_planner: true,
        needs_web_agent: false,
        is_task: true,
      };
    } else {
      parsed = validationResult.data;
    }
  } catch (err) {
    console.error("[gatekeeper] JSON parse error:", err);
    await appendEntry(
      "agent",
      "gatekeeper",
      "error",
      `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    parsed = {
      intent: "task",
      complexity: "small",
      acknowledgement: "Let me look into that.",
      needs_planner: true,
      needs_web_agent: false,
      is_task: true,
    };
  }

  // Create and update job
  const job = createJob(userInput);
  // Attach attachments to job immediately
  if (attachments && attachments.length > 0) {
    job.attachments = attachments;
  }

  updateJob(job.id, {
    intent: parsed.intent,
    complexity: parsed.complexity as Job["complexity"],
    nodes_traversed: ["gatekeeper"],
    costs_so_far: [response.cost],
    status: (parsed.needs_planner || parsed.needs_web_agent) ? "running" : "done",
    metadata: { is_task: parsed.is_task, needs_web_agent: parsed.needs_web_agent }
  });

  // Send acknowledgement to UI ONLY if we're handling it directly
  // If routing to planner, let planner/executor send the final response
  if (!parsed.needs_planner && !parsed.needs_web_agent) {
    bus.emit("chat:message", {
      id: newId(),
      role: "cairn",
      text: parsed.acknowledgement,
      timestamp: shortTime(),
    });
  }

  await appendEntry(
    "agent",
    "gatekeeper",
    job.id,
    `Intent: ${parsed.intent}, Complexity: ${parsed.complexity}, Needs planner: ${parsed.needs_planner}, Needs web_agent: ${parsed.needs_web_agent}`,
  );

  // Return the latest state
  return {
    ...job,
    intent: parsed.intent,
    complexity: parsed.complexity as Job["complexity"],
    nodes_traversed: ["gatekeeper"],
    costs_so_far: [response.cost],
    status: (parsed.needs_planner || parsed.needs_web_agent) ? "running" : "done",
    metadata: { is_task: parsed.is_task, needs_web_agent: parsed.needs_web_agent }
  };
}
