
import { getTodayEvents, formatEventTime } from "./packages/integrations/src/google/calendar.js";
import { getRecentEmails } from "./packages/integrations/src/google/gmail.js";
import { initGoogleOAuth } from "./packages/integrations/src/google/oauth.js";

async function run() {
    // Manually init OAuth if needed (the lib usually handles it but we are in a script)
    initGoogleOAuth();

    try {
        console.log("--- GOOGLE CALENDAR (TODAY) ---");
        const events = await getTodayEvents();
        if (events.length === 0) {
            console.log("No events today.");
        } else {
            events.forEach(e => {
                console.log(`- [${formatEventTime(e)}] ${e.summary}`);
            });
        }

        console.log("\n--- GMAIL (RECENT UNREAD) ---");
        const emails = await getRecentEmails(20);
        const unread = emails.filter(e => e.isUnread);
        if (unread.length === 0) {
            console.log("No unread emails.");
        } else {
            unread.forEach(e => {
                console.log(`- From: ${e.from}\n  Subject: ${e.subject}\n  Snippet: ${e.snippet}\n`);
            });
        }
    } catch (err) {
        console.error("Error fetching Google data:", err.message);
    }
}

run();
