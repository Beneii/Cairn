/**
 * Daily Briefing Agent
 *
 * Generates a daily summary based on calendar, goals, and accumulated context.
 */
export interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    minutesUntil?: number;
    allDay?: boolean;
}
/** Minimal interface for calendar data injection (avoids circular dep on @cairn/executor) */
export interface BriefingCalendarSource {
    listEvents(from: Date, to: Date): Promise<CalendarEvent[]>;
    findFreeBlocks?(from: Date, to: Date, minMinutes: number): Promise<Array<{
        start: string;
        end: string;
    }>>;
}
/** Set the calendar source for briefings. Call from gateway startup. */
export declare function setBriefingCalendarSource(source: BriefingCalendarSource): void;
export interface DailyBriefing {
    generatedAt: string;
    greeting: string;
    calendar: {
        eventCount: number;
        nextEvent?: CalendarEvent;
        busyHours: number;
        freeBlocks: number;
    };
    goals: {
        activeCount: number;
        blockedCount: number;
        needsAttention: GoalSummary[];
    };
    recommendations: string[];
    warnings: string[];
    confidence: number;
}
interface GoalSummary {
    id: string;
    title: string;
    domain: string;
    status: string;
    reason?: string;
}
export declare function generateDailyBriefing(): Promise<DailyBriefing>;
export declare function formatBriefingAsText(briefing: DailyBriefing): string;
/**
 * Should we send this briefing?
 * Respects silence/interruption preferences.
 */
export declare function shouldSendBriefing(briefing: DailyBriefing, userPrefs: {
    interruptionsToday: number;
    maxInterruptions: number;
    minConfidenceToInterrupt: number;
}): {
    send: boolean;
    reason: string;
};
export {};
//# sourceMappingURL=briefing.d.ts.map