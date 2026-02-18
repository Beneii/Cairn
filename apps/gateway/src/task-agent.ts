/**
 * Task Agent — Autonomous Goal-Driven Task Engine
 *
 * Runs every 30 minutes. Reads active goals + existing tasks,
 * uses LLM to decide what tasks to create, complete, or suggest.
 *
 * Guard rails:
 * - Max 3 tasks created per cycle
 * - Max 1 self-execution per cycle
 * - Respects quiet hours
 * - Deduplicates by title similarity
 * - All actions logged to ledger
 */

import { bus, newId, now, shortTime } from "@cairn/shared";
import type { Goal, Task } from "@cairn/shared";
import { appendEntry } from "@cairn/ledger";
import { isLLMAvailable, callLLM, processMessage } from "@cairn/orchestrator";
import { getActiveGoals } from "@cairn/goals";
import { getProactiveConfig, shouldNudgeNow } from "@cairn/goals";
import { getTasks, getTasksForGoal, createTask } from "@cairn/tasks";

const TASK_AGENT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TASKS_PER_CYCLE = 3;
const MAX_SELF_EXEC_PER_CYCLE = 1;

interface AgentDecision {
    create: { title: string; goal_id: string; due_date?: string }[];
    complete_self: string[]; // task titles to attempt via processMessage
    suggest: { title: string; goal_id: string; reason: string }[];
}

function isSimilarTitle(a: string, b: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalize(a) === normalize(b);
}

