import { getTool } from "../packages/executor/src/tools.js";

async function main() {
    const gmailRead = getTool("gmail_read");
    if (!gmailRead) {
        console.error("Tool gmail_read not found");
        return;
    }

    try {
        const result = await gmailRead({ max_results: 10 }, {} as any);
        if (!result.success) {
            console.log(result.output.includes("not connected") ? "HEARTBEAT_OK (Google not authenticated)" : "HEARTBEAT_OK");
            return;
        }

        const data = JSON.parse(result.output);
        const emails = data.emails || [];
        
        // Gmail query with 'after' is handled by the underlying integration if we modified it, 
        // but here we are just getting recent ones and checking urgency in the last hour.
        
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const urgentEmails = [];

        for (const email of emails) {
            const emailDate = new Date(email.date).getTime();
            if (emailDate < oneHourAgo) continue;

            const isUrgent = /urgent|immediate|important|action required|critical/i.test(email.subject) ||
                             /urgent|immediate|important|action required|critical/i.test(email.snippet);

            if (isUrgent) {
                urgentEmails.push(email);
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
        console.error("Error:", err);
        console.log("HEARTBEAT_OK");
    }
}

main();
