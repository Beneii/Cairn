import { getNodeConfig, checkCaller } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, shortTime } from "@cairn/shared";
import type { Job } from "@cairn/shared";
import { callLLM } from "../llm.js";
import { createJob, updateJob } from "../jobs.js";
import { z } from "zod";

const SYSTEM_PROMPT = `You are the Cairn gatekeeper. You receive user messages and must:
1. Classify the intent (greeting, question, task, note)
2. Estimate complexity (small, medium, large)
3. Generate an immediate, brief acknowledgement to the user

Respond in JSON format:
{
  "intent": "greeting" | "question" | "task" | "note",
  "complexity": "small" | "medium" | "large",
  "acknowledgement": "string - brief response to user",
  "needs_planner": boolean
}

Guidelines:
- Simple greetings without follow-up: handle directly (needs_planner: false)
- Memory operations (remembering, recalling info): ALWAYS route to planner (needs_planner: true)
- Questions about stored information: route to planner (needs_planner: true)
- Tasks requiring tools or multi-step planning: route to planner (needs_planner: true)
- Web searches, data fetching, complex analysis: route to planner (needs_planner: true)
- Always be brief and conversational in acknowledgements`;

// Zod schema for LLM response validation (security hardening)
const GatekeeperResponseSchema = z.object({
  intent: z.enum(["greeting", "question", "task", "note"]),
  complexity: z.enum(["small", "medium", "large"]),
  acknowledgement: z.string().max(500), // Limit output size
  needs_planner: z.boolean(),
});

export async function runGatekeeper(userInput: string): Promise<Job> {
  const config = getNodeConfig("gatekeeper");
  checkCaller("system", "gatekeeper");

  bus.emit("nucleus:state", "thinking");

  await appendEntry(
    "agent",
    "gatekeeper",
    "pending",
    `Gatekeeper processing: "${userInput.substring(0, 100)}"`,
  );

  const response = await callLLM(
    {
      model: config.assigned_model,
      systemPrompt: SYSTEM_PROMPT,
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
    };
  }

  // Create and update job
  const job = createJob(userInput);
  updateJob(job.id, {
    intent: parsed.intent,
    complexity: parsed.complexity as Job["complexity"],
    nodes_traversed: ["gatekeeper"],
    costs_so_far: [response.cost],
    status: parsed.needs_planner ? "running" : "done",
  });

  // Send acknowledgement to UI
  bus.emit("chat:message", {
    id: newId(),
    role: "cairn",
    text: parsed.acknowledgement,
    timestamp: shortTime(),
  });

  await appendEntry(
    "agent",
    "gatekeeper",
    job.id,
    `Intent: ${parsed.intent}, Complexity: ${parsed.complexity}, Needs planner: ${parsed.needs_planner}`,
  );

  // Return the latest state
  return {
    ...job,
    intent: parsed.intent,
    complexity: parsed.complexity as Job["complexity"],
    nodes_traversed: ["gatekeeper"],
    costs_so_far: [response.cost],
    status: parsed.needs_planner ? "running" : "done",
  };
}
