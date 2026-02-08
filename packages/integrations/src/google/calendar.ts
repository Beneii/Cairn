/**
 * Google Calendar Integration
 * 
 * Read-only access to calendar for schedule awareness.
 */

import { google } from "googleapis";
import { getGoogleOAuth, isGoogleAuthenticated } from "./oauth.js";

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
export async function getTodayEvents(): Promise<CalendarEvent[]> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return getEventsBetween(startOfDay, endOfDay);
}

/**
 * Get upcoming events (next N days)
 */
export async function getUpcomingEvents(days: number = 7): Promise<CalendarEvent[]> {
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    return getEventsBetween(now, endDate);
}

/**
 * Get events between two dates
 */
export async function getEventsBetween(start: Date, end: Date): Promise<CalendarEvent[]> {
    if (!isGoogleAuthenticated()) {
        throw new Error("Google not authenticated");
    }

    const auth = getGoogleOAuth()!;
    const calendar = google.calendar({ version: "v3", auth });

    try {
        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 50,
        });

        const events = response.data.items || [];

        return events.map(event => ({
            id: event.id || "",
            summary: event.summary || "(no title)",
            description: event.description ?? undefined,
            start: event.start?.dateTime || event.start?.date || "",
            end: event.end?.dateTime || event.end?.date || "",
            location: event.location ?? undefined,
            isAllDay: !!event.start?.date, // All-day events have date, not dateTime
        }));
    } catch (err) {
        console.error("[calendar] Error fetching events:", err);
        throw err;
    }
}

/**
 * Get next event
 */
export async function getNextEvent(): Promise<CalendarEvent | null> {
    if (!isGoogleAuthenticated()) {
        return null;
    }

    const auth = getGoogleOAuth()!;
    const calendar = google.calendar({ version: "v3", auth });

    try {
        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: new Date().toISOString(),
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 1,
        });

        const event = response.data.items?.[0];
        if (!event) return null;

        return {
            id: event.id || "",
            summary: event.summary || "(no title)",
            description: event.description ?? undefined,
            start: event.start?.dateTime || event.start?.date || "",
            end: event.end?.dateTime || event.end?.date || "",
            location: event.location ?? undefined,
            isAllDay: !!event.start?.date,
        };
    } catch (err) {
        console.error("[calendar] Error fetching next event:", err);
        return null;
    }
}

/**
 * Format event time for display
 */
export function formatEventTime(event: CalendarEvent): string {
    if (event.isAllDay) {
        return "All day";
    }

    const start = new Date(event.start);
    const end = new Date(event.end);

    const timeFormat: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    };

    return `${start.toLocaleTimeString("en-US", timeFormat)} - ${end.toLocaleTimeString("en-US", timeFormat)}`;
}
