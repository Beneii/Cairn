/**
 * Google Calendar Integration
 *
 * Read-only access to calendar for schedule awareness.
 */
export interface CalendarEvent {
    id: string;
    summary: string;
    description?: string;
    start: string;
    end: string;
    location?: string;
    isAllDay: boolean;
}
/**
 * Get today's events
 */
export declare function getTodayEvents(): Promise<CalendarEvent[]>;
/**
 * Get upcoming events (next N days)
 */
export declare function getUpcomingEvents(days?: number): Promise<CalendarEvent[]>;
/**
 * Get events between two dates
 */
export declare function getEventsBetween(start: Date, end: Date): Promise<CalendarEvent[]>;
/**
 * Get next event
 */
export declare function getNextEvent(): Promise<CalendarEvent | null>;
/**
 * Format event time for display
 */
export declare function formatEventTime(event: CalendarEvent): string;
//# sourceMappingURL=calendar.d.ts.map