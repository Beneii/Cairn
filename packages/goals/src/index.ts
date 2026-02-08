// Types
export type {
    Goal,
    GoalStatus,
    RegretProfile,
    Constraint,
    ConstraintOperator,
    PreferenceRef,
    ActionLog,
} from "./types/goal.js";

export type {
    PreferenceProfile,
    FeedbackResponse,
    FeedbackEntry,
} from "./types/preference.js";

export type {
    ActionRisk,
    ActionPolicy,
    ApprovalRequest,
    ApprovalStatus,
} from "./types/approval.js";

export type { Hypothesis, HypothesisStatus } from "./db/hypothesisDb.js";
export type { DailyBriefing } from "./briefing.js";
export type { HeartbeatResult, HeartbeatConfig } from "./heartbeat.js";

// Factories (from types)
export { createGoal, createConstraint } from "./types/goal.js";
export { createPreferenceProfile, applyFeedback, scoreItem } from "./types/preference.js";
export { getActionRisk, requiresApproval, isNeverAllowed, DEFAULT_POLICIES } from "./types/approval.js";

// Database Layer (new - replaces JSON stores)
import { initDatabase, closeDatabase } from "./db/index.js";
export { initDatabase, closeDatabase };
export {
    getGoals,
    getGoal,
    getActiveGoals,
    getGoalsByDomain,
    getGoalsDueForCheck,
    createGoal as saveGoal,
    updateGoal,
    setGoalStatus,
    logAction,
    rejectItem,
    isItemRejected,
    incrementInterruptions,
    resetDailyInterruptions,
    deleteGoal,
} from "./db/goalDb.js";

export {
    getProfiles,
    getProfile,
    getProfileByDomain,
    createProfile,
    getOrCreateProfile,
    recordFeedback,
    score,
    addVeto,
    removeVeto,
    setWeight,
    deleteProfile,
} from "./db/preferenceDb.js";

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
