/**
 * Cairn Runtime Configuration
 *
 * Single source of truth for API and WebSocket URLs.
 * Derives endpoints from window.location so Cairn works
 * on localhost, VPS, Tailscale, phone, or behind a reverse proxy
 * without manual rewiring.
 */

export type CairnMode = "local" | "remote" | "prod";

export function getMode(): CairnMode {
  const mode = import.meta.env.VITE_CAIRN_MODE;
  if (mode === "remote" || mode === "prod") return mode;
  return "local";
}

export function getWsUrl(): string {
  // Explicit override wins
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // Derive from current page location — works everywhere
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function getApiBase(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return `${window.location.protocol}//${window.location.host}`;
}

export function getDashboardAuthToken(): string | undefined {
  return import.meta.env.VITE_DASHBOARD_AUTH_TOKEN;
}

/** Direct gateway URL for mobile pairing (bypasses Vite proxy). */
export function getGatewayUrl(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In dev, Vite runs on :5173 but gateway is on :3100
  const port = import.meta.env.DEV ? (import.meta.env.VITE_GATEWAY_PORT || "3100") : window.location.port;
  const host = window.location.hostname;
  const protocol = window.location.protocol;
  return `${protocol}//${host}${port ? `:${port}` : ""}`;
}
