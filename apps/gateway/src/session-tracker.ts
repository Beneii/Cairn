/**
 * Tracks user session activity to determine smart message routing.
 * Telegram should only receive messages when:
 * 1. User's last message was from Telegram (active session)
 * 2. OR dashboard hasn't been used in 15+ minutes (user is away)
 */

let lastMessageSource: "telegram" | "dashboard" | null = null;
let lastDashboardActivity = Date.now();

const AWAY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Record a message from a specific source
 */
export function recordMessageSource(source: "telegram" | "dashboard"): void {
  lastMessageSource = source;

  if (source === "dashboard") {
    lastDashboardActivity = Date.now();
  }
}

/**
 * Record dashboard activity (any interaction)
 */
export function recordDashboardActivity(): void {
  lastDashboardActivity = Date.now();
}

/**
 * Check if Telegram should receive this message.
 * Returns true if:
 * - Last message was from Telegram (active telegram session)
 * - OR dashboard has been inactive for 15+ minutes (user is away)
 */
export function shouldSendToTelegram(): boolean {
  // If last message was from Telegram, user is actively using it
  if (lastMessageSource === "telegram") {
    return true;
  }

  // If dashboard has been inactive for 15+ minutes, user might be away
  const timeSinceDashboard = Date.now() - lastDashboardActivity;
  if (timeSinceDashboard >= AWAY_THRESHOLD_MS) {
    return true;
  }

  // Otherwise, user is actively on dashboard - don't spam Telegram
  return false;
}

/**
 * Get current session info for debugging
 */
export function getSessionInfo() {
  return {
    lastMessageSource,
    lastDashboardActivity,
    minutesSinceDashboard: Math.floor((Date.now() - lastDashboardActivity) / 60000),
    shouldSendToTelegram: shouldSendToTelegram(),
  };
}
