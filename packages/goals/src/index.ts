// Types
export type {
    Goal,
    GoalStatus,
    GoalPriority,
    TimeHorizon,
    ActionLog,
} from "./types/goal.js";

export { MAX_ACTIVE_GOALS, createGoal } from "./types/goal.js";

export type { Hypothesis, HypothesisStatus } from "./db/hypothesisDb.js";
export type { DailyBriefing } from "./briefing.js";
export type { HeartbeatResult, HeartbeatConfig } from "./heartbeat.js";

// Database Layer
import { initDatabase, closeDatabase } from "./db/index.js";
export { initDatabase, closeDatabase };
export {
    getGoals,
    getGoal,
    getActiveGoals,
    getGoalsDueForCheck,
    createGoal as saveGoal,
    updateGoal,
    setGoalStatus,
    logAction,
    incrementInterruptions,
    resetDailyInterruptions,
    deleteGoal,
} from "./db/goalDb.js";

export {
    getActiveHypotheses,
    getHypothesis,
    getInvalidatedHypotheses,
    createHypothesis,
    recordEvidence,
    invalidateHypothesis,
    deleteHypothesis,
} from "./db/hypothesisDb.js";

// Heartbeat (goal loop)
export { runHeartbeat, resetDailyCounters, triggerGoalCheck } from "./heartbeat.js";

// Daily Briefing
export {
    generateDailyBriefing,
    formatBriefingAsText,
    shouldSendBriefing,
    setBriefingCalendarSource,
} from "./briefing.js";

// Proactive Intelligence
export {
    runProactiveEngine,
    recordActivity,
    detectPatterns,
    checkGoalNudges,
    checkCalendarNudges,
    checkAnomalies,
    getProactiveConfig,
    setProactiveConfig,
    shouldNudgeNow,
    recordNudgeSent,
    setCalendarProviderForProactive,
    type NudgeDecision,
    type ProactiveConfig,
    type UserPattern,
    type ActivityEntry,
} from "./proactive.js";

// Convenience init
export function initGoals(): void {
    initDatabase();
}
