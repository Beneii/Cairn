/**
 * Goal Types
 *
 * Long-term goals as active constraints on Cairn's behavior.
 * Goals are first-class objects that shape decisions, scheduling, and suggestions.
 *
 * Hard limit: max 3 active goals. Everything else is parked or archived.
 */
import { now, newId } from "@cairn/shared";
// ---- Constants ----
export const MAX_ACTIVE_GOALS = 3;
// ---- Factory ----
export function createGoal(title, options) {
    const timestamp = now();
    return {
        id: newId(),
        title,
        status: "active",
        time_horizon: "3mo",
        priority: "soft",
        success_definition: "",
        anti_goals: [],
        metrics: [],
        allowed_interruption_level: 0.3,
        review_cadence_days: 7,
        confidence: 0.5,
        related_projects: [],
        max_interruptions_per_day: 3,
        interruptions_today: 0,
        actions_log: [],
        timeline: [],
        created_at: timestamp,
        updated_at: timestamp,
        ...options,
    };
}
//# sourceMappingURL=goal.js.map