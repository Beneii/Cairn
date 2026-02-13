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
import { parseJsonObjectFromLLM, repairJsonViaLLM, sanitizeLogSnippet } from "../utils.js";

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
- You are Cairn — never refer to yourself by your model name (Phi, GPT, LLaMA, etc). If the user asks who you are, say you are Cairn.
- Be warm and conversational, not robotic
- Keep acknowledgements brief (1 sentence)
- When routing to planner, your acknowledgement is NOT shown — the planner/executor will respond`;

const JSON_REPAIR_PROMPT = `Return ONLY one valid JSON object. No prose, no markdown, no code fences.`;

const GatekeeperResponseSchema = z.object({
  intent: z.enum(["greeting", "question", "task", "note"]),
  complexity: z.enum(["small", "medium", "large"]),
  acknowledgement: z.string().min(1).max(500),
  needs_planner: z.boolean(),
  needs_web_agent: z.boolean(),
  is_task: z.boolean(),
});

import type { ChatAttachment } from "@cairn/shared";

type GatekeeperParsed = z.infer<typeof GatekeeperResponseSchema>;


const GREETING_RE = /^(hi|hello|hey|yo|sup|good\s+(morning|afternoon|evening)|thanks|thank you|ok|okay|cool|nice|great)\b[!.?\s]*$/i;
const WEB_ACTION_RE = /\b(open|go to|navigate to|visit|search|click|login|sign in|browse|youtube|website|web page|google)\b/i;

function normalizeGatekeeperSafeDefault(): GatekeeperParsed {
  return {
    intent: "greeting",
    complexity: "small",
    acknowledgement: "Sorry — routing failed. Please try again.",
    needs_planner: false,
    needs_web_agent: false,
    is_task: false,
  };
}

async function parseGatekeeperResponse(responseContent: string, configModel: string): Promise<GatekeeperParsed> {
  try {
    const parsed = GatekeeperResponseSchema.parse(parseJsonObjectFromLLM(responseContent));
    return parsed;
  } catch (parseErr) {
    const repaired = await repairJsonViaLLM(responseContent, async (input) => {
      const repair = await callLLM(
        {
          model: configModel,
          systemPrompt: JSON_REPAIR_PROMPT,
          userMessage: input,
          maxTokens: 180,
          responseFormat: "json_object",
          temperature: 0,
        },
        "gatekeeper",
        "pending",
      );
      return repair.content;
    });

    if (repaired) {
      const validation = GatekeeperResponseSchema.safeParse(repaired);
      if (validation.success) return validation.data;
    }

    throw parseErr;
  }
}

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

  if (attachments && attachments.length > 0) {
    const job = createJob(userInput, attachments);

    updateJob(job.id, {
      intent: "task",
      complexity: "medium",
      nodes_traversed: ["gatekeeper"],
      status: "running",
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

  const trimmedInput = userInput.trim();

  if (GREETING_RE.test(trimmedInput)) {
    const job = createJob(userInput);
    const direct = {
      intent: "greeting",
      complexity: "small",
      acknowledgement: "Hey — I’m here. What can I help with?",
      needs_planner: false,
      needs_web_agent: false,
      is_task: false,
    } satisfies GatekeeperParsed;

    updateJob(job.id, {
      intent: direct.intent,
      complexity: direct.complexity,
      nodes_traversed: ["gatekeeper"],
      status: "done",
      metadata: { is_task: direct.is_task, needs_web_agent: direct.needs_web_agent }
    });

    bus.emit("chat:message", {
      id: newId(),
      role: "cairn",
      text: direct.acknowledgement,
      timestamp: shortTime(),
    });

    return {
      ...job,
      intent: direct.intent,
      complexity: direct.complexity,
      nodes_traversed: ["gatekeeper"],
      status: "done",
      metadata: { is_task: direct.is_task, needs_web_agent: direct.needs_web_agent }
    };
  }

  if (WEB_ACTION_RE.test(trimmedInput)) {
    const job = createJob(userInput);

    updateJob(job.id, {
      intent: "task",
      complexity: "medium",
      nodes_traversed: ["gatekeeper"],
      status: "running",
      metadata: { is_task: true, needs_web_agent: true }
    });

    await appendEntry("agent", "gatekeeper", job.id, "Direct web-action routing: needs_web_agent=true");

    return {
      ...job,
      intent: "task",
      complexity: "medium",
      nodes_traversed: ["gatekeeper"],
      status: "running",
      metadata: { is_task: true, needs_web_agent: true }
    };
  }

  const activeGoals = getActiveGoals();
  const history = warmGet<{ role: string; content: string }[]>("chat_history") || [];
  const activeTasks = getTasks({ status: "todo" });

  const historyBlock = history.length > 0
    ? `\nRecent Chat History:\n${history.map(m => `${m.role}: ${m.content}`).join("\n")}`
    : "";

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
      maxTokens: Math.min(config.max_tokens_per_call, 220),
      responseFormat: "json_object",
      temperature: 0,
    },
    "gatekeeper",
    "pending",
  );

  let parsed: GatekeeperParsed;

  try {
    parsed = await parseGatekeeperResponse(response.content, config.assigned_model);
  } catch (err) {
    console.error("[gatekeeper] parse/validation failed:", err);
    await appendEntry(
      "agent",
      "gatekeeper",
      "error",
      `Gatekeeper parse failed. Raw snippet: ${sanitizeLogSnippet(response.content)}`,
    );
    parsed = normalizeGatekeeperSafeDefault();
  }

  const job = createJob(userInput);

  updateJob(job.id, {
    intent: parsed.intent,
    complexity: parsed.complexity as Job["complexity"],
    nodes_traversed: ["gatekeeper"],
    costs_so_far: [response.cost],
    status: (parsed.needs_planner || parsed.needs_web_agent) ? "running" : "done",
    metadata: { is_task: parsed.is_task, needs_web_agent: parsed.needs_web_agent }
  });

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
