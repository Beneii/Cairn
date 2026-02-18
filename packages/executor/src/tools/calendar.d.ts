/**
 * Calendar Tools
 *
 * Calendar access via provider interface.
 * Starts with MockCalendarProvider, GoogleCalendarProvider later.
 */
import { z } from "zod";
import { type ToolManifest } from "../manifest.js";
export interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end: string;
    location?: string;
    description?: string;
    allDay: boolean;
}
export interface CalendarProvider {
    name: string;
    listEvents(from: Date, to: Date): Promise<CalendarEvent[]>;
    getNextEvent(): Promise<CalendarEvent | null>;
    findFreeBlocks(from: Date, to: Date, minMinutes: number): Promise<Array<{
        start: string;
        end: string;
    }>>;
}
export declare function setCalendarProvider(provider: CalendarProvider): void;
export declare function getCalendarProvider(): CalendarProvider;
/**
 * Auto-detect and initialize the right calendar provider.
 * Call on startup — uses Google if authenticated, otherwise mock.
 */
export declare function initCalendarProvider(): void;
declare const listEventsInput: z.ZodObject<{
    days: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
declare const listEventsOutput: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        start: z.ZodString;
        end: z.ZodString;
        location: z.ZodOptional<z.ZodString>;
        allDay: z.ZodBoolean;
    }, z.core.$strip>>;
    count: z.ZodNumber;
}, z.core.$strip>;
export declare const calendarListEvents: ToolManifest<z.infer<typeof listEventsInput>, z.infer<typeof listEventsOutput>>;
declare const nextEventInput: z.ZodObject<{}, z.core.$strip>;
declare const nextEventOutput: z.ZodObject<{
    event: z.ZodNullable<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        start: z.ZodString;
        end: z.ZodString;
        location: z.ZodOptional<z.ZodString>;
        minutesUntil: z.ZodNumber;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const calendarNextEvent: ToolManifest<z.infer<typeof nextEventInput>, z.infer<typeof nextEventOutput>>;
declare const freeBlocksInput: z.ZodObject<{
    days: z.ZodDefault<z.ZodNumber>;
    minMinutes: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
declare const freeBlocksOutput: z.ZodObject<{
    blocks: z.ZodArray<z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
        durationMinutes: z.ZodNumber;
    }, z.core.$strip>>;
    totalFreeMinutes: z.ZodNumber;
}, z.core.$strip>;
export declare const calendarFreeBlocks: ToolManifest<z.infer<typeof freeBlocksInput>, z.infer<typeof freeBlocksOutput>>;
declare const findOptimalSlotInput: z.ZodObject<{
    duration: z.ZodNumber;
    preferredTimeOfDay: z.ZodOptional<z.ZodEnum<{
        morning: "morning";
        afternoon: "afternoon";
        evening: "evening";
    }>>;
    withinDays: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
declare const findOptimalSlotOutput: z.ZodObject<{
    slots: z.ZodArray<z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
        score: z.ZodNumber;
        reason: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const calendarFindOptimalSlot: ToolManifest<z.infer<typeof findOptimalSlotInput>, z.infer<typeof findOptimalSlotOutput>>;
export declare function registerCalendarTools(): void;
export {};
//# sourceMappingURL=calendar.d.ts.map