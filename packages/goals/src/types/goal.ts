/**
 * Goal Engine Types
 * 
 * Long-lived goals with constraints, preferences, and completion conditions.
 * Goals persist and run on schedules until resolved.
 */

import { now, newId } from "@cairn/shared";

// ---- Goal Status ----

export type GoalStatus =
    | "active"      // Currently pursuing
    | "paused"      // Temporarily stopped
    | "blocked"     // Can't proceed (needs input or constraint change)
    | "completed"   // Success criteria met
    | "abandoned";  // User killed it

// ---- Constraints (hard rules) ----

export type ConstraintOperator =
    | "lt" | "lte" | "gt" | "gte" | "eq" | "neq"
    | "in" | "not_in"
    | "contains" | "not_contains"
    | "within_km";

export interface Constraint {
    id: string;
    field: string;           // "price", "suburb", "transport_distance"
    operator: ConstraintOperator;
    value: unknown;          // 650, ["Brunswick", "Fitzroy"], 2
    description?: string;    // Human-readable: "Under $650/week"
}

// ---- Preference References (soft weights) ----

export interface PreferenceRef {
    profileId: string;       // Reference to PreferenceProfile
    weight: number;          // How much this profile influences scoring (0-1)
}

// ---- Action Log ----

export interface ActionLog {
    id: string;
    timestamp: string;
    action: string;          // "scraped_listings", "sent_enquiry"
    result: "success" | "failed" | "pending" | "rejected";
    details?: string;
    itemIds?: string[];      // IDs of items processed
}

// ---- Regret Profile ----

export type RegretProfile =
    | "miss_opportunity"  // Prefer action, fear of missing out
    | "avoid_mistake";    // Prefer caution, fear of wrong choice

// ---- Goal ----

export interface Goal {
    id: string;
    title: string;                      // "Find rental I'd actually like"
    domain: string;                     // "housing", "shopping", "travel"
    status: GoalStatus;

    // Success / failure
    completionConditions: string[];     // ["inspection_booked", "lease_signed"]
    blockedReason?: string;             // Why we can't proceed

    // Rules
    constraints: Constraint[];          // Hard filters
    preferences: PreferenceRef[];       // Soft scoring weights

    // Behavioral tuning
    frictionLevel: number;              // 0-1: how annoying this goal is allowed to be
    regretProfile: RegretProfile;       // What kind of regret to minimize
    maxInterruptionsPerDay: number;     // Hard cap on notifications
    interruptionsToday: number;         // Counter (resets daily)

    // Scheduling
    checkSchedule?: string;             // Cron: "0 8 * * *"
    lastChecked?: string;
    nextCheck?: string;
    nextAction?: string;                // What Cairn will do next

    // History (prevents loops, provides context)
    actionsLog: ActionLog[];
    rejectedItemIds: string[];          // Don't show these again

    // Metadata
    createdAt: string;
    updatedAt: string;
}

// ---- Factory ----

export function createGoal(
    title: string,
    domain: string,
    options?: Partial<Omit<Goal, "id" | "createdAt" | "updatedAt">>
): Goal {
    const timestamp = now();
    return {
        id: newId(),
        title,
        domain,
        status: "active",
        completionConditions: [],
        constraints: [],
        preferences: [],
        frictionLevel: 0.3,              // Conservative default
        regretProfile: "avoid_mistake",  // Cautious default
        maxInterruptionsPerDay: 5,       // Reasonable limit
        interruptionsToday: 0,
        actionsLog: [],
        rejectedItemIds: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        ...options,
    };
}

export function createConstraint(
    field: string,
    operator: ConstraintOperator,
    value: unknown,
    description?: string
): Constraint {
    return {
        id: newId(),
        field,
        operator,
        value,
        description,
    };
}
