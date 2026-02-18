export type WsCapability =
  | "chat:send"
  | "tasks:write"
  | "goals:write"
  | "notes:write"
  | "kanban:write"
  | "archive:read"
  | "system_docs:read"
  | "config:write"
  | "job:read";

export interface WsSession {
  isLocal: boolean;
  clientType: "dashboard" | "mobile" | "unknown";
  authenticated: boolean;
  capabilities: Set<WsCapability>;
}

const ALL_CAPABILITIES: WsCapability[] = [
  "chat:send",
  "tasks:write",
  "goals:write",
  "notes:write",
  "kanban:write",
  "archive:read",
  "system_docs:read",
  "config:write",
  "job:read",
];

const DASHBOARD_CAPABILITIES: WsCapability[] = [...ALL_CAPABILITIES];
const MOBILE_CAPABILITIES: WsCapability[] = ["chat:send", "tasks:write"];

const UNAUTHENTICATED_ALLOWED = new Set<string>([
  "ping",
  "config:request_sync",
  "auth:dashboard",
  "auth:mobile",
  "mobile:connect",
]);

const MESSAGE_CAPABILITY: Partial<Record<string, WsCapability>> = {
  "chat:send": "chat:send",
  "mobile:send": "chat:send",
  "task:create": "tasks:write",
  "task:update": "tasks:write",
  "task:delete": "tasks:write",
  "goal:create": "goals:write",
  "goal:update": "goals:write",
  "goal:delete": "goals:write",
  "note:create": "notes:write",
  "note:mark_read": "notes:write",
  "note:archive": "notes:write",
  "note:delete": "notes:write",
  "kanban:archive": "kanban:write",
  "kanban:restore": "kanban:write",
  "kanban:delete": "kanban:write",
  "kanban:update_status": "kanban:write",
  "kanban:set_project": "kanban:write",
  "archive:get_logs": "archive:read",
  "archive:get_system_docs": "system_docs:read",
  "skillRequests:list": "archive:read",
  "skillMetrics:list": "archive:read",
  "skillMetrics:get": "archive:read",
  "job:get": "job:read",
  "config:set_openai_key": "config:write",
  "config:set_heartbeat": "config:write",
  "config:set_spend_limit": "config:write",
  "config:set_decision_limit": "config:write",
  "config:set_interaction_limit": "config:write",
  "config:set_telegram_token": "config:write",
  "config:set_telegram_admin_chat_id": "config:write",
  "config:set_proactive_config": "config:write",
  "config:set_mobile_config": "config:write",
  "config:set_local_mode": "config:write",
  "system:update": "config:write",
};

export function createSession(isLocal: boolean): WsSession {
  if (isLocal) {
    return {
      isLocal,
      clientType: "dashboard",
      authenticated: true,
      capabilities: new Set(ALL_CAPABILITIES),
    };
  }
  return {
    isLocal,
    clientType: "unknown",
    authenticated: false,
    capabilities: new Set(),
  };
}

export function grantDashboardSession(session: WsSession): void {
  session.clientType = "dashboard";
  session.authenticated = true;
  session.capabilities = new Set(DASHBOARD_CAPABILITIES);
}

export function grantMobileSession(session: WsSession): void {
  session.clientType = "mobile";
  session.authenticated = true;
  session.capabilities = new Set(MOBILE_CAPABILITIES);
}

export function getCapabilities(session: WsSession): string[] {
  return Array.from(session.capabilities.values());
}

export function authorizeMessage(
  session: WsSession,
  type: string,
): { allowed: boolean; reason?: string } {
  if (session.isLocal) return { allowed: true };

  if (!session.authenticated) {
    if (UNAUTHENTICATED_ALLOWED.has(type)) return { allowed: true };
    return { allowed: false, reason: "Denied: socket not authenticated" };
  }

  const required = MESSAGE_CAPABILITY[type];
  if (!required) return { allowed: true };

  if (!session.capabilities.has(required)) {
    return {
      allowed: false,
      reason: `Denied: missing capability ${required}`,
    };
  }

  return { allowed: true };
}
