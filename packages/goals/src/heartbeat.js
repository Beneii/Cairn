/**
 * Goal Heartbeat
 *
 * The central loop that checks goals, runs scheduled tasks, and manages interruptions.
 */
import * as db from "./db/index.js";
import { bus, now } from "@cairn/shared";
const DEFAULT_CONFIG = {
    maxActionsPerBeat: 10,
    respectInterruptionBudget: true,
    dryRun: false,
};
/**
 * Main heartbeat function - call this on a schedule (e.g., every 5 minutes)
 */
export async function runHeartbeat(config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const result = {
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
        }
        catch (err) {
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
async function checkGoal(goal, config, result) {
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
        // Emit event so the task agent can pick it up
        bus.emit("log:entry", {
            id: goal.id,
            timestamp: now(),
            type: "agent",
            content: `[heartbeat] Goal "${goal.title}" action: ${nextAction.action} — ${nextAction.description}`,
        });
        // Schedule next review
        const nextReview = calculateNextCheck(goal);
        db.updateGoal(goal.id, {
            last_reviewed: now(),
            next_review: nextReview,
        });
    }
    else {
        console.log(`[heartbeat] DRY RUN: Would trigger ${nextAction.action} for goal ${goal.id}`);
    }
}
/**
 * Determine what action a goal should take next based on its current state.
 */
function determineNextAction(goal) {
    if (goal.status !== "active") {
        return null;
    }
    const nowMs = Date.now();
    const createdMs = new Date(goal.created_at).getTime();
    const ageHours = (nowMs - createdMs) / (1000 * 60 * 60);
    // Check recent actions to avoid repeating
    const recentActions = goal.actions_log.filter((a) => {
        const actionMs = new Date(a.timestamp).getTime();
        return (nowMs - actionMs) < 24 * 60 * 60 * 1000; // last 24h
    });
    const recentActionTypes = new Set(recentActions.map((a) => a.action));
    // New goal (< 2 hours old) with no task-creation action yet
    if (ageHours < 2 && !recentActionTypes.has("create_tasks")) {
        return {
            action: "create_tasks",
            description: `New goal needs initial tasks: "${goal.title}"`,
            requiresApproval: false,
        };
    }
    // Goal confidence is dropping — reassess
    if (goal.confidence < 0.3 && !recentActionTypes.has("reassess")) {
        return {
            action: "reassess",
            description: `Low confidence (${Math.round(goal.confidence * 100)}%) — needs reassessment`,
            requiresApproval: false,
        };
    }
    // Check if all recent logged actions are completed (milestone check)
    const pendingActions = goal.actions_log.filter((a) => a.result === "pending");
    const completedRecently = goal.actions_log.filter((a) => {
        const actionMs = new Date(a.timestamp).getTime();
        return a.result === "success" && (nowMs - actionMs) < 7 * 24 * 60 * 60 * 1000;
    });
    if (completedRecently.length >= 3 && pendingActions.length === 0 && !recentActionTypes.has("check_milestone")) {
        return {
            action: "check_milestone",
            description: `Multiple tasks completed — check if goal milestone reached`,
            requiresApproval: false,
        };
    }
    // Stalled — no completed actions in 7 days
    const lastCompletedAction = goal.actions_log
        .filter((a) => a.result === "success")
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    if (lastCompletedAction) {
        const daysSinceCompletion = (nowMs - new Date(lastCompletedAction.timestamp).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCompletion > 7 && !recentActionTypes.has("review_tasks")) {
            return {
                action: "review_tasks",
                description: `No task progress in ${Math.round(daysSinceCompletion)} days — review and create new tasks`,
                requiresApproval: false,
            };
        }
    }
    else if (ageHours > 48 && !recentActionTypes.has("create_tasks")) {
        // Goal is 2+ days old with zero completed actions — needs tasks
        return {
            action: "create_tasks",
            description: `Goal has no completed work yet — create actionable tasks`,
            requiresApproval: false,
        };
    }
    // Default: periodic check
    return {
        action: "check_status",
        description: "Periodic status check",
        requiresApproval: false,
    };
}
/**
 * Calculate next review time based on goal's review cadence
 */
function calculateNextCheck(goal) {
    const cadenceMs = goal.review_cadence_days * 24 * 60 * 60 * 1000;
    const nextCheck = new Date(Date.now() + cadenceMs);
    return nextCheck.toISOString();
}
/**
 * Reset daily counters - call at midnight
 */
export function resetDailyCounters() {
    db.resetDailyInterruptions();
    console.log("[heartbeat] Daily counters reset");
}
/**
 * Manually trigger a goal check (bypasses schedule)
 */
export async function triggerGoalCheck(goalId) {
    const goal = db.getGoal(goalId);
    if (!goal) {
        return {
            goalsChecked: 0,
            actionsTriggered: [],
            interruptionsSent: 0,
            errors: [`Goal ${goalId} not found`],
        };
    }
    const result = {
        goalsChecked: 0,
        actionsTriggered: [],
        interruptionsSent: 0,
        errors: [],
    };
    await checkGoal(goal, DEFAULT_CONFIG, result);
    result.goalsChecked = 1;
    return result;
}
//# sourceMappingURL=heartbeat.js.map