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

export async function processMessage(userInput: string): Promise<void> {
  try {
    // Step 1: Gatekeeper — classify intent, acknowledge user
    const job = await runGatekeeper(userInput);

    if (job.status === "done") {
      bus.emit("nucleus:state", "idle");
      bus.emit("job:completed", job);
      captureRecentTask(job);
      await appendEntry("agent", "orchestrator", job.id, "Job completed by gatekeeper");
      return;
    }

    // Step 2: Planner — create plan, decide if executor needed
    const plannedJob = await runPlanner(job);

    if (plannedJob.status === "done") {
      bus.emit("nucleus:state", "idle");
      bus.emit("job:completed", plannedJob);
      captureRecentTask(plannedJob);
      await appendEntry("agent", "orchestrator", plannedJob.id, "Job completed by planner");
      return;
    }

    // Step 3: Executor — execute plan, run tools if needed
    const completedJob = await runExecutorNode(plannedJob);
    bus.emit("job:completed", completedJob);
    captureRecentTask(completedJob);
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
