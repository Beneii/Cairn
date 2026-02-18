/**
 * SQLite-backed Goal Store
 */
import { getDatabase, parseJSON, now } from "./database.js";
import { newId } from "@cairn/shared";
import { MAX_ACTIVE_GOALS } from "../types/goal.js";
function rowToGoal(row) {
    return {
        id: row.id,
        title: row.title,
        status: row.status,
        time_horizon: row.time_horizon,
        priority: row.priority,
        success_definition: row.success_definition,
        anti_goals: parseJSON(row.anti_goals, []),
        metrics: parseJSON(row.metrics, []),
        allowed_interruption_level: row.allowed_interruption_level,
        review_cadence_days: row.review_cadence_days,
        confidence: row.confidence,
        related_projects: parseJSON(row.related_projects, []),
        last_reviewed: row.last_reviewed ?? undefined,
        next_review: row.next_review ?? undefined,
        max_interruptions_per_day: row.max_interruptions_per_day,
        interruptions_today: row.interruptions_today,
        blocked_reason: row.blocked_reason ?? undefined,
        actions_log: parseJSON(row.actions_log, []),
        timeline: parseJSON(row.timeline, []),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}
// ---- Queries ----
export function getGoals() {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM goals ORDER BY updated_at DESC").all();
    return rows.map(rowToGoal);
}
export function getGoal(id) {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM goals WHERE id = ?").get(id);
    return row ? rowToGoal(row) : undefined;
}
export function getActiveGoals() {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM goals WHERE status = 'active' ORDER BY updated_at DESC").all();
    return rows.map(rowToGoal);
}
export function getGoalsDueForCheck() {
    const db = getDatabase();
    const nowStr = now();
    const rows = db.prepare(`
    SELECT * FROM goals
    WHERE status = 'active'
    AND next_review IS NOT NULL
    AND next_review <= ?
    ORDER BY next_review ASC
  `).all(nowStr);
    return rows.map(rowToGoal);
}
// ---- Mutations ----
export function createGoal(goal) {
    // Enforce max 3 active goals
    const activeCount = getActiveGoals().length;
    if (goal.status === "active" && activeCount >= MAX_ACTIVE_GOALS) {
        throw new Error(`Cannot create active goal: already at limit of ${MAX_ACTIVE_GOALS}. Pause or complete an existing goal first.`);
    }
    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO goals (
      id, title, status, time_horizon, priority, success_definition,
      anti_goals, metrics, allowed_interruption_level, review_cadence_days,
      confidence, related_projects, last_reviewed, next_review,
      max_interruptions_per_day, interruptions_today, blocked_reason,
      actions_log, timeline, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);
    stmt.run(goal.id, goal.title, goal.status, goal.time_horizon, goal.priority, goal.success_definition, JSON.stringify(goal.anti_goals), JSON.stringify(goal.metrics), goal.allowed_interruption_level, goal.review_cadence_days, goal.confidence, JSON.stringify(goal.related_projects), goal.last_reviewed ?? null, goal.next_review ?? null, goal.max_interruptions_per_day, goal.interruptions_today, goal.blocked_reason ?? null, JSON.stringify(goal.actions_log), JSON.stringify(goal.timeline || []), goal.created_at, goal.updated_at);
    console.log(`[goals-db] Created goal: ${goal.title}`);
    return goal;
}
export function updateGoal(id, updates) {
    const existing = getGoal(id);
    if (!existing)
        return undefined;
    // Enforce max 3 active goals on status change
    if (updates.status === "active" && existing.status !== "active") {
        const activeCount = getActiveGoals().length;
        if (activeCount >= MAX_ACTIVE_GOALS) {
            throw new Error(`Cannot activate goal: already at limit of ${MAX_ACTIVE_GOALS}.`);
        }
    }
    const updated = { ...existing, ...updates, updated_at: now() };
    const db = getDatabase();
    const stmt = db.prepare(`
    UPDATE goals SET
      title = ?, status = ?, time_horizon = ?, priority = ?,
      success_definition = ?, anti_goals = ?, metrics = ?,
      allowed_interruption_level = ?, review_cadence_days = ?,
      confidence = ?, related_projects = ?, last_reviewed = ?,
      next_review = ?, max_interruptions_per_day = ?,
      interruptions_today = ?, blocked_reason = ?,
      actions_log = ?, timeline = ?, updated_at = ?
    WHERE id = ?
  `);
    stmt.run(updated.title, updated.status, updated.time_horizon, updated.priority, updated.success_definition, JSON.stringify(updated.anti_goals), JSON.stringify(updated.metrics), updated.allowed_interruption_level, updated.review_cadence_days, updated.confidence, JSON.stringify(updated.related_projects), updated.last_reviewed ?? null, updated.next_review ?? null, updated.max_interruptions_per_day, updated.interruptions_today, updated.blocked_reason ?? null, JSON.stringify(updated.actions_log), JSON.stringify(updated.timeline || []), updated.updated_at, id);
    return updated;
}
export function setGoalStatus(id, status, reason) {
    const updates = { status };
    if (reason && status === "blocked") {
        updates.blocked_reason = reason;
    }
    return updateGoal(id, updates);
}
export function logAction(goalId, action, result, details) {
    const goal = getGoal(goalId);
    if (!goal)
        return undefined;
    const entry = {
        id: newId(),
        timestamp: now(),
        action,
        result,
        details,
    };
    return updateGoal(goalId, {
        actions_log: [...goal.actions_log, entry],
        last_reviewed: now(),
    });
}
export function incrementInterruptions(goalId) {
    const goal = getGoal(goalId);
    if (!goal)
        return undefined;
    return updateGoal(goalId, { interruptions_today: goal.interruptions_today + 1 });
}
export function resetDailyInterruptions() {
    const db = getDatabase();
    db.prepare("UPDATE goals SET interruptions_today = 0 WHERE status = 'active'").run();
    console.log("[goals-db] Reset daily interruption counters");
}
export function deleteGoal(id) {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM goals WHERE id = ?").run(id);
    return result.changes > 0;
}
//# sourceMappingURL=goalDb.js.map