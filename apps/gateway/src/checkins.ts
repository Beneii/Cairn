/**
 * Proactive Check-ins Agent
 *
 * All timing/scheduling is driven by ProactiveConfig (configurable in Settings).
 * Three independent processors:
 *  1. Check-ins — periodic friendly messages based on task context
 *  2. Briefing  — daily morning summary (calendar + goals)
 *  3. Proactive — goal-driven nudges (reminders, anomalies, calendar-aware)
 */

import { warmGet, warmSet } from "@cairn/memory";
import { bus, newId, shortTime } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { isLLMAvailable, callLLM } from "@cairn/orchestrator";
import { getCards } from "./kanban.js";
import {
  generateDailyBriefing,
  formatBriefingAsText,
  shouldSendBriefing,
  runProactiveEngine,
  getProactiveConfig,
  shouldNudgeNow,
  recordNudgeSent,
  setCalendarProviderForProactive,
  type NudgeDecision,
} from "@cairn/goals";
import { getCalendarProvider } from "@cairn/executor";

const CHECK_IN_INTERVAL_MS = 2 * 60 * 60 * 1000; // Every 2 hours
const PROACTIVE_CHECK_INTERVAL_MS = 30 * 60 * 1000; // Every 30 minutes
const MIN_TIME_BETWEEN_CHECKINS_MS = 4 * 60 * 60 * 1000; // At least 4 hours between check-ins
const BRIEFING_CHECK_INTERVAL_MS = 15 * 60 * 1000; // Check every 15 minutes

interface CheckInState {
  last_check_in: number; // Unix timestamp
}

/** Determine time-of-day period, respecting quiet hours from config. */
function getTimeContext(): { period: string; shouldCheckIn: boolean } {
  const config = getProactiveConfig();
  const hour = new Date().getHours();

  // Respect quiet hours from config
  const { quietHoursStart, quietHoursEnd } = config;
  if (quietHoursStart > quietHoursEnd) {
    // Wraps midnight (e.g. 22–8)
    if (hour >= quietHoursStart || hour < quietHoursEnd) {
      return { period: "night", shouldCheckIn: false };
    }
  } else {
    if (hour >= quietHoursStart && hour < quietHoursEnd) {
      return { period: "night", shouldCheckIn: false };
    }
  }

  if (hour < 12) return { period: "morning", shouldCheckIn: true };
  if (hour < 17) return { period: "afternoon", shouldCheckIn: true };
  return { period: "evening", shouldCheckIn: true };
}

// ---- 1. Check-In Processor ----

export function startCheckInProcessor(): void {
  setInterval(async () => {
    try {
      const config = getProactiveConfig();

      // Master toggle + check-in toggle
      if (!config.enabled || !config.checkInsEnabled) return;
      if (!isLLMAvailable()) return;

      const timeContext = getTimeContext();
      if (!timeContext.shouldCheckIn) return;

      // Enforce minimum gap between check-ins
      const state = warmGet<CheckInState>("checkin_state");
      const now = Date.now();

      if (state?.last_check_in) {
        if (now - state.last_check_in < MIN_TIME_BETWEEN_CHECKINS_MS) {
          return;
        }
      }

      // Gather context
      const cards = getCards();
      const blockedTasks = cards.filter((c) => c.status === "blocked" && !c.archived);
      const activeTasks = cards.filter((c) => c.status === "active" && !c.archived);

      const contextParts: string[] = [];
      if (blockedTasks.length > 0) {
        contextParts.push(
          `Blocked tasks (${blockedTasks.length}): ${blockedTasks.map((t) => t.title).join(", ")}`
        );
      }
      if (activeTasks.length > 0) {
        contextParts.push(
          `Active tasks (${activeTasks.length}): ${activeTasks.slice(0, 3).map((t) => t.title).join(", ")}`
        );
      }

      console.log(`[checkins] Generating ${timeContext.period} check-in`);
      await appendEntry("agent", "checkins", "proactive", `Generating ${timeContext.period} check-in`);

      const response = await callLLM(
        {
          model: "gpt-4o-mini",
          systemPrompt: `You are Cairn, a friendly AI assistant. Generate a brief, warm check-in message for the user.

Time of day: ${timeContext.period}
${contextParts.length > 0 ? "\nContext:\n" + contextParts.join("\n") : ""}

Guidelines:
- Keep it SHORT (1-2 sentences max)
- Be friendly but not annoying
- If there are blocked tasks, gently mention them
- If there are active tasks, offer encouragement
- Don't be overly enthusiastic or use excessive punctuation
- Sound natural, like a thoughtful colleague

Respond with just the message text, no JSON.`,
          userMessage: `Generate a ${timeContext.period} check-in message.`,
          maxTokens: 150,
        },
        "checkins",
        "proactive"
      );

      const message = response.content.trim();

      bus.emit("chat:message", {
        id: newId(),
        role: "cairn",
        text: message,
        timestamp: shortTime(),
      });

      await warmSet("checkin_state", { last_check_in: now });
      await appendEntry("agent", "checkins", "proactive", `Check-in sent: ${message.substring(0, 100)}`);
      console.log(`[checkins] Check-in sent`);
    } catch (err) {
      console.error("[checkins] Error in check-in processor:", err);
    }
  }, CHECK_IN_INTERVAL_MS);

  console.log(`[checkins] Check-in processor started (interval: ${CHECK_IN_INTERVAL_MS / 1000 / 60}min)`);

  // Also start the morning briefing loop
  startBriefingProcessor();
}

