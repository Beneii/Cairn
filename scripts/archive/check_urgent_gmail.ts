
import { google } from "googleapis";
import { getGoogleOAuth, isGoogleAuthenticated } from "../packages/integrations/src/google/oauth.js";

async function checkUrgentEmails() {
    if (!isGoogleAuthenticated()) {
        console.log("HEARTBEAT_OK (Google not authenticated)");
        return;
    }

    const auth = getGoogleOAuth()!;
    const gmail = google.gmail({ version: "v1", auth });

    // Calculate one hour ago in ISO format for the query or use unix timestamp
    // Gmail after: query uses unix seconds
    const oneHourAgo = Math.floor((Date.now() - 60 * 60 * 1000) / 1000);
    const query = `in:inbox after:${oneHourAgo}`;

    try {
        const listResponse = await gmail.users.messages.list({
            userId: "me",
            q: query,
        });

        const messages = listResponse.data.messages || [];
        if (messages.length === 0) {
            console.log("HEARTBEAT_OK");
            return;
        }

        const urgentEmails = [];

        for (const msg of messages) {
            const detail = await gmail.users.messages.get({
                userId: "me",
                id: msg.id!,
                format: "metadata",
                metadataHeaders: ["From", "Subject", "Date"],
            });

            const headers = detail.data.payload?.headers || [];
            const subject = headers.find(h => h.name === "Subject")?.value || "";
            const from = headers.find(h => h.name === "From")?.value || "";
            const snippet = detail.data.snippet || "";

            // Simple heuristic for urgency
            const isUrgent = /urgent|immediate|important|action required|critical/i.test(subject) ||
                             /urgent|immediate|important|action required|critical/i.test(snippet);

            if (isUrgent) {
                urgentEmails.push({ from, subject, snippet });
            }
        }

        if (urgentEmails.length === 0) {
            console.log("HEARTBEAT_OK");
        } else {
            console.log("Urgent Emails found:");
            urgentEmails.forEach(email => {
                console.log(`- From: ${email.from}\n  Subject: ${email.subject}\n  Snippet: ${email.snippet}\n`);
            });
        }
    } catch (err) {
        console.error("Error checking emails:", err);
        console.log("HEARTBEAT_OK");
    }
}

checkUrgentEmails();
