import type { WebSocketServer } from "ws";
import type { ServerMessage } from "@cairn/shared";

export function setupBroadcast(
  wss: WebSocketServer,
): (msg: ServerMessage) => void {
  return (msg: ServerMessage) => {
    const data = JSON.stringify(msg);
    for (const client of wss.clients) {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(data);
      }
    }
  };
}
