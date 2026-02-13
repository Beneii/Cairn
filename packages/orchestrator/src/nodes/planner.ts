import { getNodeConfig, checkCaller, checkTransition } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { bus, newId, now, shortTime } from "@cairn/shared";
import type { Job, Artifact } from "@cairn/shared";
import { isEmbeddingAvailable, createEmbedding, vectorSearch, getColdMemoryStats, warmGet } from "@cairn/memory";
import { callLLM } from "../llm.js";
import { parseJsonObjectFromLLM, repairJsonViaLLM, sanitizeLogSnippet } from "../utils.js";
import { updateJob } from "../jobs.js";
import { z } from "zod";
import { getCalendarProvider } from "@cairn/executor";
import { getActiveGoals } from "@cairn/goals";
import { getTasks } from "@cairn/tasks";

const SYSTEM_PROMPT = `You are Cairn's planner. You decide how to handle the user's request and create execution plans. You must output valid JSON.
IMPORTANT: Output raw JSON only. Do NOT wrap the JSON in markdown code fences (e.g. \`\`\`json). Do NOT include commentary outside the JSON object.

You are a personal assistant — warm, direct, helpful. You know the user's active goals and tasks and should always consider them.

Browser automation is available through executor tools when needed.

## What the Executor Can Do

The executor has these tools:
- memory_read/write: Read and store persistent information about the user
- web_search, fetch_url: Search the web, fetch pages
- calendar_read, gmail_read: Read calendar events and emails
- weather_get: Get current weather and forecast
- vector_search: Search long-term memory (documents, past conversations)
- research_ingest: Securely ingest web content or PDF into cold memory
- browser_navigate, browser_click, browser_type, browser_press, browser_screenshot: Securely interact with web pages (fill forms, press keys, capture visuals)
- note_create: Create a persistent note/document in the dashboard (use this for writing reports, stories, or structured data)
- goals_read, goals_update: Read goals, add timeline events, update status/confidence
- tasks_read, tasks_create, tasks_complete: Read/create/complete tasks

## Decision Making

- Simple questions/greetings you can answer yourself → needs_executor: false
- Anything requiring tools, web lookups, memory access, or goal/task management → needs_executor: true
- If the user mentions progress on something, route to executor so it can update the relevant goal's timeline
- If the user mentions something they need to do, route to executor to create a task
- If the request relates to a goal, mention the connection in your plan

## Response Format (JSON)
{
  "plan": "step-by-step plan description",
  "steps": ["step 1", "step 2", ...],
  "response": "response text for the user (used only if needs_executor is false)",
  "needs_executor": true/false,
  "tools_needed": ["tool_name", ...]
}

## Style
- Be conversational, not robotic
- Keep responses concise but thoughtful
- Connect things to the user's goals when relevant — you're tracking their life, not just answering questions
- If you can answer directly without tools, do so (needs_executor: false) — don't over-route`;

const JSON_REPAIR_PROMPT = `Return ONLY one valid JSON object. No prose, no markdown, no code fences.`;

// Whitelist of allowed tool names (security hardening)
const ALLOWED_TOOLS = [
  "memory_read",
  "memory_write",
  "ledger_write",
  "web_search",
  "fetch_url",
  "gmail_read",
  "calendar_read",
  "weather_get",
  "vector_search",
  "goals_read",
  "goals_update",
  "tasks_read",
  "tasks_create",
  "tasks_complete",
  "research_ingest",
  "browser_navigate",
  "browser_click",
  "browser_type",
  "browser_press",
  "browser_fill",
  "browser_screenshot",
  "browser_close",
  "note_create",
] as const;

// Zod schema for LLM response validation (security hardening)
const PlannerResponseSchema = z.object({
  plan: z.string().max(2000),
  steps: z.array(z.string().max(500)).max(20),
  response: z.string().min(1).max(2000),
  needs_executor: z.boolean(),
  tools_needed: z.array(z.enum(ALLOWED_TOOLS)),
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

  // Read conversation history so the planner can reference recent messages
  const chatHistory = warmGet<{ role: string; content: string }[]>("chat_history") || [];

  // Read active goals
  const activeGoals = getActiveGoals();

  // Read active tasks
  const activeTasks = getTasks({ status: "todo" });

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

  const goalsBlock = activeGoals.length > 0
    ? `Active Goals (${activeGoals.length}):\n${activeGoals.map(g => `- ${g.title}: ${g.success_definition} (Priority: ${g.priority}, Confidence: ${g.confidence ?? "?"})`).join("\n")}`
    : "Active Goals: none";

  const tasksBlock = activeTasks.length > 0
    ? `Open Tasks (${activeTasks.length}):\n${activeTasks.map((t: any) => `- ${t.title}${t.due_date ? ` (due: ${t.due_date})` : ""}${t.scheduled_date ? ` (scheduled: ${t.scheduled_date})` : ""}`).join("\n")}`
    : "Open Tasks: none";

  // Build conversation history block (last ~5 exchanges, skip current message which is in job.input)
  const historyBlock = chatHistory.length > 0
    ? `Recent conversation:\n${chatHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join("\n")}`
    : "";

  const contextBlock = `Current time: ${timeContext.timestamp} (${timeContext.period})
${calendarContext}${coldMemoryContext}
${historyBlock ? historyBlock + "\n" : ""}${goalsBlock}
${tasksBlock}
User request: ${job.input}`;

  await appendEntry("agent", "planner", job.id, "Planner creating execution plan");

  const response = await callLLM(
    {
      model: config.assigned_model,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: contextBlock,
      maxTokens: config.max_tokens_per_call,
      responseFormat: "json_object",
      temperature: 0,
    },
    "planner",
    job.id,
  );

  // Parse and validate LLM response with repair fallback
  let parsed: PlannerResult;

  try {
    const jsonParsed = parseJsonObjectFromLLM(response.content);
    const validationResult = PlannerResponseSchema.safeParse(jsonParsed);

    if (!validationResult.success) {
      const repaired = await repairJsonViaLLM(response.content, async (input) => {
        const repair = await callLLM(
          {
            model: config.assigned_model,
            systemPrompt: JSON_REPAIR_PROMPT,
            userMessage: input,
            maxTokens: 260,
            responseFormat: "json_object",
            temperature: 0,
          },
          "planner",
          job.id,
        );
        return repair.content;
      });

      if (repaired) {
        const repairedValidation = PlannerResponseSchema.safeParse(repaired);
        if (repairedValidation.success) {
          parsed = repairedValidation.data;
        } else {
          throw repairedValidation.error;
        }
      } else {
        throw validationResult.error;
      }
    } else {
      parsed = validationResult.data;
    }
  } catch (err) {
    console.error("[planner] JSON parse/validation error:", err);
    await appendEntry(
      "agent",
      "planner",
      job.id,
      `Planner parse failed. Raw snippet: ${sanitizeLogSnippet(response.content)}`,
    );
    parsed = {
      plan: "Failed to create a valid plan",
      steps: [],
      response: "I couldn't generate a valid response. Please retry.",
      needs_executor: false,
      tools_needed: [],
    };
  }

  if (!parsed.response || !parsed.response.trim()) {
    parsed.response = "I couldn't generate a valid response. Please retry.";
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
