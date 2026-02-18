export type { Goal, GoalStatus, GoalPriority, TimeHorizon, ActionLog, } from "./types/goal.js";
export { MAX_ACTIVE_GOALS, createGoal } from "./types/goal.js";
import { initDatabase, closeDatabase } from "./db/index.js";
export { initDatabase, closeDatabase };
export { getGoals, getGoal, getActiveGoals, getGoalsDueForCheck, createGoal as saveGoal, updateGoal, setGoalStatus, logAction, incrementInterruptions, resetDailyInterruptions, deleteGoal, } from "./db/goalDb.js";
export { runHeartbeat, resetDailyCounters, triggerGoalCheck } from "./heartbeat.js";
export { generateDailyBriefing, formatBriefingAsText, shouldSendBriefing, setBriefingCalendarSource, } from "./briefing.js";
export { runProactiveEngine, recordActivity, detectPatterns, checkGoalNudges, checkCalendarNudges, checkAnomalies, getProactiveConfig, setProactiveConfig, shouldNudgeNow, recordNudgeSent, setCalendarProviderForProactive, type NudgeDecision, type ProactiveConfig, type UserPattern, type ActivityEntry, } from "./proactive.js";
export declare function initGoals(): void;
//# sourceMappingURL=index.d.ts.map