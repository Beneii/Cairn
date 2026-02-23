import { getTool } from "../packages/executor/src/tools.js";

async function main() {
    const gmailRead = getTool("gmail_read");
    if (!gmailRead) {
        console.error("Tool gmail_read not found");
        return;
    }

    try {
        const result = await gmailRead({ max_results: 15 }, {} as any);
        if (!result.success) {
            console.log("HEARTBEAT_OK (Google not authenticated or tool error)");
            return;
        }

        const data = JSON.parse(result.output);
        const emails = data.emails || [];
        
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const urgentEmails = [];

        for (const email of emails) {
            const emailDate = new Date(email.date).getTime();
            if (isNaN(emailDate) || emailDate < oneHourAgo) continue;

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

            console.log(message.trim());
        } else {
            console.log("HEARTBEAT_OK");
        }
    } catch (err) {
        console.error("Error in urgent_gmail_check:", err);
        console.log("HEARTBEAT_OK");
    }
}

main();
