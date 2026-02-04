import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import type { ClientMessage } from "@cairn/shared";
import { bus, newId, shortTime } from "@cairn/shared";
import { initLedger } from "@cairn/ledger";
import { initWarmMemory } from "@cairn/memory";
import { initJobStore, initLLM, isLLMAvailable, processMessage } from "@cairn/orchestrator";
import { startScheduler } from "@cairn/scheduler";
import {
  initNotes,
  getNotes,
  createNote,
  markNoteRead,
  resurfaceNote,
} from "./notes.js";
import { setupBroadcast } from "./broadcast.js";

const PORT = process.env.PORT ?? 3100;

async function main() {
  // 1. Initialize all services
  await initLedger();
  await initWarmMemory();
  await initJobStore();
  await initNotes();

  // LLM is opt-in. System boots without it.
  initLLM();

  // 2. Express + WebSocket
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  // 3. Health endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // 4. Bridge event bus → WebSocket broadcast
  const broadcast = setupBroadcast(wss);

  bus.on("chat:message", (msg) =>
    broadcast({ type: "chat:message", message: msg }),
  );
  bus.on("nucleus:state", (state, subAgents) =>
    broadcast({ type: "nucleus:state", state, subAgents }),
  );
  bus.on("log:entry", (entry) => broadcast({ type: "log:entry", entry }));
  bus.on("note:updated", (notes) =>
    broadcast({ type: "note:update", notes }),
  );
  bus.on("job:updated", (job) =>
    broadcast({
      type: "job:update",
      job: {
        id: job.id,
        status: job.status,
        nodes_traversed: job.nodes_traversed,
      },
    }),
  );

  // 5. Handle WebSocket connections
  wss.on("connection", (socket) => {
    console.log("[ws] client connected");

    // Send initial state
    socket.send(JSON.stringify({ type: "nucleus:state", state: "idle" }));
    socket.send(JSON.stringify({ type: "note:update", notes: getNotes() }));

    socket.on("message", async (raw) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString());

        switch (msg.type) {
          case "chat:send": {
            // Echo user message to all clients
            broadcast({
              type: "chat:message",
              message: {
                id: newId(),
                role: "user",
                text: msg.text,
                timestamp: shortTime(),
              },
            });

            if (!isLLMAvailable()) {
              broadcast({
                type: "chat:message",
                message: {
                  id: newId(),
                  role: "cairn",
                  text: "LLM is not configured. Set OPENAI_API_KEY and restart to enable AI.",
                  timestamp: shortTime(),
                },
              });
              break;
            }

            // Process through orchestrator (async — results stream via event bus)
            processMessage(msg.text).catch((err) => {
              console.error("[gateway] processMessage error:", err);
            });
            break;
          }
          case "note:create":
            await createNote(msg.content);
            break;
          case "note:mark_read":
            await markNoteRead(msg.id);
            break;
          case "note:resurface":
            await resurfaceNote(msg.id);
            break;
          case "ping":
            socket.send(JSON.stringify({ type: "pong" }));
            break;
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        socket.send(JSON.stringify({ type: "error", message: errorMsg }));
      }
    });

    socket.on("close", () => {
      console.log("[ws] client disconnected");
    });
  });

  // 6. Start scheduler
  startScheduler();

  // 7. Listen
  server.listen(PORT, () => {
    console.log(`[gateway] listening on http://localhost:${PORT}`);
    console.log(`[gateway] health  → http://localhost:${PORT}/health`);
    console.log(`[gateway] ws      → ws://localhost:${PORT}/ws`);
  });
}

main().catch((err) => {
  console.error("[gateway] fatal error:", err);
  process.exit(1);
});
