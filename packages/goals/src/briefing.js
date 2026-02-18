/**
 * Daily Briefing Agent
 *
 * Generates a daily summary based on calendar, goals, and accumulated context.
 */
import * as db from "./db/index.js";
let calendarSource = null;
/** Set the calendar source for briefings. Call from gateway startup. */
export function setBriefingCalendarSource(source) {
    calendarSource = source;
    console.log("[briefing] Calendar source connected");
}
async function getTodaysCalendar() {
    if (!calendarSource) {
        return []; // No calendar connected — briefing will note low confidence
    }
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    const events = await calendarSource.listEvents(startOfDay, endOfDay);
    // Add minutesUntil for each event
    return events.map(e => ({
        ...e,
        minutesUntil: Math.round((new Date(e.start).getTime() - now.getTime()) / (60 * 1000)),
    }));
}
// ---- Briefing Generation ----
export async function generateDailyBriefing() {
    const now = new Date();
    const hour = now.getHours();
    // Get data
    const [calendar, activeGoals] = await Promise.all([
        getTodaysCalendar(),
        db.getActiveGoals(),
    ]);
    const blockedGoals = db.getGoals().filter(g => g.status === "blocked");
    // Calculate calendar metrics
    const busyMinutes = calendar.reduce((sum, e) => {
        const start = new Date(e.start).getTime();
        const end = new Date(e.end).getTime();
        return sum + (end - start) / (60 * 1000);
    }, 0);
    // Identify goals needing attention
    const needsAttention = blockedGoals.map(g => ({
        id: g.id,
        title: g.title,
        domain: "general",
        status: g.status,
        reason: g.blocked_reason,
    }));
    // Add goals with low confidence that might need revisiting
    for (const goal of activeGoals) {
        if (goal.confidence < 0.3) {
            needsAttention.push({
                id: goal.id,
                title: goal.title,
                domain: "general",
                status: "low_confidence",
                reason: "Goal confidence is low — worth revisiting definition",
            });
        }
    }
    // Generate recommendations
    const recommendations = [];
    const warnings = [];
    // Calendar-based recommendations
    if (calendar.length === 0) {
        recommendations.push("No events today. Good day for deep work.");
    }
    else if (busyMinutes > 6 * 60) {
        warnings.push("Heavy calendar day (6+ hours of meetings). Consider protecting focus time.");
    }
    // Goal-based recommendations
    if (blockedGoals.length > 0) {
        recommendations.push(`${blockedGoals.length} goal(s) blocked. Review constraints.`);
    }
    // Get accurate free block count if provider supports it
    let freeBlockCount;
    if (calendarSource?.findFreeBlocks) {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        const freeBlocks = await calendarSource.findFreeBlocks(now > startOfDay ? now : startOfDay, endOfDay, 30);
        freeBlockCount = freeBlocks.length;
    }
    else {
        freeBlockCount = Math.max(0, 8 - Math.ceil(busyMinutes / 60));
    }
    // Calculate confidence
    let confidence = 0.7; // Base confidence
    if (!calendarSource)
        confidence -= 0.2; // Much less confident without real calendar
    else if (calendar.length === 0)
        confidence -= 0.1;
    if (activeGoals.length === 0)
        confidence -= 0.1;
    return {
        generatedAt: now.toISOString(),
        greeting: generateGreeting(hour),
        calendar: {
            eventCount: calendar.length,
            nextEvent: calendar[0],
            busyHours: Math.round(busyMinutes / 60 * 10) / 10,
            freeBlocks: freeBlockCount,
        },
        goals: {
            activeCount: activeGoals.length,
            blockedCount: blockedGoals.length,
            needsAttention,
        },
        recommendations,
        warnings,
        confidence: Math.max(0.3, Math.min(1, confidence)),
    };
}
function generateGreeting(hour) {
    if (hour < 6)
        return "Early start.";
    if (hour < 12)
        return "Good morning.";
    if (hour < 17)
        return "Good afternoon.";
    if (hour < 21)
        return "Good evening.";
    return "Late night.";
}
// ---- Briefing Formatting ----
export function formatBriefingAsText(briefing) {
    const lines = [];
    lines.push(`**${briefing.greeting}**`);
    lines.push("");
    // Calendar
    if (briefing.calendar.nextEvent) {
        const mins = briefing.calendar.nextEvent.minutesUntil;
        const time = mins ? `in ${mins} minutes` : "soon";
        lines.push(`📅 Next: ${briefing.calendar.nextEvent.title} ${time}`);
    }
    lines.push(`   ${briefing.calendar.eventCount} events today, ~${briefing.calendar.busyHours}h booked`);
    lines.push("");
    // Goals
    if (briefing.goals.activeCount > 0) {
        lines.push(`🎯 ${briefing.goals.activeCount} active goal(s)`);
    }
    if (briefing.goals.blockedCount > 0) {
        lines.push(`⚠️ ${briefing.goals.blockedCount} blocked`);
    }
    // Needs attention
    if (briefing.goals.needsAttention.length > 0) {
        lines.push("");
        lines.push("**Needs attention:**");
        for (const goal of briefing.goals.needsAttention.slice(0, 3)) {
            lines.push(`• ${goal.title}: ${goal.reason || goal.status}`);
        }
    }
    // Warnings
    if (briefing.warnings.length > 0) {
        lines.push("");
        for (const warn of briefing.warnings) {
            lines.push(`⚠️ ${warn}`);
        }
    }
    // Recommendations  
    if (briefing.recommendations.length > 0) {
        lines.push("");
        lines.push("**Suggestions:**");
        for (const rec of briefing.recommendations.slice(0, 3)) {
            lines.push(`• ${rec}`);
        }
    }
    // Confidence indicator
    if (briefing.confidence < 0.5) {
        lines.push("");
        lines.push(`_(Low confidence briefing - limited data available)_`);
    }
    return lines.join("\n");
}
// ---- Briefing Decision Logic ----
/**
 * Should we send this briefing?
 * Respects silence/interruption preferences.
 */
export function shouldSendBriefing(briefing, userPrefs) {
    // Check interruption budget
    if (userPrefs.interruptionsToday >= userPrefs.maxInterruptions) {
        return { send: false, reason: "Interruption budget exhausted" };
    }
    // Check confidence threshold
    if (briefing.confidence < userPrefs.minConfidenceToInterrupt) {
        return { send: false, reason: `Confidence ${briefing.confidence.toFixed(2)} below threshold ${userPrefs.minConfidenceToInterrupt}` };
    }
    // Check if there's anything worth saying
    const hasContent = briefing.warnings.length > 0 ||
        briefing.goals.needsAttention.length > 0 ||
        briefing.calendar.nextEvent !== undefined;
    if (!hasContent) {
        return { send: false, reason: "Nothing notable to report" };
    }
    return { send: true, reason: "Briefing has relevant content" };
}
//# sourceMappingURL=briefing.js.map