// ---- 2. Briefing Processor ----

function startBriefingProcessor(): void {
  setInterval(async () => {
    try {
      const config = getProactiveConfig();

      // Master toggle + briefing toggle
      if (!config.enabled || !config.briefingEnabled) return;

      const hour = new Date().getHours();

      // Use configurable briefing window (default 7–9 AM)
      if (hour < config.briefingWindowStart || hour >= config.briefingWindowEnd) return;

      // Only send once per day
      const briefingState = warmGet<{ lastDate: string }>("briefing_state");
      const today = new Date().toISOString().split("T")[0];
      if (briefingState?.lastDate === today) return;

      const briefing = await generateDailyBriefing();

      const decision = shouldSendBriefing(briefing, {
        interruptionsToday: 0,
        maxInterruptions: 10,
        minConfidenceToInterrupt: 0.3,
      });

      if (!decision.send) {
        console.log(`[briefing] Skipping: ${decision.reason}`);
        await warmSet("briefing_state", { lastDate: today });
        return;
      }

      const text = formatBriefingAsText(briefing);

      bus.emit("chat:message", {
        id: newId(),
        role: "cairn",
        text,
        timestamp: shortTime(),
      });

      await warmSet("briefing_state", { lastDate: today });
      await appendEntry("agent", "briefing", "daily", `Daily briefing sent (confidence: ${briefing.confidence.toFixed(2)})`);
      console.log("[briefing] Morning briefing sent");
    } catch (err) {
      console.error("[briefing] Error generating briefing:", err);
    }
  }, BRIEFING_CHECK_INTERVAL_MS);

  console.log("[briefing] Briefing processor started (checks every 15min)");
}

// ---- 3. Proactive Intelligence Processor ----

export function startProactiveProcessor(): void {
  // Wire up calendar provider for the proactive engine
  try {
    const provider = getCalendarProvider();
    setCalendarProviderForProactive(provider);
  } catch {
    console.log("[proactive] No calendar provider available");
  }

  setInterval(async () => {
    try {
      const config = getProactiveConfig();

      if (!shouldNudgeNow(config)) {
        return; // Disabled, quiet hours, or daily limit reached
      }

      const nudge = await runProactiveEngine();

      if (!nudge || !nudge.shouldNudge) {
        return;
      }

      bus.emit("chat:message", {
        id: newId(),
        role: "cairn",
        text: nudge.message,
        timestamp: shortTime(),
      });

      recordNudgeSent();

      await appendEntry(
        "agent",
        "proactive",
        nudge.relatedGoalId ?? "general",
        `Nudge sent (${nudge.nudgeType}): ${nudge.message.substring(0, 100)}`
      );

      console.log(`[proactive] ${nudge.nudgeType} nudge sent (priority: ${nudge.priority})`);
    } catch (err) {
      console.error("[proactive] Error in proactive processor:", err);
    }
  }, PROACTIVE_CHECK_INTERVAL_MS);

  console.log(`[proactive] Proactive processor started (interval: ${PROACTIVE_CHECK_INTERVAL_MS / 1000 / 60}min)`);
}
