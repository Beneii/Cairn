/**
 * Proactive Intelligence Engine
 * 
 * Connects goals, patterns, and context to generate intelligent nudges:
 * - Goal-driven check-ins ("You wanted to finish X by today")
 * - Pattern recognition ("You usually work on Y around this time")
 * - Calendar awareness ("Clear block until 3pm - good time for deep work?")
 * - Anomaly detection ("No activity on your main goal in 3 days")
 * 
 * Designed to be gentle, high-signal, and configurable.
 */

import { warmGet, warmSet } from "@cairn/memory";
import { now } from "@cairn/shared";
import type { ProactiveConfig } from "@cairn/shared";
export type { ProactiveConfig };
import { getActiveGoals, getGoalsDueForCheck } from "./db/goalDb.js";
import type { Goal } from "./types/goal.js";

// Calendar provider is optional - gracefully degrade if not available
let calendarProvider: { name: string; getNextEvent: () => Promise<{ start: string; title: string } | null> } | null = null;

export function setCalendarProviderForProactive(provider: typeof calendarProvider): void {
    calendarProvider = provider;
}

// ---- Types ----

export interface ProactiveContext {
    currentTime: Date;
    dayOfWeek: string;
    timeOfDay: "morning" | "afternoon" | "evening" | "night";
    hoursUntilNextEvent: number | null;
    activeGoals: Goal[];
    goalsDue: Goal[];
    recentActivity: ActivityEntry[];
    patterns: UserPattern[];
}

export interface ActivityEntry {
    timestamp: string;
    type: "task" | "message" | "goal_progress" | "break";
    description: string;
}

export interface UserPattern {
    id: string;
    type: "work_time" | "break_pattern" | "project_focus" | "productivity_peak";
    description: string;
    confidence: number;
    lastObserved: string;
}

export interface NudgeDecision {
    shouldNudge: boolean;
    nudgeType: "goal_reminder" | "pattern_suggestion" | "calendar_aware" | "anomaly_alert" | "encouragement";
    message: string;
    priority: "low" | "medium" | "high";
    relatedGoalId?: string;
    confidence: number;
}

// ---- Pattern Detection ----

const PATTERN_KEYS = {
    work_hours: "pattern_work_hours",
    productivity_peaks: "pattern_productivity_peaks",
    break_intervals: "pattern_break_intervals",
    project_switches: "pattern_project_switches",
} as const;

export function recordActivity(activity: ActivityEntry): void {
    const activities = warmGet<ActivityEntry[]>("recent_activities") ?? [];

    // Keep last 100 activities
    activities.unshift(activity);
    if (activities.length > 100) {
        activities.pop();
    }

    warmSet("recent_activities", activities);
}

export function detectPatterns(): UserPattern[] {
    const activities = warmGet<ActivityEntry[]>("recent_activities") ?? [];
    const patterns: UserPattern[] = [];

    if (activities.length < 10) {
        return patterns; // Not enough data
    }

    // Detect work hour patterns
    const taskActivities = activities.filter((a: ActivityEntry) => a.type === "task");
    const hourCounts: Record<number, number> = {};

    for (const activity of taskActivities) {
        const hour = new Date(activity.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    // Find peak hours
    const peakHour = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])[0];

    if (peakHour && parseInt(peakHour[0]) >= 0) {
        const hour = parseInt(peakHour[0]);
        const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

        patterns.push({
            id: "peak_productivity",
            type: "productivity_peak",
            description: `You tend to be most productive in the ${period} (around ${hour > 12 ? hour - 12 : hour}${hour >= 12 ? "pm" : "am"})`,
            confidence: Math.min(peakHour[1] / taskActivities.length, 0.9),
            lastObserved: now(),
        });
    }

    // Store detected patterns
    warmSet("detected_patterns", patterns);

    return patterns;
}

// ---- Goal-Driven Nudges ----

