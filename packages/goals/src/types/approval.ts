/**
 * Approval Gate Types
 * 
 * Controls what Cairn can do autonomously vs what needs human approval.
 */

// ---- Risk Levels ----

export type ActionRisk =
    | "auto"     // Do it silently
    | "notify"   // Do it, but tell the user
    | "approve"  // Ask before doing
    | "never";   // Never do this autonomously

// ---- Action Policy ----

export interface ActionPolicy {
    action: string;          // "send_message", "book_appointment"
    risk: ActionRisk;
    domain?: string;         // Optional domain filter ("housing", "calendar")
    description: string;
}

// ---- Approval Request ----

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
    id: string;
    goalId: string;
    action: string;
    description: string;     // Human-readable: "Send enquiry to agent@realestate.com"
    payload: unknown;        // The actual data (message content, etc.)
    status: ApprovalStatus;
    createdAt: string;
    resolvedAt?: string;
    resolvedBy?: "user" | "timeout" | "policy";
    expiresAt?: string;      // Auto-reject after this time
}

// ---- Default Policies ----

export const DEFAULT_POLICIES: ActionPolicy[] = [
    // Data collection - always auto
    { action: "scrape_public_data", risk: "auto", description: "Fetch public listings/data" },
    { action: "search_web", risk: "auto", description: "Web search" },
    { action: "read_email", risk: "auto", description: "Read user's email" },
    { action: "read_calendar", risk: "auto", description: "Read user's calendar" },

    // Internal processing - always auto
    { action: "score_items", risk: "auto", description: "Score items against preferences" },
    { action: "filter_items", risk: "auto", description: "Filter by constraints" },
    { action: "update_memory", risk: "auto", description: "Update internal memory" },

    // Notifications - auto but visible
    { action: "send_notification", risk: "notify", description: "Send notification to user" },
    { action: "surface_items", risk: "notify", description: "Show items to user" },

    // External communication - always approve
    { action: "send_message", risk: "approve", description: "Send message to external party" },
    { action: "send_email", risk: "approve", description: "Send email" },
    { action: "book_appointment", risk: "approve", description: "Book appointment/inspection" },
    { action: "make_reservation", risk: "approve", description: "Make reservation" },

    // Financial - always approve
    { action: "spend_money", risk: "approve", description: "Any financial transaction" },
    { action: "subscribe", risk: "approve", description: "Subscribe to service" },

    // Dangerous - never
    { action: "sign_document", risk: "never", description: "Sign or agree to anything legal" },
    { action: "share_credentials", risk: "never", description: "Share passwords or keys" },
    { action: "delete_data", risk: "approve", description: "Delete user data" },
];

// ---- Policy Lookup ----

export function getActionRisk(action: string, domain?: string): ActionRisk {
    // Check domain-specific first
    if (domain) {
        const domainPolicy = DEFAULT_POLICIES.find(
            p => p.action === action && p.domain === domain
        );
        if (domainPolicy) return domainPolicy.risk;
    }

    // Fall back to general
    const generalPolicy = DEFAULT_POLICIES.find(
        p => p.action === action && !p.domain
    );

    // Default to approve if not found (safe default)
    return generalPolicy?.risk ?? "approve";
}

export function requiresApproval(action: string, domain?: string): boolean {
    const risk = getActionRisk(action, domain);
    return risk === "approve" || risk === "never";
}

export function isNeverAllowed(action: string, domain?: string): boolean {
    return getActionRisk(action, domain) === "never";
}
