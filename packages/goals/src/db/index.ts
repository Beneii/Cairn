/**
 * Database Module Index
 */

export { initDatabase, getDatabase, closeDatabase, now, parseJSON } from "./database.js";

// Goal DB
export {
    getGoals,
    getGoal,
    getActiveGoals,
    getGoalsDueForCheck,
    createGoal,
    updateGoal,
    setGoalStatus,
    logAction,
    incrementInterruptions,
    resetDailyInterruptions,
    deleteGoal,
} from "./goalDb.js";

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
