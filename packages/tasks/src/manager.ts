import { getDatabase } from "./db.js";
import { newId, now } from "@cairn/shared";
import type { Task, TaskStatus, TaskType } from "@cairn/shared";

// ---- Data Access ----

export function getTasks(filter?: { status?: TaskStatus; source?: "user" | "cairn" }): Task[] {
    const db = getDatabase();
    const conditions: string[] = [];
    const args: any[] = [];

    if (filter?.status) {
        conditions.push("status = ?");
        args.push(filter.status);
    }
    if (filter?.source) {
        conditions.push("source = ?");
        args.push(filter.source);
    }

    let sql = "SELECT * FROM tasks";
    if (conditions.length > 0) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY scheduled_date ASC, created_at DESC";

    const rows = db.prepare(sql).all(...args) as any[];
    return rows.map(rowToTask);
}

export function getTask(id: string): Task | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    return row ? rowToTask(row) : undefined;
}

export function getTasksForGoal(goalId: string): Task[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM tasks WHERE goal_id = ? ORDER BY created_at DESC").all(goalId) as any[];
    return rows.map(rowToTask);
}

function rowToTask(row: any): Task {
    return {
        id: row.id,
        title: row.title,
        status: row.status as TaskStatus,
        type: row.type as TaskType,
        due_date: row.due_date || undefined,
        scheduled_date: row.scheduled_date || undefined,
        recurrence_rule: row.recurrence_rule || undefined,
        source: row.source as "user" | "cairn",
        suggested_by_agent: Boolean(row.suggested_by_agent),
        goal_id: row.goal_id || undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at || undefined,
    };
}

// ---- Mutations ----

export function createTask(task: Partial<Task> & { title: string }): Task {
    const db = getDatabase();
    const fullTask: Task = {
        id: newId(),
        status: "todo",
        type: "one-off",
        source: "user",
        created_at: now(),
        updated_at: now(),
        ...task,
    };

    const stmt = db.prepare(`
    INSERT INTO tasks (
      id, title, status, type, due_date, scheduled_date, recurrence_rule,
      source, suggested_by_agent, goal_id, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

    stmt.run(
        fullTask.id, fullTask.title, fullTask.status, fullTask.type,
        fullTask.due_date || null, fullTask.scheduled_date || null,
        fullTask.recurrence_rule || null, fullTask.source,
        fullTask.suggested_by_agent ? 1 : 0,
        fullTask.goal_id || null,
        fullTask.created_at, fullTask.updated_at
    );

    return fullTask;
}

export function updateTask(id: string, changes: Partial<Task>): Task | undefined {
    const current = getTask(id);
    if (!current) return undefined;

    const db = getDatabase();
    const updated = { ...current, ...changes, updated_at: now() };

    // If completing, set completed_at
    if (changes.status === "done" && current.status !== "done") {
        updated.completed_at = now();
    }

    const stmt = db.prepare(`
    UPDATE tasks SET
      title = ?, status = ?, type = ?, due_date = ?, scheduled_date = ?,
      recurrence_rule = ?, source = ?, suggested_by_agent = ?,
      goal_id = ?, updated_at = ?, completed_at = ?
    WHERE id = ?
  `);

    stmt.run(
        updated.title, updated.status, updated.type, updated.due_date || null,
        updated.scheduled_date || null, updated.recurrence_rule || null,
        updated.source, updated.suggested_by_agent ? 1 : 0,
        updated.goal_id || null,
        updated.updated_at, updated.completed_at || null,
        id
    );

    return updated;
}

export function deleteTask(id: string): boolean {
    const db = getDatabase();
    const res = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
    return res.changes > 0;
}

// ---- Logic ----

export function completeTask(id: string): Task | undefined {
    const task = getTask(id);
    if (!task) return undefined;

    const updated = updateTask(id, { status: "done" });

    // Handle recurrence
    if (task.type === "recurring" && task.recurrence_rule) {
        // Spawn next instance
        const nextDate = calculateNextDate(task.recurrence_rule);
        createTask({
            title: task.title,
            type: "recurring",
            recurrence_rule: task.recurrence_rule,
            status: "todo",
            scheduled_date: nextDate,
            source: task.source,
            goal_id: task.goal_id,
        });
    }

    return updated;
}

function calculateNextDate(rule: string): string {
    const d = new Date();
    if (rule === "daily") d.setDate(d.getDate() + 1);
    if (rule === "weekly") d.setDate(d.getDate() + 7);
    if (rule === "monthly") d.setMonth(d.getMonth() + 1);
    return d.toISOString();
}
