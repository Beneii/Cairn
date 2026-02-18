/**
 * SQLite-backed Goal Store
 */
import type { Goal, GoalStatus, ActionLog } from "../types/goal.js";
export declare function getGoals(): Goal[];
export declare function getGoal(id: string): Goal | undefined;
export declare function getActiveGoals(): Goal[];
export declare function getGoalsDueForCheck(): Goal[];
export declare function createGoal(goal: Goal): Goal;
export declare function updateGoal(id: string, updates: Partial<Goal>): Goal | undefined;
export declare function setGoalStatus(id: string, status: GoalStatus, reason?: string): Goal | undefined;
export declare function logAction(goalId: string, action: string, result: ActionLog["result"], details?: string): Goal | undefined;
export declare function incrementInterruptions(goalId: string): Goal | undefined;
export declare function resetDailyInterruptions(): void;
export declare function deleteGoal(id: string): boolean;
//# sourceMappingURL=goalDb.d.ts.map