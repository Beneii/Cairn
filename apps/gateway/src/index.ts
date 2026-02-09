import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables from root .env
dotenv.config({ path: path.join(process.cwd(), "../../.env") });
// Also try local if not found or as fallback
dotenv.config();
import type { ClientMessage } from "@cairn/shared";
import { bus, newId, shortTime } from "@cairn/shared";
import { initLedger } from "@cairn/ledger";
import { initWarmMemory, initColdMemory, initEmbeddingService, runCurationCycle, getColdMemoryStats } from "@cairn/memory";
import { initJobStore, initLLM, isLLMAvailable, processMessage } from "@cairn/orchestrator";
import { startScheduler } from "@cairn/scheduler";
import {
  initNotes,
  getNotes,
  createNote,
  markNoteRead,
  resurfaceNote,
} from "./notes.js";
import {
  initKanban,
  getCards,
  createCard,
  updateCardByJobId,
  archiveCard,
  restoreCard,
  updateCardProject,
} from "./kanban.js";
import { setOpenAIKey, setHeartbeat, setSpendLimit, setDecisionLimit, setInteractionLimit, setTelegramToken, setTelegramAdminChatId, getSystemConfig, setProactiveConfig } from "./config.js";
import { setupBroadcast } from "./broadcast.js";
import { initTelegram, isTelegramEnabled } from "./telegram.js";
import { NODES, GRAPH_EDGES } from "@cairn/policy";
import { recordMessageSource } from "./session-tracker.js";
import { startLibrarianProcessor } from "./librarian.js";
import { startCheckInProcessor, startProactiveProcessor } from "./checkins.js";
import { initGoogleOAuth, getAuthUrl, exchangeCodeForTokens } from "@cairn/integrations";
import { initCalendarProvider, getCalendarProvider } from "@cairn/executor";
import { setBriefingCalendarSource } from "@cairn/goals";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ?? 3100;
const NOTES_CHECK_INTERVAL_MS = 60000; // Check notes every 60 seconds

// Notes processor - scans inbox and processes unread notes
function startNotesProcessor(): void {
  setInterval(async () => {
    try {
      const unreadNotes = getNotes().filter((n) => n.status === "unread");

      if (unreadNotes.length === 0) {
        return; // Most heartbeats do nothing - this is correct (truth.md §5)
      }

      // Process oldest unread note (one incremental step per heartbeat)
      const oldestNote = unreadNotes[unreadNotes.length - 1];

      console.log(`[notes] Processing unread note: ${oldestNote.id}`);

      // Mark as read before processing to avoid re-processing on failure
      await markNoteRead(oldestNote.id);

      // Pass to gatekeeper via orchestrator
      if (isLLMAvailable()) {
        await processMessage(oldestNote.content);
      } else {
        console.log(`[notes] Skipping note processing - LLM not configured`);
      }
    } catch (err) {
      console.error("[notes] Error processing note:", err);
    }
  }, NOTES_CHECK_INTERVAL_MS);

  console.log(`[notes] Notes processor started (interval: ${NOTES_CHECK_INTERVAL_MS / 1000}s)`);
}

const CURATOR_INTERVAL_MS = 30 * 60 * 1000; // Run curator every 30 minutes

// Curator processor - promotes content from warm to cold memory
function startCuratorProcessor(): void {
  // Run once on startup after a short delay
  setTimeout(async () => {
    try {
      const stats = getColdMemoryStats();
      console.log(`[curator] Cold memory stats: ${stats.documentCount} docs, ${stats.chunkCount} chunks`);

      const result = await runCurationCycle();
      if (result.promoted > 0) {
        console.log(`[curator] Startup curation: ${result.promoted} items queued for promotion`);
      }
    } catch (err) {
      console.error("[curator] Startup curation error:", err);
    }
  }, 5000); // 5 second delay for startup

  // Then run periodically
  setInterval(async () => {
    try {
      const result = await runCurationCycle();
      if (result.promoted > 0 || result.skipped > 0) {
        console.log(`[curator] Curation cycle: ${result.promoted} promoted, ${result.skipped} skipped`);
      }
    } catch (err) {
      console.error("[curator] Curation cycle error:", err);
    }
  }, CURATOR_INTERVAL_MS);

  console.log(`[curator] Curator processor started (interval: ${CURATOR_INTERVAL_MS / 1000 / 60}min)`);
}

