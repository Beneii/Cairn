import { getJobs, updateJob } from "@cairn/orchestrator";
import { runHeartbeat } from "@cairn/goals";
import { hotPurgeExpired, warmGet, warmSet } from "@cairn/memory";
import { appendEntry, verifyChain } from "@cairn/ledger";
import { bus, newId, now } from "@cairn/shared";

let currentIntervalMs = Number(process.env.HEARTBEAT_INTERVAL_MS ?? 60000);
const STALL_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const SUPERVISOR_COOLDOWN_MS = 2 * 60 * 1000; // avoid noisy introspection

let intervalId: ReturnType<typeof setInterval> | null = null;

interface SupervisorSummary {
  ts: string;
  queue: number;
  running: number;
  failed: number;
  stalled: number;
  avgSkillLatencyMs: number;
  lowReliabilitySkills: number;
  configFingerprint: string;
  triggerReason: string;
}

function isSelfGrowthEnabled(): boolean {
  return process.env.CAIRN_MODE === "grow" || process.env.CAIRN_SELF_GROWTH === "enabled";
}

function buildConfigFingerprint(): string {
  const parts = [
    `mode:${process.env.CAIRN_MODE || "default"}`,
    `llm:${process.env.LLM_PROVIDER || "openai"}`,
    `light:${process.env.CAIRN_MAX_LIGHT_WORKERS || "4"}`,
    `heavy:${process.env.CAIRN_MAX_HEAVY_WORKERS || "3"}`,
    `heartbeat:${process.env.HEARTBEAT_INTERVAL_MS || "60000"}`,
  ];
  return parts.join("|");
}

function shouldRunSupervisorSummary(triggerReason: string): boolean {
  const state = warmGet<{ lastAt?: string }>("supervisor_state") || {};
  const lastAt = state.lastAt ? new Date(state.lastAt).getTime() : 0;
  const elapsed = Date.now() - lastAt;
  if (triggerReason !== "periodic") return true;
  return elapsed >= SUPERVISOR_COOLDOWN_MS;
}

function appendSupervisorAlert(summary: SupervisorSummary): void {
  const alerts = warmGet<SupervisorSummary[]>("supervisor_alerts") || [];
  const next = [summary, ...alerts].slice(0, 50);
  warmSet("supervisor_alerts", next);
}

function collectSkillReliabilitySnapshot(): { avgSkillLatencyMs: number; lowReliabilitySkills: number } {
  try {
    const traces = warmGet<{ skillId?: string; success: boolean; durationMs: number }[]>("orchestrator_recent_traces") || [];
    if (!Array.isArray(traces) || traces.length === 0) {
      return { avgSkillLatencyMs: 0, lowReliabilitySkills: 0 };
    }

    const totalLatency = traces.reduce((acc, t) => acc + (t.durationMs || 0), 0);

    // Count distinct skills that have ANY failure in the window (per-skill reliability)
    const failingSkillIds = new Set<string>();
    for (const t of traces) {
      if (!t.success && t.skillId) {
        failingSkillIds.add(t.skillId);
      }
    }
    // Fall back to raw failure count for legacy traces without skillId
    const legacyFailures = traces.filter((t) => !t.success && !t.skillId).length;

    return {
      avgSkillLatencyMs: Math.round(totalLatency / traces.length),
      lowReliabilitySkills: failingSkillIds.size + legacyFailures,
    };
  } catch {
    return { avgSkillLatencyMs: 0, lowReliabilitySkills: 0 };
  }
}

function getSupervisorTrigger(summary: Omit<SupervisorSummary, "triggerReason">, previous?: SupervisorSummary): string {
  if (summary.stalled > 0) return "stalled_jobs_detected";
  if (!previous) return "startup";
  if (summary.failed > previous.failed) return "failures_increased";
  if (summary.queue >= 5 && summary.queue > previous.queue) return "queue_growth";
  if (summary.lowReliabilitySkills > previous.lowReliabilitySkills) return "skill_reliability_drop";
  if (summary.configFingerprint !== previous.configFingerprint) return "config_drift";
  return "periodic";
}

