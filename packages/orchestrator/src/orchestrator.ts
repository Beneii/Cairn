import { bus, newId, now, shortTime, redactError } from "@cairn/shared";
import type { Job } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { warmGet, warmSet } from "@cairn/memory";
import { runGatekeeper } from "./nodes/gatekeeper.js";
import { runPlanner } from "./nodes/planner.js";
import { runExecutorNode } from "./nodes/executor-node.js";

// Auto-capture recent conversations to warm memory
function captureRecentTask(job: Job): void {
  try {
    const recent = warmGet("recent_tasks") || [];
    const tasks = Array.isArray(recent) ? recent : [];

    // Keep last 10 tasks
    const updated = [
      { input: job.input, timestamp: now() },
      ...tasks.slice(0, 9)
    ];

    warmSet("recent_tasks", updated);
  } catch (err) {
    console.error("[orchestrator] Failed to capture recent task:", err);
  }
}

// Append the AI response to chat history so future turns see it
function appendHistory(withUser: { role: string; content: string }[], job: Job): void {
  try {
    // Find the actual response text from artifacts (executor uses "result", planner uses "plan")
    const resultArtifact = job.artifacts.find(a => a.type === "result" || a.type === "blocked");
    const aiResponse = resultArtifact?.content
      || job.artifacts.find(a => a.type === "plan")?.content
      || "Done";

    const finalHistory = [
      ...withUser,
      { role: "assistant", content: aiResponse }
    ].slice(-20);
    warmSet("chat_history", finalHistory);
  } catch (err) {
    console.error("[orchestrator] Failed to append history:", err);
  }
}

export async function processMessage(userInput: string): Promise<void> {
  try {
    // Capture user message BEFORE any node runs so all nodes see fresh history
    const history = warmGet<{ role: string; content: string }[]>("chat_history") || [];
    const withUser = [
      ...history,
      { role: "user", content: userInput }
    ].slice(-20); // Keep last 20 entries (~10 turns)
    warmSet("chat_history", withUser);

    // Step 1: Gatekeeper — classify intent, acknowledge user
    const job = await runGatekeeper(userInput);

    if (job.status === "done") {
      bus.emit("nucleus:state", "idle");
      bus.emit("job:completed", job);
      captureRecentTask(job);
      // Capture the gatekeeper's direct response
      appendHistory(withUser, job);
      await appendEntry("agent", "orchestrator", job.id, "Job completed by gatekeeper");
      return;
    }

    // Step 2: Planner — create plan, decide if executor needed
    const plannedJob = await runPlanner(job);

    if (plannedJob.status === "done") {
      bus.emit("nucleus:state", "idle");
      bus.emit("job:completed", plannedJob);
      captureRecentTask(plannedJob);
      appendHistory(withUser, plannedJob);
      await appendEntry("agent", "orchestrator", plannedJob.id, "Job completed by planner");
      return;
    }

    // Step 3: Executor — execute plan, run tools if needed
    const completedJob = await runExecutorNode(plannedJob);
    bus.emit("job:completed", completedJob);
    captureRecentTask(completedJob);
    appendHistory(withUser, completedJob);
    await appendEntry("agent", "orchestrator", completedJob.id, "Job completed by executor");
  } catch (err) {
    // Security: Redact sensitive information from errors before displaying
    const rawError = err instanceof Error ? err.message : String(err);
    const redactedError = redactError(err);

    // Log full error internally for debugging
    console.error("[orchestrator] Processing error:", rawError);

    bus.emit("nucleus:state", "error");
    bus.emit("log:entry", {
      id: newId(),
      timestamp: now(),
      type: "error",
      content: `Orchestrator error: ${redactedError}`,
    });
    bus.emit("chat:message", {
      id: newId(),
      role: "cairn",
      text: `I encountered an error: ${redactedError}`,
      timestamp: shortTime(),
    });

    // Reset to idle after brief delay
    setTimeout(() => bus.emit("nucleus:state", "idle"), 3000);
  }
}
