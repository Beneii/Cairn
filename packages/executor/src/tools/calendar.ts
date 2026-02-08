/**
 * Calendar Tools
 * 
 * Calendar access via provider interface.
 * Starts with MockCalendarProvider, GoogleCalendarProvider later.
 */

import { z } from "zod";
import { registerTool, type ToolManifest } from "../manifest.js";
import {
    isGoogleAuthenticated,
    getEventsBetween as googleGetEventsBetween,
    getNextEvent as googleGetNextEvent,
    type CalendarEvent as GoogleCalEvent,
} from "@cairn/integrations";

// ---- Provider Interface ----

export interface CalendarEvent {
    id: string;
    title: string;
    start: string;      // ISO
    end: string;        // ISO
    location?: string;
    description?: string;
    allDay: boolean;
}

export interface CalendarProvider {
    name: string;
    listEvents(from: Date, to: Date): Promise<CalendarEvent[]>;
    getNextEvent(): Promise<CalendarEvent | null>;
    findFreeBlocks(from: Date, to: Date, minMinutes: number): Promise<Array<{ start: string; end: string }>>;
}

// ---- Mock Provider ----

class MockCalendarProvider implements CalendarProvider {
    name = "mock";

    private mockEvents: CalendarEvent[] = [
        {
            id: "mock-1",
            title: "Morning standup",
            start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            end: new Date(Date.now() + 2.5 * 60 * 60 * 1000).toISOString(),
            allDay: false,
        },
        {
            id: "mock-2",
            title: "Lunch with Alex",
            start: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
            end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
            location: "Cafe Nero",
            allDay: false,
        },
        {
            id: "mock-3",
            title: "Deep work block",
            start: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString(),
            end: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
            allDay: false,
        },
    ];

    async listEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
        return this.mockEvents.filter(e => {
            const start = new Date(e.start);
            return start >= from && start <= to;
        });
    }

    async getNextEvent(): Promise<CalendarEvent | null> {
        const now = new Date();
        const upcoming = this.mockEvents.filter(e => new Date(e.start) > now);
        return upcoming[0] ?? null;
    }

    async findFreeBlocks(from: Date, to: Date, minMinutes: number): Promise<Array<{ start: string; end: string }>> {
        const events = await this.listEvents(from, to);
        const blocks: Array<{ start: string; end: string }> = [];

        let cursor = from;
        for (const event of events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())) {
            const eventStart = new Date(event.start);
            const gapMinutes = (eventStart.getTime() - cursor.getTime()) / (60 * 1000);
            if (gapMinutes >= minMinutes) {
                blocks.push({ start: cursor.toISOString(), end: eventStart.toISOString() });
            }
            cursor = new Date(event.end);
        }

        // Gap after last event
        const finalGap = (to.getTime() - cursor.getTime()) / (60 * 1000);
        if (finalGap >= minMinutes) {
            blocks.push({ start: cursor.toISOString(), end: to.toISOString() });
        }

        return blocks;
    }
}

// ---- Google Calendar Provider ----

class GoogleCalendarProvider implements CalendarProvider {
    name = "google";

    private mapEvent(e: GoogleCalEvent): CalendarEvent {
        return {
            id: e.id,
            title: e.summary,
            start: e.start,
            end: e.end,
            location: e.location,
            description: e.description,
            allDay: e.isAllDay,
        };
    }

    async listEvents(from: Date, to: Date): Promise<CalendarEvent[]> {
        const events = await googleGetEventsBetween(from, to);
        return events.map(e => this.mapEvent(e));
    }

    async getNextEvent(): Promise<CalendarEvent | null> {
        const event = await googleGetNextEvent();
        return event ? this.mapEvent(event) : null;
    }

    async findFreeBlocks(from: Date, to: Date, minMinutes: number): Promise<Array<{ start: string; end: string }>> {
        const events = await this.listEvents(from, to);
        const blocks: Array<{ start: string; end: string }> = [];

        let cursor = from;
        for (const event of events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())) {
            if (event.allDay) continue; // Skip all-day events for free block calculation
            const eventStart = new Date(event.start);
            const gapMinutes = (eventStart.getTime() - cursor.getTime()) / (60 * 1000);
            if (gapMinutes >= minMinutes) {
                blocks.push({ start: cursor.toISOString(), end: eventStart.toISOString() });
            }
            const eventEnd = new Date(event.end);
            if (eventEnd > cursor) cursor = eventEnd;
        }

