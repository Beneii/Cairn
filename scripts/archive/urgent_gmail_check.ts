import { getTool } from "../packages/executor/src/tools.js";

async function main() {
    const gmailRead = getTool("gmail_read");
    if (!gmailRead) {
        console.error("Tool gmail_read not found");
        return;
    }

    try {
        // Attempt to get recent emails. If not authenticated, the tool returns success: false.
        const result = await gmailRead({ max_results: 15 }, {} as any);
        if (!result.success) {
            console.log("HEARTBEAT_OK (Google not authenticated or tool error)");
            return;
        }

        const data = JSON.parse(result.output);
        const emails = data.emails || [];
        
        // Gmail query 'after:X' is more efficient but we use the existing tool which fetches 'in:inbox'.
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const urgentEmails = [];

        for (const email of emails) {
            // Standard Gmail date string parsing
            const emailDate = new Date(email.date).getTime();
            if (isNaN(emailDate) || emailDate < oneHourAgo) continue;

            // Urgency heuristics
            const isUrgent = /urgent|immediate|important|action required|critical/i.test(email.subject) ||
                             /urgent|immediate|important|action required|critical/i.test(email.snippet);

            if (isUrgent) {
                urgentEmails.push(email);
            }
        }

        if (urgentEmails.length > 0) {
            let message = "⚠️ Urgent Emails found in the last hour:\n\n";
            urgentEmails.forEach(email => {
                message += `• From: ${email.from}\n  Subject: ${email.subject}\n  ${email.snippet}\n\n`;
            });

            // We log the message to stdout. 
            // The calling script/process can then decide how to deliver it.
            console.log(message.trim());
        } else {
            console.log("HEARTBEAT_OK");
        }
    } catch (err) {
        // Stay silent on error during cron
        console.error("Error in urgent_gmail_check:", err);
        console.log("HEARTBEAT_OK");
    }
}

main();