async function runTaskAgentCycle(): Promise<void> {
    const config = getProactiveConfig();
    if (!config.enabled) return;
    if (!shouldNudgeNow(config)) return;
    if (!isLLMAvailable()) return;

    const activeGoals = getActiveGoals();
    if (activeGoals.length === 0) return;

    // Gather context
    const allTasks = getTasks();
    const todoTasks = allTasks.filter((t) => t.status === "todo");
    const recentlyCompleted = allTasks.filter((t) => {
        if (t.status !== "done" || !t.completed_at) return false;
        return Date.now() - new Date(t.completed_at).getTime() < 7 * 24 * 60 * 60 * 1000;
    });

    // Build per-goal context
    const goalContexts = activeGoals.map((g) => {
        const goalTasks = getTasksForGoal(g.id);
        const pending = goalTasks.filter((t) => t.status === "todo");
        const done = goalTasks.filter((t) => t.status === "done");
        return {
            id: g.id,
            title: g.title,
            success_definition: g.success_definition,
            confidence: g.confidence,
            time_horizon: g.time_horizon,
            pending_tasks: pending.map((t) => t.title),
            completed_tasks: done.map((t) => t.title),
            days_old: Math.round((Date.now() - new Date(g.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        };
    });

    // Check if there's actually work to do
    const goalsWithoutTasks = goalContexts.filter((g) => g.pending_tasks.length === 0);
    const allGoalsHaveTasks = goalsWithoutTasks.length === 0;
    const hasRecentCompletions = recentlyCompleted.length > 0;

    // Skip if all goals have pending tasks and nothing was recently completed
    if (allGoalsHaveTasks && !hasRecentCompletions) {
        console.log("[task-agent] All goals have pending tasks, nothing to do");
        return;
    }

    console.log(`[task-agent] Running cycle: ${activeGoals.length} goals, ${todoTasks.length} pending tasks`);

    try {
        const response = await callLLM(
            {
                model: "gpt-4o-mini",
                systemPrompt: `You are Cairn's autonomous task planning engine. Your job is to keep the user's goals moving forward by creating and managing tasks.

## Context
You are given the user's active goals with their success definitions, existing tasks, and recently completed tasks.

## Your Decisions (output as JSON)
{
  "create": [{"title": "...", "goal_id": "...", "due_date": "YYYY-MM-DD or null"}],
  "complete_self": ["task title to attempt"],
  "suggest": [{"title": "...", "goal_id": "...", "reason": "..."}]
}

### "create" — tasks Cairn should make
- Research, organization, information gathering, drafting, summarizing
- Things that don't require the user's physical presence or approval
- Break goals into concrete next steps
- Max ${MAX_TASKS_PER_CYCLE} tasks per cycle

### "complete_self" — existing tasks Cairn can do right now
- Only tasks Cairn can actually do (research, write, organize, search)
- NOT tasks that need user action (exercise, meetings, phone calls)
- Max ${MAX_SELF_EXEC_PER_CYCLE} per cycle

### "suggest" — tasks that need user action
- Things only the user can do
- Include a brief reason so the user understands why

## Rules
- Don't duplicate existing tasks (check pending_tasks lists)
- Prefer fewer, higher-quality tasks over many low-quality ones
- If a goal already has good pending tasks, skip it
- Focus on goals without pending tasks first
- Be practical and specific — "Research X" is better than "Think about X"
- If nothing useful to do, return empty arrays
- Return ONLY valid JSON, no markdown`,
                userMessage: JSON.stringify({
                    goals: goalContexts,
                    existing_todo_tasks: todoTasks.map((t) => ({ title: t.title, goal_id: t.goal_id })),
                    recently_completed: recentlyCompleted.slice(0, 10).map((t) => t.title),
                }, null, 2),
                maxTokens: 600,
                responseFormat: "json_object",
                temperature: 0.3,
            },
            "task-agent",
            "cycle-" + newId().slice(0, 8),
        );

        let decision: AgentDecision;
        try {
            decision = JSON.parse(response.content.trim());
        } catch {
            console.warn("[task-agent] Failed to parse LLM response:", response.content.substring(0, 200));
            return;
        }

        // Validate and execute
        const created: string[] = [];
        const attempted: string[] = [];
        const suggested: string[] = [];

        // 1. Create tasks
        const toCreate = (decision.create || []).slice(0, MAX_TASKS_PER_CYCLE);
        for (const item of toCreate) {
            // Deduplicate
            const isDuplicate = allTasks.some((t) => t.status === "todo" && isSimilarTitle(t.title, item.title));
            if (isDuplicate) {
                console.log(`[task-agent] Skipping duplicate: "${item.title}"`);
                continue;
            }

            // Validate goal exists
            if (!activeGoals.some((g) => g.id === item.goal_id)) {
                console.log(`[task-agent] Skipping task with invalid goal_id: "${item.title}"`);
                continue;
            }

            const task = createTask({
                title: item.title,
                source: "cairn",
                goal_id: item.goal_id,
                due_date: item.due_date || undefined,
            });

            created.push(task.title);
            bus.emit("tasks:updated", getTasks());
        }

        // 2. Self-execute tasks
        const toExec = (decision.complete_self || []).slice(0, MAX_SELF_EXEC_PER_CYCLE);
        for (const taskTitle of toExec) {
            console.log(`[task-agent] Self-executing: "${taskTitle}"`);
            attempted.push(taskTitle);
            try {
                await processMessage(taskTitle);
            } catch (err) {
                console.error(`[task-agent] Self-execution failed for "${taskTitle}":`, err);
            }
        }

        // 3. Suggest tasks to user
        const toSuggest = (decision.suggest || []).slice(0, 3);
        for (const item of toSuggest) {
            suggested.push(item.title);
        }

        // Send consolidated message to user if there's anything to report
        const parts: string[] = [];

        if (created.length > 0) {
            parts.push(`I created ${created.length} task${created.length > 1 ? "s" : ""} to keep your goals moving:\n${created.map((t) => `- ${t}`).join("\n")}`);
        }

        if (suggested.length > 0) {
            const suggestLines = toSuggest.map((s) => `- **${s.title}** — ${s.reason}`);
            parts.push(`Some things that might need your attention:\n${suggestLines.join("\n")}`);
        }

        if (parts.length > 0) {
            bus.emit("chat:message", {
                id: newId(),
                role: "cairn",
                text: parts.join("\n\n"),
                timestamp: shortTime(),
            });
        }

        // Log to ledger
        await appendEntry(
            "agent",
            "task-agent",
            "cycle",
            JSON.stringify({
                created: created.length,
                attempted: attempted.length,
                suggested: suggested.length,
                details: { created, attempted, suggested },
            }),
        );

        if (created.length > 0 || attempted.length > 0 || suggested.length > 0) {
            console.log(`[task-agent] Cycle complete: ${created.length} created, ${attempted.length} attempted, ${suggested.length} suggested`);
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[task-agent] Cycle error:", msg);
        await appendEntry("agent", "task-agent", "error", msg);
    }
}

export function startTaskAgent(): void {
    // Initial run after 2 minutes (let system settle)
    setTimeout(() => {
        runTaskAgentCycle().catch((err) => console.error("[task-agent] Initial cycle error:", err));
    }, 2 * 60 * 1000);

    setInterval(() => {
        runTaskAgentCycle().catch((err) => console.error("[task-agent] Cycle error:", err));
    }, TASK_AGENT_INTERVAL_MS);

    console.log(`[task-agent] Task agent started (interval: ${TASK_AGENT_INTERVAL_MS / 1000 / 60}min)`);
}
