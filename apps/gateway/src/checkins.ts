/**
 * Proactive Check-ins Agent
 *
 * Periodic job that sends personalized check-ins based on:
 * - Time of day (morning, afternoon, evening)
 * - User preferences from warm memory
 * - Recent tasks and active projects
 * - Blocked tasks that need attention
 */

import { warmGet, warmSet } from "@cairn/memory";
import { bus, newId, shortTime } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { isLLMAvailable, callLLM } from "@cairn/orchestrator";
import { getCards } from "./kanban.js";

const CHECK_IN_INTERVAL_MS = 2 * 60 * 60 * 1000; // Every 2 hours
const MIN_TIME_BETWEEN_CHECKINS_MS = 4 * 60 * 60 * 1000; // At least 4 hours between check-ins

interface CheckInState {
  last_check_in: number; // Unix timestamp
}

function getTimeContext(): { period: string; shouldCheckIn: boolean } {
  const hour = new Date().getHours();

  // Don't check in during night hours (10 PM - 8 AM)
  if (hour >= 22 || hour < 8) {
    return { period: "night", shouldCheckIn: false };
  }

  if (hour < 12) {
    return { period: "morning", shouldCheckIn: true };
  } else if (hour < 17) {
    return { period: "afternoon", shouldCheckIn: true };
  } else {
    return { period: "evening", shouldCheckIn: true };
  }
}

export function startCheckInProcessor(): void {
  setInterval(async () => {
    try {
      // Check if LLM is available
      if (!isLLMAvailable()) {
        return;
      }

      // Check time context
      const timeContext = getTimeContext();
      if (!timeContext.shouldCheckIn) {
        return;
      }

      // Check if enough time has passed since last check-in
      const state = warmGet<CheckInState>("checkin_state");
      const now = Date.now();

      if (state?.last_check_in) {
        const timeSinceLastCheckIn = now - state.last_check_in;
        if (timeSinceLastCheckIn < MIN_TIME_BETWEEN_CHECKINS_MS) {
          return; // Too soon for another check-in
        }
      }

      // Gather context for personalization
      const preferences = warmGet("user_preferences") ?? {};
      const recentTasks = warmGet("recent_tasks") ?? [];
      const cards = getCards();
      const blockedTasks = cards.filter((c) => c.status === "blocked" && !c.archived);
      const activeTasks = cards.filter((c) => c.status === "active" && !c.archived);

      // Build context for LLM
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

      if (Object.keys(preferences).length > 0) {
        contextParts.push(`User preferences: ${JSON.stringify(preferences)}`);
      }

      console.log(`[checkins] Generating ${timeContext.period} check-in`);

      await appendEntry(
        "agent",
        "checkins",
        "proactive",
        `Generating ${timeContext.period} check-in`
      );

      // Generate personalized check-in
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

      // Emit the check-in message
      bus.emit("chat:message", {
        id: newId(),
        role: "cairn",
        text: message,
        timestamp: shortTime(),
      });

      // Update state
      await warmSet("checkin_state", {
        last_check_in: now,
      });

      await appendEntry(
        "agent",
        "checkins",
        "proactive",
        `Check-in sent: ${message.substring(0, 100)}`
      );

      console.log(`[checkins] Check-in sent`);
    } catch (err) {
      console.error("[checkins] Error in check-in processor:", err);
    }
  }, CHECK_IN_INTERVAL_MS);

  console.log(
    `[checkins] Check-in processor started (interval: ${CHECK_IN_INTERVAL_MS / 1000 / 60}min)`
  );
}
