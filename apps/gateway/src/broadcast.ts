import type { WebSocketServer } from "ws";
import type { ServerMessage } from "@cairn/shared";
import { isTelegramEnabled, sendTelegramMessage } from "./telegram.js";
import { getSystemConfig } from "./config.js";
import { shouldSendToMobile, shouldSendToTelegram } from "./session-tracker.js";

export function setupBroadcast(
  wss: WebSocketServer,
): (msg: ServerMessage) => void {
  return (msg: ServerMessage) => {
    const config = getSystemConfig();
    const data = JSON.stringify(msg);

    // 1. Broadcast to all WebSocket clients (Dashboard + Mobile)
    // Note: Mobile might receive duplicate if we don't filter, but for now 
    // we let the client handle dedup or just receive everything. 
    // Actually, let's just broadcast to all connected WS clients.
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }

    // 2. Handle Telegram routing for Chat Messages
    // Only route "chat:message" events to Telegram, and only if logic permits
    if (msg.type === "chat:message" && msg.message.role === "cairn") {
      if (isTelegramEnabled() && shouldSendToTelegram(config.default_client)) {
        sendTelegramMessage(msg.message.text).catch(console.error);
      }
    }
  };
}
