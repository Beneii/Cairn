import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now, shortTime } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { warmGet, isEmbeddingAvailable, createEmbedding, vectorSearch, getColdMemoryStats } from "@cairn/memory";
import { callLLM } from "../llm.js";
import { updateJob } from "../jobs.js";
import { z } from "zod";
import { getCalendarProvider } from "@cairn/executor";

const SYSTEM_PROMPT = `You are the Cairn planner. You receive a user task and create an execution plan.

You have access to the user's preferences and context from warm memory. Use this context to personalize responses.

The executor node has access to the following tools:
- memory_read(tier, key): Read from memory (tier: "hot" for session, "warm" for persistent)
- memory_write(tier, key, value): Write to memory to remember important information
- ledger_write(type, content): Log an entry
- web_search(query): Search the web for information
- fetch_url(url): Fetch the content of a public URL
- calendar_read(days): Read calendar events for N days (requires Google Calendar)
- calendar.find_optimal_slot(duration, preferredTimeOfDay, withinDays): Find best time slots
- vector_search(query): Search long-term memory for semantically similar content

Memory Guidelines:
- Use memory_write to remember: user preferences, learned facts, important context
- Examples: location preferences, work details, recurring requests, personal info
- Check memory first before asking the user for info you might already know
- Use vector_search to find relevant information from past conversations and documents

Schedule Awareness:
- If the user's request conflicts with an upcoming event (within 30 minutes), mention it
- If the user seems busy (6+ hours booked today), suggest deferring non-urgent tasks
- Use calendar.find_optimal_slot when the user wants to schedule something

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
- Include vector_search in tools_needed if the task could benefit from past knowledge
- Be thorough but concise in your plans`;

// Whitelist of allowed tool names (security hardening)
const ALLOWED_TOOLS = [
  "memory_read",
  "memory_write",
  "ledger_write",
  "web_search",
  "fetch_url",
  "calendar_read",
  "calendar.find_optimal_slot",
  "vector_search",
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

function getTimeContext(): { period: string; greeting: string; timestamp: string } {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" });
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  let period: string;
  let greeting: string;

  if (hour < 6) {
    period = "late night";
    greeting = "You're up late!";
  } else if (hour < 12) {
    period = "morning";
    greeting = "Good morning!";
  } else if (hour < 17) {
    period = "afternoon";
    greeting = "Good afternoon!";
  } else if (hour < 21) {
    period = "evening";
    greeting = "Good evening!";
  } else {
    period = "night";
    greeting = "Good evening!";
  }

  return {
    period,
    greeting,
    timestamp: `${dayOfWeek}, ${dateStr} at ${timeStr}`,
  };
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

  // Add time awareness
  const timeContext = getTimeContext();

  // Fetch calendar context (non-blocking — falls back gracefully)
  let calendarContext = "Calendar: not connected";
  try {
    const provider = getCalendarProvider();
    if (provider.name !== "mock") {
      const nextEvent = await provider.getNextEvent();
      if (nextEvent) {
        const minutesUntil = Math.round((new Date(nextEvent.start).getTime() - Date.now()) / (60 * 1000));
        calendarContext = `Next calendar event: "${nextEvent.title}" in ${minutesUntil} minutes`;
        if (nextEvent.location) calendarContext += ` at ${nextEvent.location}`;
      } else {
        calendarContext = "Calendar: no upcoming events";
      }
    }
  } catch {
    // Calendar fetch failed — not critical, continue without it
  }

  // Fetch relevant cold memory context via semantic search
  let coldMemoryContext = "";
  try {
    if (isEmbeddingAvailable()) {
      const stats = getColdMemoryStats();
      if (stats.chunkCount > 0) {
        const { embedding } = await createEmbedding(job.input);
        const results = vectorSearch(embedding, 3, 0.4); // Top 3 results, min score 0.4
        if (results.length > 0) {
          coldMemoryContext = `\n\nRelevant long-term memory (${stats.documentCount} docs total):\n` +
            results.map((r, i) => `${i + 1}. [${r.document_source}] ${r.content.substring(0, 300)}...`).join("\n");
        }
      }
    }
  } catch (err) {
    console.log("[planner] Cold memory search failed:", err);
    // Not critical, continue without it
  }

  const contextBlock = `Current time: ${timeContext.timestamp} (${timeContext.period})
${calendarContext}${coldMemoryContext}
User preferences: ${JSON.stringify(preferences)}
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
