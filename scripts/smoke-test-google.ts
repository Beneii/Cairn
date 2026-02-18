
/**
 * Smoke test for Google Integrations (Gmail/Calendar)
 * Run with: npx tsx scripts/smoke-test-google.ts
 */

import {
    getUnreadCount,
    getRecentEmails,
    getUpcomingEvents,
    isGoogleAuthenticated
} from "@cairn/integrations";

async function run() {
    console.log("🔥 Running Google Integration Smoke Test...");

    if (!isGoogleAuthenticated()) {
        console.error("❌ Google not authenticated (missing credentials or tokens).");
        console.error("   Please configure GOOGLE_CLIENT_ID/SECRET and ensure tokens are present.");
        process.exit(1);
    }

    try {
        console.log("\n📧 Testing Gmail...");
        const unread = await getUnreadCount();
        console.log(`   ✅ Unread count: ${unread}`);

        const emails = await getRecentEmails(5);
        console.log(`   ✅ Fetched ${emails.length} recent emails.`);
        emails.forEach(e => console.log(`      - [${e.date}] ${e.subject} (${e.from})`));

    } catch (err: any) {
        console.error("❌ Gmail test failed:", err.message);
    }

    try {
        console.log("\n📅 Testing Calendar...");
        const events = await getUpcomingEvents(7);
        console.log(`   ✅ Fetched ${events.length} upcoming events.`);
        events.forEach(e => console.log(`      - [${e.start}] ${e.summary}`));

    } catch (err: any) {
        console.error("❌ Calendar test failed:", err.message);
    }

    console.log("\n✨ Done.");
}

run().catch(err => {
    console.error("❌ Script failed:", err);
    process.exit(1);
});
