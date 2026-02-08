/**
 * Database Module Index
 */

export { initDatabase, getDatabase, closeDatabase, now, parseJSON } from "./database.js";

// Goal DB
export {
    getGoals,
    getGoal,
    getActiveGoals,
    getGoalsByDomain,
    getGoalsDueForCheck,
    createGoal,
    updateGoal,
    setGoalStatus,
    logAction,
    rejectItem,
    isItemRejected,
    incrementInterruptions,
    resetDailyInterruptions,
    deleteGoal,
} from "./goalDb.js";

// Preference DB
export {
    getProfiles,
    getProfile,
    getProfileByDomain,
    createProfile,
    getOrCreateProfile,
    updateProfile,
    recordFeedback,
    score,
    addVeto,
    removeVeto,
    setWeight,
    deleteProfile,
} from "./preferenceDb.js";

// Hypothesis DB
export type { Hypothesis, HypothesisStatus } from "./hypothesisDb.js";
export {
    getActiveHypotheses,
    getHypothesis,
    getInvalidatedHypotheses,
    createHypothesis,
    recordEvidence,
    invalidateHypothesis,
    deleteHypothesis,
} from "./hypothesisDb.js";
