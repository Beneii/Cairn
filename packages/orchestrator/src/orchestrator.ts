import { bus, newId, now, shortTime, redactError } from "@cairn/shared";
import type { Job } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { warmGet, warmSet } from "@cairn/memory";
import { runGatekeeper } from "./nodes/gatekeeper.js";
import { runPlanner } from "./nodes/planner.js";
import { runExecutorNode } from "./nodes/executor-node.js";
import { runCriticNode } from "./nodes/critic.js";
import { runWebAgent } from "./nodes/web-agent.js";

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

      const totalCost = job.costs_so_far.reduce((sum, c) => sum + c.cost_usd, 0);
      await appendEntry("agent", "orchestrator", job.id, `Job completed by gatekeeper. Total cost: $${totalCost.toFixed(4)}`);
      return;
    }

    // New Step: Web Agent (Autonomous Loop)
    if (job.metadata?.needs_web_agent) {
      const webJob = await runWebAgent(job);
      bus.emit("nucleus:state", "idle");
      bus.emit("job:completed", webJob);
      captureRecentTask(webJob);
      appendHistory(withUser, webJob);

      const totalCost = webJob.costs_so_far.reduce((sum: number, c: any) => sum + c.cost_usd, 0);
      await appendEntry("agent", "orchestrator", webJob.id, `Job completed by web_agent. Total cost: $${totalCost.toFixed(4)}`);
      return;
    }

    // Step 2: Planner — create plan, decide if executor needed
    const plannedJob = await runPlanner(job);

    if (plannedJob.status === "done") {
      bus.emit("nucleus:state", "idle");
      bus.emit("job:completed", plannedJob);
      captureRecentTask(plannedJob);
      appendHistory(withUser, plannedJob);

      const totalCost = plannedJob.costs_so_far.reduce((sum, c) => sum + c.cost_usd, 0);
      await appendEntry("agent", "orchestrator", plannedJob.id, `Job completed by planner. Total cost: $${totalCost.toFixed(4)}`);
      return;
    }

    // Step 3: Multi-turn Refinement Loop (Executor -> Critic)
    let completedJob = plannedJob;
    let refinementCount = 0;
    const MAX_REFINEMENTS = 2;

    while (refinementCount <= MAX_REFINEMENTS) {
      completedJob = await runExecutorNode(completedJob);

      // Run Critic to evaluate the executor's work
      const criticJob = await runCriticNode(completedJob);
      const criticism = (criticJob as any)._criticResult;

      if (!criticism || criticism.action === "accept") {
        completedJob = criticJob;
        break;
      }

      // If critic requests refinement, loop back to executor with feedback in a new artifact
      refinementCount++;
      await appendEntry("agent", "orchestrator", job.id, `Critic requested refinement (loop ${refinementCount}/${MAX_REFINEMENTS}): ${criticism.feedback}`);

      // Inject feedback as a task for the next executor run
      const feedbackArtifact = {
        id: newId(),
        type: "critic_feedback" as any,
        content: criticism.feedback || "Improve the previous result based on context.",
        metadata: {},
        origin_node: "critic" as any,
        created_at: now()
      };

      completedJob = {
        ...criticJob,
        status: "running" as any,
        artifacts: [...criticJob.artifacts, feedbackArtifact]
      };
    }

    bus.emit("job:completed", completedJob);
    captureRecentTask(completedJob);
    appendHistory(withUser, completedJob);

    const totalCost = completedJob.costs_so_far.reduce((sum, c) => sum + c.cost_usd, 0);
    await appendEntry("agent", "orchestrator", completedJob.id, `Job completed after ${refinementCount} refinements. Total cost: $${totalCost.toFixed(4)}`);
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