async function main() {
  // 1. Initialize all services
  await initLedger();
  await initWarmMemory();
  initColdMemory();
  initEmbeddingService();
  await initJobStore();
  await initNotes();
  await initKanban();

  // LLM is opt-in. System boots without it.
  initLLM();

  // Initialize Google OAuth + calendar provider
  initGoogleOAuth();
  initCalendarProvider();

  // Wire calendar provider into briefing system
  setBriefingCalendarSource(getCalendarProvider());

  // 2. Express + WebSocket
  const app = express();
  app.use(express.json());
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  // 3. Health endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Google OAuth routes
  app.get("/oauth/google", (_req, res) => {
    const url = getAuthUrl();
    if (!url) {
      res.status(500).json({ error: "Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." });
      return;
    }
    res.redirect(url);
  });

  app.get("/oauth/callback", async (req, res) => {
    const code = req.query.code as string;
    if (!code) {
      res.status(400).json({ error: "Missing authorization code" });
      return;
    }

    const refreshToken = await exchangeCodeForTokens(code);
    if (!refreshToken) {
      res.status(500).json({ error: "Token exchange failed" });
      return;
    }

    // Save refresh token to .env
    const envPath = path.join(process.cwd(), "../../.env");
    let envContent = "";
    try { envContent = fs.readFileSync(envPath, "utf-8"); } catch { }

    if (envContent.includes("GOOGLE_REFRESH_TOKEN=")) {
      envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
    } else {
      envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
    }
    fs.writeFileSync(envPath, envContent);
    process.env.GOOGLE_REFRESH_TOKEN = refreshToken;

    // Re-init calendar provider with real Google data
    initCalendarProvider();
    console.log("[oauth] Google authenticated, calendar provider switched to Google");

    // Redirect to dashboard
    const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:5173";
    res.redirect(`${dashboardUrl}?google=connected`);
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
  bus.on("kanban:updated", (cards) =>
    broadcast({ type: "kanban:update", cards }),
  );

  // Auto-create kanban cards from jobs
  bus.on("job:created", (job) => {
    const title = job.input.length > 50 ? job.input.substring(0, 47) + "..." : job.input;
    createCard(title, "active", job.id);
  });
  bus.on("job:completed", (job) => {
    updateCardByJobId(job.id, "done");
  });
  bus.on("job:failed", (job) => {
    updateCardByJobId(job.id, "blocked");
  });

  // 5. Handle WebSocket connections
  wss.on("connection", (socket) => {
    console.log("[ws] client connected");

    // Send initial state
    socket.send(JSON.stringify({ type: "nucleus:state", state: "idle" }));
    socket.send(JSON.stringify({ type: "note:update", notes: getNotes() }));
    socket.send(JSON.stringify({ type: "kanban:update", cards: getCards() }));
    socket.send(JSON.stringify({ type: "config:update", config: getSystemConfig() }));
    socket.send(JSON.stringify({ type: "policy:update", nodes: NODES, edges: GRAPH_EDGES }));

    socket.on("message", async (raw) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString());

        switch (msg.type) {
          case "chat:send": {
            // Record that user is messaging from dashboard
            recordMessageSource("dashboard");

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
          case "kanban:archive":
            await archiveCard(msg.id);
            break;
          case "kanban:restore":
            await restoreCard(msg.id);
            break;
          case "kanban:set_project":
            await updateCardProject(msg.id, msg.project);
            break;
          case "config:set_openai_key": {
            await setOpenAIKey(msg.key);
            broadcast({ type: "config:update", config: getSystemConfig() });
            broadcast({
              type: "chat:message",
              message: {
                id: newId(),
                role: "cairn",
                text: "API Key updated and LLM re-initialized.",
                timestamp: shortTime(),
              },
            });
            break;
          }
          case "config:set_heartbeat": {
            await setHeartbeat(msg.interval_ms);
            broadcast({ type: "config:update", config: getSystemConfig() });
            break;
          }
          case "config:set_spend_limit": {
            await setSpendLimit(msg.limit_usd);
            broadcast({ type: "config:update", config: getSystemConfig() });
            break;
          }
          case "config:set_proactive_config": {
            await setProactiveConfig(msg.config);
            broadcast({ type: "config:update", config: getSystemConfig() });
            break;
          }
          case "config:set_decision_limit": {
            await setDecisionLimit(msg.limit);
            broadcast({ type: "config:update", config: getSystemConfig() });
            break;
          }
          case "config:set_interaction_limit": {
            await setInteractionLimit(msg.limit);
            broadcast({ type: "config:update", config: getSystemConfig() });
            break;
          }
          case "config:set_telegram_token": {
            await setTelegramToken(msg.token);
            broadcast({ type: "config:update", config: getSystemConfig() });
            broadcast({
              type: "chat:message",
              message: {
                id: newId(),
                role: "cairn",
                text: "Telegram token updated. Restart the gateway to apply changes.",
                timestamp: shortTime(),
              },
            });
            break;
          }
          case "config:set_telegram_admin_chat_id": {
            await setTelegramAdminChatId(msg.chat_id);
            broadcast({ type: "config:update", config: getSystemConfig() });
            broadcast({
              type: "chat:message",
              message: {
                id: newId(),
                role: "cairn",
                text: `Telegram admin chat ID set to ${msg.chat_id}. Restart the gateway to apply.`,
                timestamp: shortTime(),
              },
            });
            break;
          }
          case "config:request_sync": {
            socket.send(JSON.stringify({ type: "config:update", config: getSystemConfig() }));
            socket.send(JSON.stringify({ type: "policy:update", nodes: NODES, edges: GRAPH_EDGES }));
            break;
          }
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

  // 7. Start Telegram bot (if configured)
  initTelegram();

  // 8. Start notes processor (heartbeat inbox scanning)
  startNotesProcessor();

  // 9. Start librarian (end-of-day task organization)
  startLibrarianProcessor();

  // 10. Start proactive check-ins
  startCheckInProcessor();

  // 11. Start curator processor (warm → cold memory promotion)
  startCuratorProcessor();

  // 12. Start proactive intelligence (goal-driven nudges)
  startProactiveProcessor();

  // 13. Listen
  server.listen(Number(PORT), HOST, () => {
    console.log(`[gateway] mode     → ${process.env.NODE_ENV || "development"}`);
    console.log(`[gateway] listening → ${HOST}:${PORT}`);
    console.log(`[gateway] local    → http://localhost:${PORT}`);
    console.log(`[gateway] health   → http://localhost:${PORT}/health`);
    console.log(`[gateway] ws       → ws://localhost:${PORT}/ws`);
    if (isTelegramEnabled()) {
      console.log(`[gateway] telegram → enabled`);
    }
  });
}

main().catch((err) => {
  console.error("[gateway] fatal error:", err);
  process.exit(1);
});
