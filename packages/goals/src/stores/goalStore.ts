/**
 * Goal Store
 * 
 * Persistent storage for long-lived goals.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { getDataPath, now, newId } from "@cairn/shared";
import type { Goal, GoalStatus, ActionLog } from "../types/goal.js";

// ---- State ----

let goals: Goal[] = [];
let dataPath: string;

// ---- Persistence ----

async function persist(): Promise<void> {
    const dir = dirname(dataPath);
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
    await writeFile(dataPath, JSON.stringify(goals, null, 2));
}

async function load(): Promise<void> {
    try {
        const data = await readFile(dataPath, "utf-8");
        goals = JSON.parse(data);
        console.log(`[goals] Loaded ${goals.length} goals`);
    } catch {
        goals = [];
        console.log("[goals] No existing goals, starting fresh");
    }
}

// ---- Init ----

export async function initGoalStore(): Promise<void> {
    dataPath = join(getDataPath(), "goals", "goals.json");
    await load();
}

// ---- CRUD ----

export function getGoals(): Goal[] {
    return [...goals];
}

export function getGoal(id: string): Goal | undefined {
    return goals.find(g => g.id === id);
}

export function getActiveGoals(): Goal[] {
    return goals.filter(g => g.status === "active");
}

export function getGoalsByDomain(domain: string): Goal[] {
    return goals.filter(g => g.domain === domain);
}

export async function createGoal(goal: Goal): Promise<Goal> {
    goals.push(goal);
    await persist();
    console.log(`[goals] Created goal: ${goal.title}`);
    return goal;
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | undefined> {
    const goal = goals.find(g => g.id === id);
    if (!goal) return undefined;

    Object.assign(goal, updates, { updatedAt: now() });
    await persist();
    return goal;
}

export async function setGoalStatus(id: string, status: GoalStatus, reason?: string): Promise<Goal | undefined> {
    const goal = goals.find(g => g.id === id);
    if (!goal) return undefined;

    goal.status = status;
    if (reason && status === "blocked") {
        goal.blockedReason = reason;
    }
    goal.updatedAt = now();
    await persist();

    console.log(`[goals] Goal "${goal.title}" → ${status}${reason ? `: ${reason}` : ""}`);
    return goal;
}

export async function logAction(
    goalId: string,
    action: string,
    result: ActionLog["result"],
    details?: string,
    itemIds?: string[]
): Promise<Goal | undefined> {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return undefined;

    const entry: ActionLog = {
        id: newId(),
        timestamp: now(),
        action,
        result,
        details,
        itemIds,
    };

    goal.actionsLog.push(entry);
    goal.lastChecked = now();
    goal.updatedAt = now();
    await persist();
    return goal;
}

export async function rejectItem(goalId: string, itemId: string): Promise<void> {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    if (!goal.rejectedItemIds.includes(itemId)) {
        goal.rejectedItemIds.push(itemId);
        goal.updatedAt = now();
        await persist();
    }
}

export function isItemRejected(goalId: string, itemId: string): boolean {
    const goal = goals.find(g => g.id === goalId);
    return goal?.rejectedItemIds.includes(itemId) ?? false;
}

export async function deleteGoal(id: string): Promise<boolean> {
    const idx = goals.findIndex(g => g.id === id);
    if (idx === -1) return false;

    goals.splice(idx, 1);
    await persist();
    return true;
}