        const finalGap = (to.getTime() - cursor.getTime()) / (60 * 1000);
        if (finalGap >= minMinutes) {
            blocks.push({ start: cursor.toISOString(), end: to.toISOString() });
        }

        return blocks;
    }
}

// ---- Active Provider ----

let activeProvider: CalendarProvider = new MockCalendarProvider();

export function setCalendarProvider(provider: CalendarProvider): void {
    activeProvider = provider;
    console.log(`[calendar] Provider set to: ${provider.name}`);
}

export function getCalendarProvider(): CalendarProvider {
    return activeProvider;
}

/**
 * Auto-detect and initialize the right calendar provider.
 * Call on startup — uses Google if authenticated, otherwise mock.
 */
export function initCalendarProvider(): void {
    if (isGoogleAuthenticated()) {
        setCalendarProvider(new GoogleCalendarProvider());
    } else {
        console.log("[calendar] Google not authenticated, using mock provider");
        setCalendarProvider(new MockCalendarProvider());
    }
}

// ---- Tool: calendar.list_events ----

const listEventsInput = z.object({
    days: z.number().min(1).max(30).default(7),
});

const listEventsOutput = z.object({
    events: z.array(z.object({
        id: z.string(),
        title: z.string(),
        start: z.string(),
        end: z.string(),
        location: z.string().optional(),
        allDay: z.boolean(),
    })),
    count: z.number(),
});

export const calendarListEvents: ToolManifest<
    z.infer<typeof listEventsInput>,
    z.infer<typeof listEventsOutput>
> = {
    name: "calendar.list_events",
    description: "List calendar events for the next N days",
    category: "calendar",
    inputSchema: listEventsInput,
    outputSchema: listEventsOutput,
    costHint: "cheap",
    cacheable: true,
    cacheTTLSeconds: 300, // 5 minutes
    safetyTier: "auto",
    sideEffects: ["reads:calendar"],

    handler: async (input) => {
        const from = new Date();
        const to = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);
        const events = await activeProvider.listEvents(from, to);

        return {
            ok: true,
            data: {
                events: events.map(e => ({
                    id: e.id,
                    title: e.title,
                    start: e.start,
                    end: e.end,
                    location: e.location,
                    allDay: e.allDay,
                })),
                count: events.length,
            },
        };
    },
};

// ---- Tool: calendar.next_event ----

const nextEventInput = z.object({});

const nextEventOutput = z.object({
    event: z.object({
        id: z.string(),
        title: z.string(),
        start: z.string(),
        end: z.string(),
        location: z.string().optional(),
        minutesUntil: z.number(),
    }).nullable(),
});

export const calendarNextEvent: ToolManifest<
    z.infer<typeof nextEventInput>,
    z.infer<typeof nextEventOutput>
> = {
    name: "calendar.next_event",
    description: "Get the next upcoming calendar event",
    category: "calendar",
    inputSchema: nextEventInput,
    outputSchema: nextEventOutput,
    costHint: "trivial",
    cacheable: true,
    cacheTTLSeconds: 60,
    safetyTier: "auto",
    sideEffects: ["reads:calendar"],

    handler: async () => {
        const event = await activeProvider.getNextEvent();

        if (!event) {
            return { ok: true, data: { event: null } };
        }

        const minutesUntil = Math.round((new Date(event.start).getTime() - Date.now()) / (60 * 1000));

        return {
            ok: true,
            data: {
                event: {
                    id: event.id,
                    title: event.title,
                    start: event.start,
                    end: event.end,
                    location: event.location,
                    minutesUntil,
                },
            },
        };
    },
};

// ---- Tool: calendar.free_blocks ----

const freeBlocksInput = z.object({
    days: z.number().min(1).max(14).default(7),
    minMinutes: z.number().min(15).max(480).default(30),
});

const freeBlocksOutput = z.object({
    blocks: z.array(z.object({
        start: z.string(),
        end: z.string(),
        durationMinutes: z.number(),
    })),
    totalFreeMinutes: z.number(),
});

export const calendarFreeBlocks: ToolManifest<
    z.infer<typeof freeBlocksInput>,
    z.infer<typeof freeBlocksOutput>