export async function checkGoalNudges(): Promise<NudgeDecision | null> {
    const goalsDue = getGoalsDueForCheck();

    if (goalsDue.length === 0) {
        return null;
    }

    // Prioritize by urgency
    const mostUrgent = goalsDue[0];

    // Check if we've already nudged about this goal recently
    const config = getProactiveConfig();
    const lastNudge = warmGet<Record<string, string>>("goal_nudge_times") ?? {};
    const lastNudgeTime = lastNudge[mostUrgent.id];

    if (lastNudgeTime) {
        const hoursSinceNudge = (Date.now() - new Date(lastNudgeTime).getTime()) / (1000 * 60 * 60);
        if (hoursSinceNudge < config.minHoursBetweenNudges) {
            return null; // Don't nag
        }
    }

    // Record nudge time
    lastNudge[mostUrgent.id] = now();
    await warmSet("goal_nudge_times", lastNudge);

    const daysUntilCheck = mostUrgent.next_review
        ? Math.ceil((new Date(mostUrgent.next_review).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

    let message: string;
    let priority: "low" | "medium" | "high";

    if (daysUntilCheck !== null && daysUntilCheck <= 1) {
        message = `⏰ "${mostUrgent.title}" is due for a check ${daysUntilCheck === 0 ? "today" : "tomorrow"}. What's the smallest step you could take right now?`;
        priority = "high";
    } else if (daysUntilCheck !== null && daysUntilCheck <= 3) {
        message = `Your goal "${mostUrgent.title}" needs attention soon. Making progress?`;
        priority = "medium";
    } else {
        message = `Quick check: how's "${mostUrgent.title}" going?`;
        priority = "low";
    }

    return {
        shouldNudge: true,
        nudgeType: "goal_reminder",
        message,
        priority,
        relatedGoalId: mostUrgent.id,
        confidence: 0.8,
    };
}

// ---- Calendar-Aware Suggestions ----

export async function checkCalendarNudges(): Promise<NudgeDecision | null> {
    try {
        if (!calendarProvider) {
            return null; // No calendar configured
        }

        if (calendarProvider.name === "mock") {
            return null; // No real calendar
        }

        const nextEvent = await calendarProvider.getNextEvent();

        if (!nextEvent) {
            // No upcoming events - good for deep work
            const patterns = warmGet<UserPattern[]>("detected_patterns") ?? [];
            const peakPattern = patterns.find((p: UserPattern) => p.type === "productivity_peak");

            const hour = new Date().getHours();
            const isAfternoon = hour >= 12 && hour < 17;

            // Only suggest if it's peak time and no meetings
            if (peakPattern && peakPattern.description.includes("afternoon") && isAfternoon) {
                const activeGoals = getActiveGoals();
                const mainGoal = activeGoals[0];

                if (mainGoal) {
                    return {
                        shouldNudge: true,
                        nudgeType: "calendar_aware",
                        message: `Clear calendar this afternoon — good time for deep work on "${mainGoal.title}"?`,
                        priority: "low",
                        relatedGoalId: mainGoal.id,
                        confidence: 0.6,
                    };
                }
            }

            return null;
        }

        const minutesUntilEvent = Math.round((new Date(nextEvent.start).getTime() - Date.now()) / (60 * 1000));

        // If event is 30-60 minutes away, maybe wrap up current work
        if (minutesUntilEvent >= 30 && minutesUntilEvent <= 60) {
            return {
                shouldNudge: true,
                nudgeType: "calendar_aware",
                message: `Heads up: "${nextEvent.title}" in ${minutesUntilEvent} minutes. Good stopping point?`,
                priority: "low",
                confidence: 0.5,
            };
        }

        return null;
    } catch {
        return null;
    }
}

// ---- Anomaly Detection ----

export function checkAnomalies(): NudgeDecision | null {
    const activities = warmGet<ActivityEntry[]>("recent_activities") ?? [];
    const activeGoals = getActiveGoals();

    if (activities.length < 20 || activeGoals.length === 0) {
        return null;
    }

    // Check for goals with no recent activity
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    const recentGoalActivity = activities
        .filter((a: ActivityEntry) => a.type === "goal_progress" && new Date(a.timestamp).getTime() > threeDaysAgo);

    const goalsWithActivity = new Set(recentGoalActivity.map((a: ActivityEntry) => a.description.split(":")[0]));

    // Find goals without recent activity
    for (const goal of activeGoals) {
        if (!goalsWithActivity.has(goal.id) && !goalsWithActivity.has(goal.title)) {
            // Check if we already alerted about this
            const alertedGoals = warmGet<Record<string, string>>("anomaly_alerts") ?? {};
            const lastAlert = alertedGoals[goal.id];

            if (lastAlert) {
                const daysSinceAlert = (Date.now() - new Date(lastAlert).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSinceAlert < 3) continue; // Don't repeat alert
            }

            alertedGoals[goal.id] = now();
            warmSet("anomaly_alerts", alertedGoals);

            return {
                shouldNudge: true,
                nudgeType: "anomaly_alert",
                message: `I noticed "${goal.title}" hasn't had activity in a few days. Still a priority, or should we revisit?`,
                priority: "medium",
                relatedGoalId: goal.id,
                confidence: 0.7,
            };
        }
    }

    return null;
}

// ---- Main Engine ----

export async function runProactiveEngine(): Promise<NudgeDecision | null> {
    // Check in priority order, return first nudge

    // 1. Goal reminders (highest priority)
    const goalNudge = await checkGoalNudges();
    if (goalNudge) return goalNudge;

    // 2. Anomaly detection
    const anomalyNudge = checkAnomalies();
    if (anomalyNudge) return anomalyNudge;

    // 3. Calendar-aware suggestions
    const calendarNudge = await checkCalendarNudges();
    if (calendarNudge) return calendarNudge;

    // 4. Pattern-based suggestions (run detection)
    detectPatterns();

    return null;
}

const DEFAULT_CONFIG: ProactiveConfig = {
    enabled: true,
    maxDailyNudges: 5,
    quietHoursStart: 22,
    quietHoursEnd: 8,
    minHoursBetweenNudges: 2,
    nudgeTypes: {
        goal_reminder: true,
        calendar_aware: true,
        anomaly_alert: true,
        pattern_suggestion: true,
    },
    checkInsEnabled: true,
    briefingEnabled: true,
    briefingWindowStart: 7,
    briefingWindowEnd: 9,
    librarianEnabled: true,
    librarianHour: 17,
};

export function getProactiveConfig(): ProactiveConfig {
    const stored = warmGet<Partial<ProactiveConfig>>("proactive_config");
    return { ...DEFAULT_CONFIG, ...stored };
}

export function setProactiveConfig(config: Partial<ProactiveConfig>): void {
    const current = getProactiveConfig();
    warmSet("proactive_config", { ...current, ...config });
}

export function shouldNudgeNow(config: ProactiveConfig): boolean {
    if (!config.enabled) return false;

    const hour = new Date().getHours();

    // Check quiet hours
    if (config.quietHoursStart > config.quietHoursEnd) {
        // Wraps around midnight (e.g., 22-8)
        if (hour >= config.quietHoursStart || hour < config.quietHoursEnd) {
            return false;
        }
    } else {
        if (hour >= config.quietHoursStart && hour < config.quietHoursEnd) {
            return false;
        }
    }

    // Check daily limit
    const nudgeState = warmGet<{ date: string; count: number }>("nudge_daily_state");
    const today = new Date().toISOString().split("T")[0];

    if (nudgeState?.date === today && nudgeState.count >= config.maxDailyNudges) {
        return false;
    }

    return true;
}

export function recordNudgeSent(): void {
    const today = new Date().toISOString().split("T")[0];
    const state = warmGet<{ date: string; count: number }>("nudge_daily_state");

    if (state?.date === today) {
        warmSet("nudge_daily_state", { date: today, count: state.count + 1 });
    } else {
        warmSet("nudge_daily_state", { date: today, count: 1 });
    }
}
