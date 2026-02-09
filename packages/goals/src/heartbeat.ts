/**
 * Goal Heartbeat
 * 
 * The central loop that checks goals, runs scheduled tasks, and manages interruptions.
 */

import * as db from "./db/index.js";
import { now } from "@cairn/shared";
import type { Goal } from "./types/goal.js";

export interface HeartbeatResult {
    goalsChecked: number;
    actionsTriggered: string[];
    interruptionsSent: number;
    errors: string[];
}

export interface HeartbeatConfig {
    maxActionsPerBeat: number;    // Limit total actions per heartbeat
    respectInterruptionBudget: boolean;
    dryRun: boolean;              // Log but don't execute
}

const DEFAULT_CONFIG: HeartbeatConfig = {
    maxActionsPerBeat: 10,
    respectInterruptionBudget: true,
    dryRun: false,
};

/**
 * Main heartbeat function - call this on a schedule (e.g., every 5 minutes)
 */
export async function runHeartbeat(config: Partial<HeartbeatConfig> = {}): Promise<HeartbeatResult> {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const result: HeartbeatResult = {
        goalsChecked: 0,
        actionsTriggered: [],
        interruptionsSent: 0,
        errors: [],
    };

    console.log("[heartbeat] Starting heartbeat cycle");

    // Get goals due for check
    const dueGoals = db.getGoalsDueForCheck();
    console.log(`[heartbeat] ${dueGoals.length} goals due for check`);

    for (const goal of dueGoals) {
        if (result.actionsTriggered.length >= cfg.maxActionsPerBeat) {
            console.log("[heartbeat] Max actions reached, stopping early");
            break;
        }

        try {
            await checkGoal(goal, cfg, result);
            result.goalsChecked++;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : "Unknown error";
            result.errors.push(`Goal ${goal.id}: ${errMsg}`);
            console.error(`[heartbeat] Error checking goal ${goal.id}:`, err);
        }
    }

    console.log(`[heartbeat] Complete: ${result.goalsChecked} checked, ${result.actionsTriggered.length} actions, ${result.errors.length} errors`);
    return result;
}

/**
 * Check a single goal and trigger any needed actions
 */
async function checkGoal(
    goal: Goal,
    config: HeartbeatConfig,
    result: HeartbeatResult
): Promise<void> {
    console.log(`[heartbeat] Checking goal: ${goal.title}`);

    // Check interruption budget
    if (config.respectInterruptionBudget) {
        if (goal.interruptions_today >= goal.max_interruptions_per_day) {
            console.log(`[heartbeat] Goal ${goal.id} at interruption limit (${goal.interruptions_today}/${goal.max_interruptions_per_day})`);
            // Update lastChecked but don't interrupt
            db.updateGoal(goal.id, { last_reviewed: now() });
            return;
        }
    }

    // Determine next action based on goal state
    const nextAction = determineNextAction(goal);

    if (!nextAction) {
        // No action needed, just update last_reviewed
        db.updateGoal(goal.id, { last_reviewed: now() });
        return;
    }

    // Log the action
    if (!config.dryRun) {
        db.logAction(goal.id, nextAction.action, "pending", nextAction.description);
        result.actionsTriggered.push(`${goal.id}:${nextAction.action}`);

        // Schedule next review
        const nextReview = calculateNextCheck(goal);
        db.updateGoal(goal.id, {
            last_reviewed: now(),
            next_review: nextReview,
        });
    } else {
        console.log(`[heartbeat] DRY RUN: Would trigger ${nextAction.action} for goal ${goal.id}`);
    }
}

interface NextAction {
    action: string;
    description: string;
    requiresApproval: boolean;
}

/**
 * Determine what action a goal should take next
 */
function determineNextAction(goal: Goal): NextAction | null {
    // This will be expanded with domain-specific logic
    // For now, return a generic "check" action

    if (goal.status !== "active") {
        return null;
    }

    // Default: just a check cycle
    return {
        action: "check_status",
        description: "Periodic status check",
        requiresApproval: false,
    };
}

/**
 * Calculate next review time based on goal's review cadence
 */
function calculateNextCheck(goal: Goal): string {
    const cadenceMs = goal.review_cadence_days * 24 * 60 * 60 * 1000;
    const nextCheck = new Date(Date.now() + cadenceMs);
    return nextCheck.toISOString();
}

/**
 * Reset daily counters - call at midnight
 */
export function resetDailyCounters(): void {
    db.resetDailyInterruptions();
    console.log("[heartbeat] Daily counters reset");
}

/**
 * Manually trigger a goal check (bypasses schedule)
 */
export async function triggerGoalCheck(goalId: string): Promise<HeartbeatResult> {
    const goal = db.getGoal(goalId);
    if (!goal) {
        return {
            goalsChecked: 0,
            actionsTriggered: [],
            interruptionsSent: 0,
            errors: [`Goal ${goalId} not found`],
        };
    }

    const result: HeartbeatResult = {
        goalsChecked: 0,
        actionsTriggered: [],
        interruptionsSent: 0,
        errors: [],
    };

    await checkGoal(goal, DEFAULT_CONFIG, result);
    result.goalsChecked = 1;

    return result;
}
