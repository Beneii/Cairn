/**
 * SQLite-backed Goal Store
 * 
 * Replaces JSON file persistence with SQLite for query support.
 */

import { getDatabase, parseJSON, now } from "./database.js";
import { newId } from "@cairn/shared";
import type { Goal, GoalStatus, ActionLog, RegretProfile, Constraint, PreferenceRef } from "../types/goal.js";

// ---- Row Mapping ----

interface GoalRow {
    id: string;
    title: string;
    domain: string;
    status: string;
    completion_conditions: string;
    blocked_reason: string | null;
    constraints: string;
    preferences: string;
    friction_level: number;
    regret_profile: string;
    max_interruptions_per_day: number;
    interruptions_today: number;
    check_schedule: string | null;
    last_checked: string | null;
    next_check: string | null;
    next_action: string | null;
    actions_log: string;
    rejected_item_ids: string;
    created_at: string;
    updated_at: string;
}

function rowToGoal(row: GoalRow): Goal {
    return {
        id: row.id,
        title: row.title,
        domain: row.domain,
        status: row.status as GoalStatus,
        completionConditions: parseJSON<string[]>(row.completion_conditions, []),
        blockedReason: row.blocked_reason ?? undefined,
        constraints: parseJSON<Constraint[]>(row.constraints, []),
        preferences: parseJSON<PreferenceRef[]>(row.preferences, []),
        frictionLevel: row.friction_level,
        regretProfile: row.regret_profile as RegretProfile,
        maxInterruptionsPerDay: row.max_interruptions_per_day,
        interruptionsToday: row.interruptions_today,
        checkSchedule: row.check_schedule ?? undefined,
        lastChecked: row.last_checked ?? undefined,
        nextCheck: row.next_check ?? undefined,
        nextAction: row.next_action ?? undefined,
        actionsLog: parseJSON<ActionLog[]>(row.actions_log, []),
        rejectedItemIds: parseJSON<string[]>(row.rejected_item_ids, []),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ---- Queries ----

export function getGoals(): Goal[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM goals ORDER BY updated_at DESC").all() as GoalRow[];
    return rows.map(rowToGoal);
}

export function getGoal(id: string): Goal | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM goals WHERE id = ?").get(id) as GoalRow | undefined;
    return row ? rowToGoal(row) : undefined;
}

export function getActiveGoals(): Goal[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM goals WHERE status = 'active' ORDER BY updated_at DESC").all() as GoalRow[];
    return rows.map(rowToGoal);
}

export function getGoalsByDomain(domain: string): Goal[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM goals WHERE domain = ? ORDER BY updated_at DESC").all(domain) as GoalRow[];
    return rows.map(rowToGoal);
}

export function getGoalsDueForCheck(): Goal[] {
    const db = getDatabase();
    const nowStr = now();
    const rows = db.prepare(`
    SELECT * FROM goals 
    WHERE status = 'active' 
    AND next_check IS NOT NULL 
    AND next_check <= ?
    ORDER BY next_check ASC
  `).all(nowStr) as GoalRow[];
    return rows.map(rowToGoal);
}

// ---- Mutations ----

export function createGoal(goal: Goal): Goal {
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO goals (
      id, title, domain, status, completion_conditions, blocked_reason,
      constraints, preferences, friction_level, regret_profile,
      max_interruptions_per_day, interruptions_today, check_schedule,
      last_checked, next_check, next_action, actions_log, rejected_item_ids,
      created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

    stmt.run(
        goal.id,
        goal.title,
        goal.domain,
        goal.status,
        JSON.stringify(goal.completionConditions),
        goal.blockedReason ?? null,
        JSON.stringify(goal.constraints),
        JSON.stringify(goal.preferences),
        goal.frictionLevel,
        goal.regretProfile,
        goal.maxInterruptionsPerDay,
        goal.interruptionsToday,
        goal.checkSchedule ?? null,
        goal.lastChecked ?? null,
        goal.nextCheck ?? null,
        goal.nextAction ?? null,
        JSON.stringify(goal.actionsLog),
        JSON.stringify(goal.rejectedItemIds),
        goal.createdAt,
        goal.updatedAt
    );

    console.log(`[goals-db] Created goal: ${goal.title}`);
    return goal;
}

export function updateGoal(id: string, updates: Partial<Goal>): Goal | undefined {
    const existing = getGoal(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates, updatedAt: now() };
    const db = getDatabase();

    const stmt = db.prepare(`
    UPDATE goals SET
      title = ?, domain = ?, status = ?, completion_conditions = ?,
      blocked_reason = ?, constraints = ?, preferences = ?,
      friction_level = ?, regret_profile = ?, max_interruptions_per_day = ?,
      interruptions_today = ?, check_schedule = ?, last_checked = ?,
      next_check = ?, next_action = ?, actions_log = ?, rejected_item_ids = ?,
      updated_at = ?
    WHERE id = ?
  `);

    stmt.run(
        updated.title,
        updated.domain,
        updated.status,
        JSON.stringify(updated.completionConditions),
        updated.blockedReason ?? null,
        JSON.stringify(updated.constraints),
        JSON.stringify(updated.preferences),
        updated.frictionLevel,
        updated.regretProfile,
        updated.maxInterruptionsPerDay,
        updated.interruptionsToday,
        updated.checkSchedule ?? null,
        updated.lastChecked ?? null,
        updated.nextCheck ?? null,
        updated.nextAction ?? null,
        JSON.stringify(updated.actionsLog),
        JSON.stringify(updated.rejectedItemIds),
        updated.updatedAt,
        id
    );

    return updated;
}

export function setGoalStatus(id: string, status: GoalStatus, reason?: string): Goal | undefined {
    const updates: Partial<Goal> = { status };
    if (reason && status === "blocked") {
        updates.blockedReason = reason;
    }
    return updateGoal(id, updates);
}

export function logAction(
    goalId: string,
    action: string,
    result: ActionLog["result"],
    details?: string,
    itemIds?: string[]
): Goal | undefined {
    const goal = getGoal(goalId);
    if (!goal) return undefined;

    const entry: ActionLog = {
        id: newId(),
        timestamp: now(),
        action,
        result,
        details,
        itemIds,
    };

    return updateGoal(goalId, {
        actionsLog: [...goal.actionsLog, entry],
        lastChecked: now(),
    });
}

export function rejectItem(goalId: string, itemId: string): void {
    const goal = getGoal(goalId);
    if (!goal) return;

    if (!goal.rejectedItemIds.includes(itemId)) {
        updateGoal(goalId, {
            rejectedItemIds: [...goal.rejectedItemIds, itemId],
        });
    }
}

export function isItemRejected(goalId: string, itemId: string): boolean {
    const goal = getGoal(goalId);
    return goal?.rejectedItemIds.includes(itemId) ?? false;
}

export function incrementInterruptions(goalId: string): Goal | undefined {
    const goal = getGoal(goalId);
    if (!goal) return undefined;
    return updateGoal(goalId, { interruptionsToday: goal.interruptionsToday + 1 });
}

export function resetDailyInterruptions(): void {
    const db = getDatabase();
    db.prepare("UPDATE goals SET interruptions_today = 0 WHERE status = 'active'").run();
    console.log("[goals-db] Reset daily interruption counters");
}

export function deleteGoal(id: string): boolean {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM goals WHERE id = ?").run(id);
    return result.changes > 0;
}
