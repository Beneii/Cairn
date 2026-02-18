/**
 * Gmail Integration
 *
 * Read-only access to Gmail for email summarization and inbox awareness.
 */
import { google } from "googleapis";
import { getGoogleOAuth, isGoogleAuthenticated } from "./oauth.js";
/**
 * Get recent emails from inbox
 */
export async function getRecentEmails(maxResults = 10) {
    if (!isGoogleAuthenticated()) {
        throw new Error("Google not authenticated");
    }
    const auth = getGoogleOAuth();
    const gmail = google.gmail({ version: "v1", auth });
    try {
        // Get list of recent messages
        const listResponse = await gmail.users.messages.list({
            userId: "me",
            maxResults,
            q: "in:inbox",
        });
        const messages = listResponse.data.messages || [];
        const emails = [];
        // Fetch details for each message
        for (const msg of messages) {
            if (!msg.id)
                continue;
            const detail = await gmail.users.messages.get({
                userId: "me",
                id: msg.id,
                format: "metadata",
                metadataHeaders: ["From", "Subject", "Date"],
            });
            const headers = detail.data.payload?.headers || [];
            const fromHeader = headers.find(h => h.name === "From")?.value || "Unknown";
            const subjectHeader = headers.find(h => h.name === "Subject")?.value || "(no subject)";
            const dateHeader = headers.find(h => h.name === "Date")?.value || "";
            emails.push({
                id: msg.id,
                threadId: msg.threadId || msg.id,
                from: fromHeader,
                subject: subjectHeader,
                snippet: detail.data.snippet || "",
                date: dateHeader,
                isUnread: detail.data.labelIds?.includes("UNREAD") || false,
            });
        }
        return emails;
    }
    catch (err) {
        console.error("[gmail] Error fetching emails:", err);
        throw err;
    }
}
/**
 * Get unread email count
 */
export async function getUnreadCount() {
    if (!isGoogleAuthenticated()) {
        return 0;
    }
    const auth = getGoogleOAuth();
    const gmail = google.gmail({ version: "v1", auth });
    try {
        const response = await gmail.users.messages.list({
            userId: "me",
            q: "in:inbox is:unread",
            maxResults: 100,
        });
        return response.data.resultSizeEstimate || 0;
    }
    catch (err) {
        console.error("[gmail] Error getting unread count:", err);
        return 0;
    }
}
/**
 * Get email body content
 */
export async function getEmailBody(messageId) {
    if (!isGoogleAuthenticated()) {
        throw new Error("Google not authenticated");
    }
    const auth = getGoogleOAuth();
    const gmail = google.gmail({ version: "v1", auth });
    try {
        const response = await gmail.users.messages.get({
            userId: "me",
            id: messageId,
            format: "full",
        });
        // Extract text content from message parts
        const parts = response.data.payload?.parts || [];
        let textContent = "";
        function extractText(part) {
            if (part.mimeType === "text/plain" && part.body?.data) {
                return Buffer.from(part.body.data, "base64").toString("utf-8");
            }
            if (part.parts) {
                return part.parts.map(extractText).join("\n");
            }
            return "";
        }
        if (response.data.payload?.body?.data) {
            textContent = Buffer.from(response.data.payload.body.data, "base64").toString("utf-8");
        }
        else {
            textContent = parts.map(extractText).join("\n");
        }
        return textContent.substring(0, 5000); // Limit size
    }
    catch (err) {
        console.error("[gmail] Error getting email body:", err);
        throw err;
    }
}
//# sourceMappingURL=gmail.js.map