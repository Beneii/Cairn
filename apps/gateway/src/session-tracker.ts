/**
 * Tracks user session activity to determine smart message routing.
 * Telegram should only receive messages when:
 * 1. User's last message was from Telegram (active session)
 * 2. OR dashboard hasn't been used in 15+ minutes (user is away)
 */

const AWAY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

interface SessionState {
  lastMessageSource: "telegram" | "dashboard" | "mobile" | null;
  lastActivity: number;
}

const state: SessionState = {
  lastMessageSource: null,
  lastActivity: Date.now(),
};

/**
 * Record a message from a specific source
 */
export function recordMessageSource(source: "telegram" | "dashboard" | "mobile"): void {
  state.lastMessageSource = source;
  state.lastActivity = Date.now();
  console.log(`[session] Activity recorded from ${source}`);
}

/**
 * Record dashboard activity (any interaction)
 */
export function recordDashboardActivity(): void {
  // Only update if dashboard is the active source or we want to switch context
  // But actually, any activity counts as "user is here"
  state.lastActivity = Date.now();
}

/**
 * Check if Telegram should receive this message.
 */
export function shouldSendToTelegram(defaultClient: "telegram" | "mobile"): boolean {
  // 1. If user is actively using Telegram, always send there
  if (state.lastMessageSource === "telegram") return true;

  // 2. If user is actively using Mobile, DO NOT send to Telegram (unless explicit override? nah)
  if (state.lastMessageSource === "mobile") return false;

  // 3. If user is actively using Dashboard, DO NOT send to Telegram
  const timeSinceActivity = Date.now() - state.lastActivity;
  if (state.lastMessageSource === "dashboard" && timeSinceActivity < AWAY_THRESHOLD_MS) {
    return false;
  }

  // 4. If user is away/inactive:
  // Send to Telegram ONLY IF it's the default client OR if Mobile isn't the default
  return defaultClient === "telegram";
}

/**
 * Check if Mobile App should receive this message.
 */
export function shouldSendToMobile(defaultClient: "telegram" | "mobile"): boolean {
  // 1. If user is actively using Mobile, always send there
  if (state.lastMessageSource === "mobile") return true;

  // 2. If user is actively using Telegram, DO NOT send to Mobile
  if (state.lastMessageSource === "telegram") return false;

  // 3. If user is actively using Dashboard, DO NOT send to Mobile
  const timeSinceActivity = Date.now() - state.lastActivity;
  if (state.lastMessageSource === "dashboard" && timeSinceActivity < AWAY_THRESHOLD_MS) {
    return false;
  }

  // 4. If user is away/inactive:
  // Send to Mobile ONLY IF it's the default client
  return defaultClient === "mobile";
}

/**
 * Get current session info for debugging
 */
export function getSessionInfo() {
  const debugDefaultClient: "telegram" | "mobile" = "telegram"; // Default for debug
  return {
    lastMessageSource: state.lastMessageSource,
    lastActivity: state.lastActivity,
    minutesSinceActivity: Math.floor((Date.now() - state.lastActivity) / 60000),
    shouldSendToTelegram: shouldSendToTelegram(debugDefaultClient),
    shouldSendToMobile: shouldSendToMobile(debugDefaultClient),
  };
}
