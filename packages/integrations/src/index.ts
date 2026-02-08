// Google integrations
export {
    initGoogleOAuth,
    getGoogleOAuth,
    isGoogleAuthenticated,
    getAuthUrl,
    exchangeCodeForTokens,
} from "./google/oauth.js";

export {
    getRecentEmails,
    getUnreadCount,
    getEmailBody,
    type EmailSummary,
} from "./google/gmail.js";

export {
    getTodayEvents,
    getUpcomingEvents,
    getEventsBetween,
    getNextEvent,
    formatEventTime,
    type CalendarEvent,
} from "./google/calendar.js";
