/**
 * Goal Types
 *
 * Long-term goals as active constraints on Cairn's behavior.
 * Goals are first-class objects that shape decisions, scheduling, and suggestions.
 *
 * Hard limit: max 3 active goals. Everything else is parked or archived.
 */
import type { Goal } from "@cairn/shared";
export type { Goal, GoalStatus, GoalPriority, TimeHorizon, ActionLog, } from "@cairn/shared";
export declare const MAX_ACTIVE_GOALS = 3;
export declare function createGoal(title: string, options?: Partial<Omit<Goal, "id" | "created_at" | "updated_at">>): Goal;
//# sourceMappingURL=goal.d.ts.map