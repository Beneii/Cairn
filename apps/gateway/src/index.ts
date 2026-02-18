import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import fs from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import dotenv from "dotenv";
import { getProjectRoot } from "@cairn/shared";

// Load environment variables from root .env
const PROJECT_ROOT = getProjectRoot();
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });
import type { ClientMessage } from "@cairn/shared";
import { bus, newId, shortTime } from "@cairn/shared";
import { initLedger } from "@cairn/ledger";
import { initWarmMemory, initColdMemory, initEmbeddingService, runCurationCycle, getColdMemoryStats, warmGet, warmSet } from "@cairn/memory";
import { initJobStore, initLLM, isLLMAvailable, processMessage, isOllamaAvailable, getLocalModels, pullModelStream } from "@cairn/orchestrator";
import { startScheduler } from "@cairn/scheduler";
import {
  initNotes,
  getNotes,
  createNote,
  markNoteRead,
  archiveNote,
  deleteNote,
} from "./notes.js";
import {
  initKanban,
  getCards,
  createCard,
  updateCardByJobId,
  archiveCard,
  restoreCard,
  deleteCard,
  updateCardStatus,
  updateCardProject,
} from "./kanban.js";
import { setOpenAIKey, setHeartbeat, setSpendLimit, setDecisionLimit, setInteractionLimit, setTelegramToken, setTelegramAdminChatId, getSystemConfig, getMobilePairingSecret, getDashboardAuthToken, getMobileAuthToken, setProactiveConfig, setMobileConfig, setLocalMode, migrateSecrets } from "./config.js";
import { setupBroadcast } from "./broadcast.js";
import { initTelegram, isTelegramEnabled } from "./telegram.js";
import { NODES, GRAPH_EDGES } from "@cairn/policy";
import { recordMessageSource } from "./session-tracker.js";
import { startLibrarianProcessor } from "./librarian.js";
import { startCheckInProcessor, startProactiveProcessor } from "./checkins.js";
import { startTaskAgent } from "./task-agent.js";
import { initGoogleOAuth, getAuthUrl, exchangeCodeForTokens } from "@cairn/integrations";
import { initCalendarProvider, getCalendarProvider } from "@cairn/executor";
import { setBriefingCalendarSource, getGoals, createGoal as createGoalFactory, updateGoal, saveGoal } from "@cairn/goals";
import { deleteGoal, getGoal } from "@cairn/goals";
import { getTasks, createTask, updateTask, deleteTask, completeTask, initDatabase as initTasks } from "@cairn/tasks";
import {
  initSkillRequestStore,
  listSkillRequests,
  type SkillRequestStatus,
  initSkillMetricsStore,
  listSkillMetrics,
  getSkillMetrics,
} from "@cairn/skills";
import { loadSystemDocs } from "./system-docs.js";
import { authorizeMessage, createSession, getCapabilities, grantDashboardSession, grantMobileSession } from "./ws-auth.js";

const HOST = process.env.HOST || "0.0.0.0";
const PORT = process.env.PORT ?? 3100;
const NOTES_CHECK_INTERVAL_MS = 60000; // Check notes every 60 seconds

function isSelfGrowthEnabled(): boolean {
  return process.env.CAIRN_MODE === "grow" || process.env.CAIRN_SELF_GROWTH === "enabled";
}

// Notes processor - scans inbox and processes user-created notes only
const processedNoteIds = new Set<string>();

