/**
 * Goal Heartbeat
 *
 * The central loop that checks goals, runs scheduled tasks, and manages interruptions.
 */
export interface HeartbeatResult {
    goalsChecked: number;
    actionsTriggered: string[];
    interruptionsSent: number;
    errors: string[];
}
export interface HeartbeatConfig {
    maxActionsPerBeat: number;
    respectInterruptionBudget: boolean;
    dryRun: boolean;
}
/**
 * Main heartbeat function - call this on a schedule (e.g., every 5 minutes)
 */
export declare function runHeartbeat(config?: Partial<HeartbeatConfig>): Promise<HeartbeatResult>;
export interface NextAction {
    action: "create_tasks" | "review_tasks" | "reassess" | "check_milestone" | "check_status";
    description: string;
    requiresApproval: boolean;
}
/**
 * Reset daily counters - call at midnight
 */
export declare function resetDailyCounters(): void;
/**
 * Manually trigger a goal check (bypasses schedule)
 */
export declare function triggerGoalCheck(goalId: string): Promise<HeartbeatResult>;
//# sourceMappingURL=heartbeat.d.ts.map