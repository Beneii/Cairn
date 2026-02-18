/**
 * Gmail Integration
 *
 * Read-only access to Gmail for email summarization and inbox awareness.
 */
export interface EmailSummary {
    id: string;
    threadId: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    isUnread: boolean;
}
/**
 * Get recent emails from inbox
 */
export declare function getRecentEmails(maxResults?: number): Promise<EmailSummary[]>;
/**
 * Get unread email count
 */
export declare function getUnreadCount(): Promise<number>;
/**
 * Get email body content
 */
export declare function getEmailBody(messageId: string): Promise<string>;
//# sourceMappingURL=gmail.d.ts.map