function startNotesProcessor(): void {
  setInterval(async () => {
    try {
      // Only process user-created notes. Agent notes are deliverables, not input.
      const unreadNotes = getNotes().filter(
        (n) => n.status === "unread" && n.source !== "agent" && !processedNoteIds.has(n.id)
      );

      if (unreadNotes.length === 0) {
        return;
      }

      const oldestNote = unreadNotes[unreadNotes.length - 1];

      // Idempotency: never process the same note twice
      processedNoteIds.add(oldestNote.id);

      console.log(`[notes] Processing user note: ${oldestNote.id}`);

      await markNoteRead(oldestNote.id);
      await archiveNote(oldestNote.id);

      if (isLLMAvailable()) {
        await processMessage(oldestNote.content);
      }

      // Cap the set size to prevent unbounded growth
      if (processedNoteIds.size > 500) {
        const idsArray = [...processedNoteIds];
        for (let i = 0; i < 250; i++) processedNoteIds.delete(idsArray[i]);
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
  migrateSecrets();
  await initLedger();
  await initWarmMemory();
  initColdMemory();
  initEmbeddingService();
  await initJobStore();
  await initNotes();
  await initKanban();
  initTasks();
  initSkillRequestStore();
  initSkillMetricsStore();

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

  // ---- Ollama model management endpoints ----
  app.get("/models", async (_req, res) => {
    try {
      const models = await getLocalModels();
      res.json({ models });
    } catch (err) {
      res.status(502).json({ error: "Failed to reach Ollama" });
    }
  });

  app.get("/models/status", async (_req, res) => {
    const available = await isOllamaAvailable();
    res.json({ available });
  });

  app.post("/models/pull", async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Missing model name" });
      return;
    }

    const stream = await pullModelStream(name);
    if (!stream) {
      res.status(502).json({ error: "Failed to start pull from Ollama" });
      return;
    }

    // Stream Ollama's NDJSON progress as SSE
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim()) {
            res.write(`data: ${line}\n\n`);
          }
        }
      }
      // Flush remaining buffer
      if (buffer.trim()) {
        res.write(`data: ${buffer}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      console.error("[models] Stream error:", err);
      res.write(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`);
      res.end();
    }
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
    const envPath = path.join(PROJECT_ROOT, ".env");
    let envContent = "";
    try { envContent = await readFile(envPath, "utf-8"); } catch { }

    if (envContent.includes("GOOGLE_REFRESH_TOKEN=")) {
      envContent = envContent.replace(/GOOGLE_REFRESH_TOKEN=.*/, `GOOGLE_REFRESH_TOKEN=${refreshToken}`);
    } else {
      envContent += `\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;
    }
    await writeFile(envPath, envContent);
    process.env.GOOGLE_REFRESH_TOKEN = refreshToken;

    // Re-init calendar provider with real Google data
    initCalendarProvider();
    console.log("[oauth] Google authenticated, calendar provider switched to Google");

    // Redirect to dashboard
    const dashboardUrl = process.env.DASHBOARD_URL || `http://localhost:${PORT}`;
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
  bus.on("note:create", async (msg: any) => {
    await createNote(msg.content, "agent");
  });
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

  // Auto-create kanban cards from jobs IF they are classified as tasks
  bus.on("job:updated", async (job) => {
    // Only create card if classified as a task and not already created
    if (job.status === "running" && job.metadata?.is_task) {
      const existing = getCards().find(c => c.jobId === job.id);
      if (!existing) {
        const title = job.input.length > 50 ? job.input.substring(0, 47) + "..." : job.input;
        await createCard(title, "active", job.id);
      }
    }

    if (job.status === "done") {
      await updateCardByJobId(job.id, "done");
    }
    if (job.status === "failed") {
      await updateCardByJobId(job.id, "blocked");
    }
  });

  bus.on("job:completed", (job) => {
    // This is a redundancy for explicit completion events
    updateCardByJobId(job.id, "done");
  });
  bus.on("goals:updated", (goals) => {
    broadcast({ type: "goal:update", goals });
  });
  bus.on("system:update_progress", (msg) => broadcast({ type: "system:update_progress", ...msg }));
  bus.on("builder:status", (status) => broadcast({ type: "builder:status", status }));
  bus.on("builder:progress", (message) => broadcast({ type: "builder:progress", message }));
  bus.on("builder:report", (report) => broadcast({ type: "builder:report", report }));

  // 5. Handle WebSocket connections
  wss.on("connection", (socket, req) => {
    console.log("[ws] client connected");
    const addr = req.socket.remoteAddress ?? "";
    const isTrusted =
      addr === "127.0.0.1" ||
      addr === "::1" ||
      addr === "::ffff:127.0.0.1" ||
      addr.startsWith("100.");

    const ws = socket as typeof socket & { _session?: ReturnType<typeof createSession> };
    ws._session = createSession(isTrusted);
    const session = ws._session as ReturnType<typeof createSession>;

    // Send initial state
    socket.send(JSON.stringify({ type: "nucleus:state", state: "idle" }));
    socket.send(JSON.stringify({ type: "note:update", notes: getNotes() }));
    socket.send(JSON.stringify({ type: "kanban:update", cards: getCards() }));
    socket.send(JSON.stringify({ type: "config:update", config: getSystemConfig({ includeSecrets: session.isLocal }) }));
    socket.send(JSON.stringify({ type: "policy:update", nodes: NODES, edges: GRAPH_EDGES }));
    socket.send(JSON.stringify({ type: "goal:update", goals: getGoals() }));
    socket.send(JSON.stringify({ type: "task:update", tasks: getTasks() }));

    // Send initial builder status (if running)
    import("@cairn/builder").then(({ getBuilderStatus, getLatestReport }) => {
      socket.send(JSON.stringify({ type: "builder:status", status: getBuilderStatus() }));
      // Optionally send latest report? 
    });

    socket.on("message", async (raw) => {
      try {
        const msg: ClientMessage = JSON.parse(raw.toString());
        const authz = authorizeMessage(session, msg.type);
        if (!authz.allowed) {
          socket.send(JSON.stringify({ type: "error", message: authz.reason || "Denied" }));
          return;
        }

        if (msg.type === "builder:trigger") {
          if (!isSelfGrowthEnabled()) {
            socket.send(JSON.stringify({ type: "error", message: "Builder disabled unless CAIRN_MODE=grow or CAIRN_SELF_GROWTH=enabled" }));
            return;
          }
          const { runNightlyBuilder } = await import("@cairn/builder");
          runNightlyBuilder(undefined, msg.skillRequestId).catch(err => console.error("[gateway] Manual builder failed:", err));
          return;
        }


        if (msg.type === "auth:mobile") {
          const expectedToken = getMobileAuthToken();
          if (!expectedToken || msg.token !== expectedToken) {
            socket.send(JSON.stringify({ type: "error", message: "Invalid mobile auth token" }));
            return;
          }
          grantMobileSession(session);
          socket.send(JSON.stringify({ type: "mobile:authenticated", success: true, capabilities: getCapabilities(session) }));
          return;
        }

        switch (msg.type) {
          case "auth:dashboard": {
            const expectedToken = getDashboardAuthToken();
            if (!expectedToken || msg.token !== expectedToken) {
              socket.send(JSON.stringify({ type: "error", message: "Invalid dashboard auth token" }));
              return;
            }
            grantDashboardSession(session);
            socket.send(JSON.stringify({ type: "dashboard:authenticated", success: true, capabilities: getCapabilities(session) }));
            break;
          }
          case "chat:send": {
            if (!msg.text || msg.text.length > 10000) {
              socket.send(JSON.stringify({ type: "error", message: "Message too long (max 10000 chars)" }));
              break;
            }
            // Record that user is messaging from dashboard
            recordMessageSource("dashboard");
            console.log(`[gateway] chat:send received. Text: "${msg.text.substring(0, 20)}...", Attachments: ${msg.attachments?.length || 0}`);

            // Echo user message to all clients (with attachments if present)
            broadcast({
              type: "chat:message",
              message: {
                id: newId(),
                role: "user",
                text: msg.text,
                timestamp: shortTime(),
                attachments: msg.attachments,
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
            processMessage(msg.text, msg.attachments).catch((err) => {
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
          case "note:archive":
            await archiveNote(msg.id);
            break;
          case "note:delete":
            await deleteNote(msg.id);
            break;
          case "kanban:archive":
            await archiveCard(msg.id);
            break;
          case "kanban:restore":
            await restoreCard(msg.id);
            break;
          case "kanban:delete":
            await deleteCard(msg.id);
            break;
          case "kanban:update_status":
            await updateCardStatus(msg.id, msg.status);
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
          case "mobile:connect": {
            const pairingSecret = getMobilePairingSecret();
            if (!pairingSecret || msg.secret !== pairingSecret) {
              socket.send(JSON.stringify({ type: "error", message: "Invalid pairing secret" }));
              return;
            }
            console.log("[ws] Mobile app authenticated");
            grantMobileSession(session);
            socket.send(JSON.stringify({ type: "mobile:authenticated", success: true, capabilities: getCapabilities(session) }));
            // Send initial state
            socket.send(JSON.stringify({ type: "nucleus:state", state: "idle" }));
            socket.send(JSON.stringify({ type: "note:update", notes: getNotes() }));
            socket.send(JSON.stringify({ type: "goal:update", goals: getGoals() }));
            socket.send(JSON.stringify({ type: "task:update", tasks: getTasks() }));
            break;
          }
          case "mobile:send": {
            // Mobile app sending a message
            recordMessageSource("mobile");

            // Echo to dashboard/other clients
            broadcast({
              type: "chat:message",
              message: {
                id: newId(),
                role: "user",
                text: msg.text,
                timestamp: shortTime(),
                source: "mobile"
              },
            });

            // Process via LLM
            if (!isLLMAvailable()) {
              broadcast({ type: "error", message: "LLM unavailable" });
              break;
            }
            processMessage(msg.text).catch(console.error);
            break;
          }
          case "config:set_mobile_config": {
            await setMobileConfig(msg.enabled, msg.defaultClient);
            broadcast({ type: "config:update", config: getSystemConfig() });
            break;
          }
          case "config:set_local_mode": {
            await setLocalMode(msg.enabled);
            broadcast({ type: "config:update", config: getSystemConfig() });
            break;
          }
          case "config:request_sync": {
            socket.send(JSON.stringify({ type: "config:update", config: getSystemConfig({ includeSecrets: session.isLocal }) }));
            socket.send(JSON.stringify({ type: "policy:update", nodes: NODES, edges: GRAPH_EDGES }));
            break;
          }
          case "job:get": {
            const { getJob } = await import("@cairn/orchestrator");
            const job = await getJob(msg.id);
            if (job) {
              socket.send(JSON.stringify({ type: "job:details", job }));
            }
            break;
          }
          case "goal:create": {
            const title = (msg.title || "").slice(0, 200);
            const successDef = (msg.success_definition || "").slice(0, 1000);
            if (!title) { socket.send(JSON.stringify({ type: "error", message: "Goal title required" })); break; }
            const goal = createGoalFactory(title, { success_definition: successDef });

            // Add initial timeline event
            goal.timeline = [{
              id: newId(),
              timestamp: shortTime(),
              type: "created",
              message: "Goal created",
              agent: "user"
            }];

            saveGoal(goal);
            // Broadcast updated goals list
            broadcast({ type: "goal:update", goals: getGoals() });

            // Trigger proactive scoping message
            const scopingMessage = `I see you've created a new goal: "${goal.title}".\n\nWould you like me to help you scope this out? I can help create a timeline, break it down into milestones, or suggest immediate next steps.`;

            bus.emit("chat:message", {
              id: newId(),
              role: "cairn",
              text: scopingMessage,
              timestamp: shortTime(),
            });

            // Inject into chat history so Gatekeeper sees this context
            const history = warmGet<{ role: string; content: string }[]>("chat_history") || [];
            warmSet("chat_history", [
              ...history,
              { role: "assistant", content: scopingMessage }
            ].slice(-10));
            break;
          }
          case "goal:update": {
            await updateGoal(msg.id, msg.changes);
            break;
          }
          case "goal:delete": {
            await deleteGoal(msg.id);
            break;
          }
          case "task:create": {
            const taskTitle = (msg.title || "").slice(0, 200);
            if (!taskTitle) { socket.send(JSON.stringify({ type: "error", message: "Task title required" })); break; }
            createTask({
              title: taskTitle,
              type: msg.taskType,
              // Map schedule to fields
              due_date: msg.schedule?.due,
              scheduled_date: msg.schedule?.on,
              recurrence_rule: msg.schedule?.recurrence
            });
            // Manual broadcast until package emits event
            broadcast({ type: "task:update", tasks: getTasks() });
            break;
          }
          case "task:update": {
            if (msg.changes.status === 'done') {
              completeTask(msg.id);
            } else {
              updateTask(msg.id, msg.changes);
            }
            broadcast({ type: "task:update", tasks: getTasks() });
            break;
          }
          case "task:delete": {
            deleteTask(msg.id);
            broadcast({ type: "task:update", tasks: getTasks() });
            break;
          }
          case "archive:get_logs": {
            const { getAllDocuments } = await import("@cairn/memory");
            const docs = getAllDocuments().filter(d => d.source === "document");
            socket.send(JSON.stringify({ type: "archive:logs", logs: docs }));
            break;
          }
          case "archive:get_system_docs": {
            const docs = loadSystemDocs();
            socket.send(JSON.stringify({ type: "archive:system_docs", docs }));
            break;
          }
          case "skillRequests:list": {
            const status = msg.status as SkillRequestStatus | undefined;
            const requests = listSkillRequests(status);
            socket.send(JSON.stringify({ type: "skillRequests:list:result", requests }));
            break;
          }
          case "skillMetrics:list": {
            const metrics = listSkillMetrics();
            socket.send(JSON.stringify({ type: "skillMetrics:list:result", metrics }));
            break;
          }
          case "skillMetrics:get": {
            const metric = getSkillMetrics(msg.skill_id);
            socket.send(JSON.stringify({
              type: "skillMetrics:get:result",
              metric,
            }));
            break;
          }
          case "ping":
            socket.send(JSON.stringify({ type: "pong" }));
            break;
          case "system:update": {
            if (!isSelfGrowthEnabled()) {
              socket.send(JSON.stringify({ type: "error", message: "system:update disabled unless CAIRN_MODE=grow or CAIRN_SELF_GROWTH=enabled" }));
              break;
            }

            const { execSync } = await import("child_process");
            const sendProgress = (stage: "pulling" | "building" | "restarting" | "error", message: string) => {
              socket.send(JSON.stringify({ type: "system:update_progress", stage, message }));
            };

            try {
              sendProgress("pulling", "Pulling latest changes from git...");
              const pullOutput = execSync("git pull", { cwd: PROJECT_ROOT, timeout: 30000 }).toString().trim();
              sendProgress("pulling", pullOutput);

              if (pullOutput.includes("Already up to date")) {
                sendProgress("building", "No changes to pull. Rebuilding anyway...");
              }

              sendProgress("building", "Running pnpm build...");
              execSync("pnpm build", { cwd: PROJECT_ROOT, timeout: 120000 });
              sendProgress("building", "Build successful.");

              sendProgress("restarting", "Restarting gateway in 2 seconds...");

              // Give the WS message time to flush before exit
              setTimeout(() => {
                console.log("[gateway] Self-update complete, exiting for restart...");
                process.exit(0);
              }, 2000);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error("[gateway] system:update failed:", msg);
              sendProgress("error", `Update failed: ${msg.substring(0, 500)}`);
            }
            break;
          }
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

  // 13. Start autonomous task agent (goal-driven task creation)
  startTaskAgent();

  // 14. Serve dashboard static files (single-process production deployment)
  const dashboardDist = path.join(PROJECT_ROOT, "apps/dashboard/dist");
  if (fs.existsSync(dashboardDist)) {
    app.use(express.static(dashboardDist));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(dashboardDist, "index.html"));
    });
    console.log(`[gateway] serving dashboard from ${dashboardDist}`);
  }

  // 14. Listen
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

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`[gateway] ${signal} received, shutting down...`);
  bus.removeAllListeners();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
