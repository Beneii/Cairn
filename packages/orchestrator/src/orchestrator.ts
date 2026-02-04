import { bus, newId, now, shortTime } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { runGatekeeper } from "./nodes/gatekeeper.js";
import { runPlanner } from "./nodes/planner.js";
import { runExecutorNode } from "./nodes/executor-node.js";

export async function processMessage(userInput: string): Promise<void> {
  try {
    // Step 1: Gatekeeper — classify intent, acknowledge user
    const job = await runGatekeeper(userInput);

    if (job.status === "done") {
      bus.emit("nucleus:state", "idle");
      bus.emit("job:completed", job);
      await appendEntry("agent", "orchestrator", job.id, "Job completed by gatekeeper");
      return;
    }

    // Step 2: Planner — create plan, decide if executor needed
    const plannedJob = await runPlanner(job);

    if (plannedJob.status === "done") {
      bus.emit("nucleus:state", "idle");
      bus.emit("job:completed", plannedJob);
      await appendEntry("agent", "orchestrator", plannedJob.id, "Job completed by planner");
      return;
    }

    // Step 3: Executor — execute plan, run tools if needed
    const completedJob = await runExecutorNode(plannedJob);
    bus.emit("job:completed", completedJob);
    await appendEntry("agent", "orchestrator", completedJob.id, "Job completed by executor");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    bus.emit("nucleus:state", "error");
    bus.emit("log:entry", {
      id: newId(),
      timestamp: now(),
      type: "error",
      content: `Orchestrator error: ${errorMsg}`,
    });
    bus.emit("chat:message", {
      id: newId(),
      role: "cairn",
      text: `I encountered an error: ${errorMsg}`,
      timestamp: shortTime(),
    });

    // Reset to idle after brief delay
    setTimeout(() => bus.emit("nucleus:state", "idle"), 3000);
  }
}
