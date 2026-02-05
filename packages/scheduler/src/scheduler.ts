import { getJobs, updateJob } from "@cairn/orchestrator";
import { hotPurgeExpired } from "@cairn/memory";
import { appendEntry, verifyChain } from "@cairn/ledger";
import { bus, newId, now } from "@cairn/shared";

let currentIntervalMs = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 60000);
const STALL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (intervalId) return;
  console.log(`[scheduler] heartbeat started (interval: ${currentIntervalMs / 1000}s)`);
  intervalId = setInterval(() => {
    heartbeat();
  }, currentIntervalMs);
  // Run once immediately
  heartbeat();
}

export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[scheduler] heartbeat stopped");
  }
}

export function setHeartbeatInterval(intervalMs: number): void {
  currentIntervalMs = intervalMs;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    startScheduler();
  }
}

async function heartbeat(): Promise<void> {
  try {
    await appendEntry("agent", "scheduler", "heartbeat", "Heartbeat started");

    // 1. Purge expired hot memory
    const purged = hotPurgeExpired();
    if (purged > 0) {
      await appendEntry(
        "agent",
        "scheduler",
        "heartbeat",
        `Purged ${purged} expired hot memory entries`,
      );
    }

    // 2. Check for stalled jobs
    const runningJobs = getJobs({ status: "running" });
    const current = Date.now();
    for (const job of runningJobs) {
      const updatedAt = new Date(job.updated_at).getTime();
      if (current - updatedAt > STALL_THRESHOLD_MS) {
        updateJob(job.id, { status: "failed" });
        await appendEntry(
          "error",
          "scheduler",
          job.id,
          `Job stalled and marked as failed after ${STALL_THRESHOLD_MS / 1000}s`,
        );
        bus.emit("log:entry", {
          id: newId(),
          timestamp: now(),
          type: "error",
          content: `Job ${job.id.substring(0, 8)} stalled and failed`,
        });
      }
    }

    // 3. Verify ledger integrity
    const chainValid = verifyChain();
    if (!chainValid) {
      await appendEntry(
        "security",
        "scheduler",
        "heartbeat",
        "WARNING: Ledger chain integrity check FAILED",
      );
    }

    // 4. Log heartbeat summary
    const allJobs = getJobs();
    const summary = {
      total_jobs: allJobs.length,
      running: allJobs.filter((j) => j.status === "running").length,
      queued: allJobs.filter((j) => j.status === "queued").length,
      done: allJobs.filter((j) => j.status === "done").length,
      failed: allJobs.filter((j) => j.status === "failed").length,
    };

    await appendEntry(
      "agent",
      "scheduler",
      "heartbeat",
      `Heartbeat complete: ${JSON.stringify(summary)}`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scheduler] heartbeat error:", msg);
    bus.emit("log:entry", {
      id: newId(),
      timestamp: now(),
      type: "error",
      content: `Scheduler error: ${msg}`,
    });
  }
}
