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
import type { ProactiveConfig } from "@cairn/shared";
export type { ProactiveConfig };
import type { Goal } from "./types/goal.js";
declare let calendarProvider: {
    name: string;
    getNextEvent: () => Promise<{
        start: string;
        title: string;
    } | null>;
} | null;
export declare function setCalendarProviderForProactive(provider: typeof calendarProvider): void;
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
export declare function recordActivity(activity: ActivityEntry): void;
export declare function detectPatterns(): UserPattern[];
export declare function checkGoalNudges(): Promise<NudgeDecision | null>;
export declare function checkCalendarNudges(): Promise<NudgeDecision | null>;
export declare function checkAnomalies(): NudgeDecision | null;
export declare function runProactiveEngine(): Promise<NudgeDecision | null>;
export declare function getProactiveConfig(): ProactiveConfig;
export declare function setProactiveConfig(config: Partial<ProactiveConfig>): void;
export declare function shouldNudgeNow(config: ProactiveConfig): boolean;
export declare function recordNudgeSent(): void;
//# sourceMappingURL=proactive.d.ts.map