/**
 * Goal Types
 *
 * Long-term goals as active constraints on Cairn's behavior.
 * Goals are first-class objects that shape decisions, scheduling, and suggestions.
 *
 * Hard limit: max 3 active goals. Everything else is parked or archived.
 */

import { now, newId } from "@cairn/shared";

// ---- Goal Status ----

export type GoalStatus =
    | "active"      // Currently pursuing (max 3)
    | "paused"      // Temporarily stopped
    | "blocked"     // Can't proceed (needs input or change)
    | "completed"   // Success criteria met
    | "abandoned";  // User killed it

// ---- Time Horizon ----

export type TimeHorizon = "1mo" | "3mo" | "6mo" | "12mo";

// ---- Priority ----

export type GoalPriority = "hard" | "soft";
// hard = active constraint, Cairn nudges work toward it
// soft = only surfaces opportunities, no pressure

// ---- Action Log ----

export interface ActionLog {
    id: string;
    timestamp: string;
    action: string;          // "reviewed", "made_progress", "stalled", "updated_definition"
    result: "success" | "failed" | "pending" | "skipped";
    details?: string;
}

// ---- Goal ----

export const MAX_ACTIVE_GOALS = 3;

export interface Goal {
    id: string;
    title: string;
    status: GoalStatus;

    // Core definition (user-authored, Cairn-sharpened)
    time_horizon: TimeHorizon;
    priority: GoalPriority;
    success_definition: string;         // What "done" looks like
    anti_goals: string[];               // Explicit things to avoid
    metrics: string[];                  // How to measure progress (qualitative or quantitative)

    // Behavioral tuning
    allowed_interruption_level: number; // 0-1: how aggressive Cairn is about this goal
    review_cadence_days: number;        // How often to review (in days)
    confidence: number;                 // 0-1: how solid this goal actually is

    // Connections
    related_projects: string[];         // Linked Kanban project names

    // Scheduling
    last_reviewed?: string;
    next_review?: string;

    // Interruption budget
    max_interruptions_per_day: number;
    interruptions_today: number;

    // State
    blocked_reason?: string;

    // History
    actions_log: ActionLog[];

    // Metadata
    created_at: string;
    updated_at: string;
}

// ---- Factory ----

export function createGoal(
    title: string,
    options?: Partial<Omit<Goal, "id" | "created_at" | "updated_at">>
): Goal {
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
        created_at: timestamp,
        updated_at: timestamp,
        ...options,
    };
}