async function runSupervisorIntrospection(triggerReason: string, summary: Omit<SupervisorSummary, "triggerReason">): Promise<void> {
  if (!shouldRunSupervisorSummary(triggerReason)) return;

  const fullSummary: SupervisorSummary = {
    ...summary,
    triggerReason,
  };

  warmSet("supervisor_state", {
    lastAt: fullSummary.ts,
    last: fullSummary,
  });

  if (triggerReason !== "periodic") {
    appendSupervisorAlert(fullSummary);
    await appendEntry(
      "agent",
      "supervisor",
      "heartbeat",
      `trigger=${triggerReason} queue=${fullSummary.queue} failed=${fullSummary.failed} stalled=${fullSummary.stalled} latency=${fullSummary.avgSkillLatencyMs}ms`,
    );

    bus.emit("log:entry", {
      id: newId(),
      timestamp: now(),
      type: "agent",
      content: `[supervisor] ${triggerReason} | q=${fullSummary.queue} run=${fullSummary.running} fail=${fullSummary.failed} stalled=${fullSummary.stalled}`,
    });
  }
}

export function startScheduler(): void {
  if (intervalId) return;
  console.log(`[scheduler] heartbeat started (interval: ${currentIntervalMs / 1000}s)`);

  // Initialize goals DB
  import("@cairn/goals").then(({ initGoals }) => initGoals());

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
    let stalledCount = 0;

    for (const job of runningJobs) {
      const updatedAt = new Date(job.updated_at).getTime();
      if (current - updatedAt > STALL_THRESHOLD_MS) {
        stalledCount += 1;
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

    // 3. Run Goal Heartbeat (Autonomy Loop)
    try {
      const goalResult = await runHeartbeat();
      if (goalResult.actionsTriggered.length > 0) {
        await appendEntry(
          "agent",
          "goals",
          "heartbeat",
          `triggered: ${goalResult.actionsTriggered.join(", ")}`
        );
      }
    } catch (err: unknown) {
      console.error("[scheduler] Goal heartbeat failed:", err);
      // Don't crash the main scheduler
    }

    // 4. Verify ledger integrity
    const chainValid = verifyChain();
    if (!chainValid) {
      await appendEntry(
        "security",
        "scheduler",
        "heartbeat",
        "WARNING: Ledger chain integrity check FAILED",
      );
    }

    // 5. Log heartbeat summary
    const allJobs = getJobs();
    const summary = {
      total_jobs: allJobs.length,
      running: allJobs.filter((j: { status: string }) => j.status === "running").length,
      queued: allJobs.filter((j: { status: string }) => j.status === "queued").length,
      done: allJobs.filter((j: { status: string }) => j.status === "done").length,
      failed: allJobs.filter((j: { status: string }) => j.status === "failed").length,
    };

    await appendEntry(
      "agent",
      "scheduler",
      "heartbeat",
      `Heartbeat complete: ${JSON.stringify(summary)}`,
    );

    // 5b. Supervisor introspection (trigger-based, compute-light)
    const perf = collectSkillReliabilitySnapshot();
    const baseSummary = {
      ts: new Date().toISOString(),
      queue: summary.queued,
      running: summary.running,
      failed: summary.failed,
      stalled: stalledCount,
      avgSkillLatencyMs: perf.avgSkillLatencyMs,
      lowReliabilitySkills: perf.lowReliabilitySkills,
      configFingerprint: buildConfigFingerprint(),
    };

    const previous = warmGet<{ last?: SupervisorSummary }>("supervisor_state")?.last;
    const trigger = getSupervisorTrigger(baseSummary, previous);
    await runSupervisorIntrospection(trigger, baseSummary);

    // 6. Nightly Builder Trigger
    if (process.env.BUILDER_ENABLED === "true" && isSelfGrowthEnabled()) {
      const tz = process.env.TIMEZONE || "Australia/Sydney";
      // Get current hour in local time
      const hour = parseInt(new Date().toLocaleString("en-AU", { timeZone: tz, hour: "numeric", hour12: false }));
      const targetHour = parseInt(process.env.BUILDER_HOUR || "2");

      if (hour === targetHour) {
        import("@cairn/builder").then(({ runNightlyBuilder }) => {
          runNightlyBuilder().catch(err => console.error("[scheduler] Builder trigger failed:", err));
        });
      }
    }
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