> = {
    name: "calendar.free_blocks",
    description: "Find free time blocks in calendar",
    category: "calendar",
    inputSchema: freeBlocksInput,
    outputSchema: freeBlocksOutput,
    costHint: "cheap",
    cacheable: true,
    cacheTTLSeconds: 300,
    safetyTier: "auto",
    sideEffects: ["reads:calendar"],

    handler: async (input) => {
        const from = new Date();
        const to = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);
        const blocks = await activeProvider.findFreeBlocks(from, to, input.minMinutes);

        const formattedBlocks = blocks.map(b => ({
            start: b.start,
            end: b.end,
            durationMinutes: Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / (60 * 1000)),
        }));

        const totalFreeMinutes = formattedBlocks.reduce((sum, b) => sum + b.durationMinutes, 0);

        return {
            ok: true,
            data: { blocks: formattedBlocks, totalFreeMinutes },
        };
    },
};

// ---- Tool: calendar.find_optimal_slot ----

const findOptimalSlotInput = z.object({
    duration: z.number().min(15).max(480).describe("Duration in minutes"),
    preferredTimeOfDay: z.enum(["morning", "afternoon", "evening"]).optional(),
    withinDays: z.number().min(1).max(14).default(3),
});

const findOptimalSlotOutput = z.object({
    slots: z.array(z.object({
        start: z.string(),
        end: z.string(),
        score: z.number(),
        reason: z.string(),
    })),
});

export const calendarFindOptimalSlot: ToolManifest<
    z.infer<typeof findOptimalSlotInput>,
    z.infer<typeof findOptimalSlotOutput>
> = {
    name: "calendar.find_optimal_slot",
    description: "Find optimal time slots for a task or meeting based on calendar availability and preferences",
    category: "calendar",
    inputSchema: findOptimalSlotInput,
    outputSchema: findOptimalSlotOutput,
    costHint: "cheap",
    cacheable: true,
    cacheTTLSeconds: 300,
    safetyTier: "auto",
    sideEffects: ["reads:calendar"],

    handler: async (input) => {
        const from = new Date();
        const to = new Date(Date.now() + input.withinDays * 24 * 60 * 60 * 1000);
        const blocks = await activeProvider.findFreeBlocks(from, to, input.duration);

        // Score each block
        const scored = blocks.map(b => {
            const start = new Date(b.start);
            const end = new Date(b.end);
            const blockMinutes = (end.getTime() - start.getTime()) / (60 * 1000);
            const hour = start.getHours();
            let score = 0.5;
            const reasons: string[] = [];

            // Time-of-day preference
            if (input.preferredTimeOfDay) {
                const inMorning = hour >= 8 && hour < 12;
                const inAfternoon = hour >= 12 && hour < 17;
                const inEvening = hour >= 17 && hour < 21;

                if ((input.preferredTimeOfDay === "morning" && inMorning) ||
                    (input.preferredTimeOfDay === "afternoon" && inAfternoon) ||
                    (input.preferredTimeOfDay === "evening" && inEvening)) {
                    score += 0.25;
                    reasons.push(`Matches preferred ${input.preferredTimeOfDay} time`);
                } else {
                    reasons.push(`Outside preferred ${input.preferredTimeOfDay} window`);
                }
            }

            // Prefer blocks with buffer (larger blocks = less fragmentation)
            const bufferRatio = blockMinutes / input.duration;
            if (bufferRatio >= 2) {
                score += 0.15;
                reasons.push("Plenty of buffer time");
            } else if (bufferRatio >= 1.5) {
                score += 0.1;
                reasons.push("Good buffer");
            } else {
                reasons.push("Tight fit");
            }

            // Penalize very early or very late
            if (hour < 8 || hour >= 21) {
                score -= 0.2;
                reasons.push("Outside work hours");
            }

            // Prefer sooner (slight bias)
            const daysOut = (start.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
            if (daysOut < 1) {
                score += 0.1;
                reasons.push("Today");
            } else if (daysOut < 2) {
                score += 0.05;
                reasons.push("Tomorrow");
            }

            return {
                start: b.start,
                end: new Date(start.getTime() + input.duration * 60 * 1000).toISOString(),
                score: Math.max(0, Math.min(1, Math.round(score * 100) / 100)),
                reason: reasons.join("; "),
            };
        });

        // Return top 3 by score
        scored.sort((a, b) => b.score - a.score);

        return {
            ok: true,
            data: { slots: scored.slice(0, 3) },
        };
    },
};

// ---- Register all ----

export function registerCalendarTools(): void {
    registerTool(calendarListEvents);
    registerTool(calendarNextEvent);
    registerTool(calendarFreeBlocks);
    registerTool(calendarFindOptimalSlot);
}
