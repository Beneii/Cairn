import { useState, useEffect, useRef, useCallback } from "react";
import type {
  ChatMessage,
  ChatAttachment,
  Note,
  KanbanCard,
  LogEntry,
  SubAgent,
  ProactiveConfig,
  SkillRequest,
  SkillMetric,
  ChatActivity,
} from "../components/cairn/types";
import type { NucleusState } from "../components/cairn/Nucleus";
import { getWsUrl, getApiBase, getMode, getDashboardAuthToken } from "../../config/runtime";

interface CairnState {
  connected: boolean;
  nucleusState: NucleusState;
  subAgents: SubAgent[];
  messages: ChatMessage[];
  chatActivity: ChatActivity;
  notes: Note[];
  kanbanCards: KanbanCard[];
  logs: LogEntry[];
  config: {
    heartbeat_interval_ms: number;
    monthly_spend_limit_usd: number;
    max_decisions_per_day: number;
    max_interactions_per_day: number;
    has_openai_key: boolean;
    has_telegram_token: boolean;
    telegram_admin_chat_id: string;
    has_google_calendar: boolean;
    proactive?: ProactiveConfig;
    mobile_app_enabled: boolean;
    default_client: "telegram" | "mobile";
    local_mode_enabled: boolean;
  };
  goals: any[]; // refined in next step
  tasks: any[];
  policy: {
    nodes: Record<string, any>;
    edges: Record<string, string[]>;
  };
  archiveLogs: any[];
  archiveSystemDocs: any[];
  skillRequests: SkillRequest[];
  skillMetrics: SkillMetric[];
  lastJobDetails: any | null;
  updateProgress: {
    stage: "idle" | "pulling" | "building" | "restarting" | "error";
    message: string;
  } | null;
  // Diagnostics
  diagnostics: {
    wsUrl: string;
    apiBase: string;
    mode: string;
    lastPong: string | null;
    lastError: string | null;
    reconnectCount: number;
  };
  // Builder
  builder: {
    status: "idle" | "running" | "failed" | "completed";
    progress?: string;
    lastReport?: any;
  };
}

export function useCairn() {
  const wsUrl = getWsUrl();
  const apiBase = getApiBase();
  const mode = getMode();
  const dashboardAuthToken = getDashboardAuthToken();

  const [state, setState] = useState<CairnState>({
    connected: false,
    nucleusState: "idle",
    subAgents: [],
    messages: [],
    chatActivity: {
      active: false,
      phase: "idle",
      label: "Idle",
      startedAt: null,
      pendingCount: 0,
    },
    notes: [],
    kanbanCards: [],
    logs: [],
    goals: [],
    tasks: [],
    archiveLogs: [],
    archiveSystemDocs: [],
    skillRequests: [],
    skillMetrics: [],
    lastJobDetails: null,
    updateProgress: null,
    config: {
      heartbeat_interval_ms: 60000,
      monthly_spend_limit_usd: 50,
      max_decisions_per_day: 10,
      max_interactions_per_day: 5,
      has_openai_key: false,
      has_telegram_token: false,
      telegram_admin_chat_id: "",
      has_google_calendar: false,
      mobile_app_enabled: false,
      default_client: "telegram",
      local_mode_enabled: false,
    },
    policy: {
      nodes: {},
      edges: {},
    },
    diagnostics: {
      wsUrl,
      apiBase,
      mode,
      lastPong: null,
      lastError: null,
      reconnectCount: 0,
    },
    builder: {
      status: "idle",
    },
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  const isoClock = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const resolvePendingMessage = (messages: ChatMessage[], serverMessage: ChatMessage) => {
    const index = messages.findIndex((m) =>
      m.pending &&
      m.role === "user" &&
      m.source === "dashboard" &&
      m.text === serverMessage.text &&
      (m.attachments?.length || 0) === (serverMessage.attachments?.length || 0)
    );

    if (index === -1) return { messages: [...messages, serverMessage], replaced: false };

    const next = [...messages];
    next[index] = { ...serverMessage, deliveryStatus: undefined, pending: false };
    return { messages: next, replaced: true };
  };

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;
      if (wsRef.current?.readyState === WebSocket.OPEN ||
        wsRef.current?.readyState === WebSocket.CONNECTING) return;

      console.log(`[cairn] connecting to ${wsUrl}`);
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!mountedRef.current) { socket.close(); return; }

        // Always send auth:dashboard (with token if available) to upgrade session capabilities
        console.log("[cairn] sending auth:dashboard", { hasToken: !!dashboardAuthToken });
        socket.send(JSON.stringify({ type: "auth:dashboard", token: dashboardAuthToken }));

        // Request initial skill data
        socket.send(JSON.stringify({ type: "skillRequests:list" }));
        socket.send(JSON.stringify({ type: "skillMetrics:list" }));

        setState((s) => ({
          ...s,
          connected: true,
          diagnostics: { ...s.diagnostics, lastError: null },
        }));
        console.log("[cairn] connected");
      };

      socket.onclose = () => {
        if (!mountedRef.current) return;
        setState((s) => ({
          ...s,
          connected: false,
          diagnostics: { ...s.diagnostics, reconnectCount: s.diagnostics.reconnectCount + 1 },
        }));
        console.log("[cairn] disconnected, reconnecting in 2s...");
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        setState((s) => ({
          ...s,
          diagnostics: { ...s.diagnostics, lastError: "WebSocket connection error" },
        }));
        socket.close();
      };

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case "chat:message":
              setState((s) => {
                if (s.messages.some((m) => m.id === msg.message.id)) return s;

                if (msg.message.role === "user") {
                  const resolved = resolvePendingMessage(s.messages, msg.message);
                  const pendingCount = resolved.messages.filter((m) => m.pending).length;
                  return {
                    ...s,
                    messages: resolved.messages,
                    chatActivity: pendingCount > 0
                      ? {
                          ...s.chatActivity,
                          active: true,
                          phase: "thinking",
                          label: "Cairn is working on your request…",
                          pendingCount,
                        }
                      : s.chatActivity,
                  };
                }

                const pendingCount = s.messages.filter((m) => m.pending).length;
                return {
                  ...s,
                  messages: [...s.messages, msg.message],
                  chatActivity: pendingCount > 0
                    ? {
                        active: false,
                        phase: "idle",
                        label: "Reply received",
                        startedAt: null,
                        pendingCount: 0,
                      }
                    : s.chatActivity,
                };
              });
              break;
            case "nucleus:state":
              setState((s) => ({
                ...s,
                nucleusState: msg.state,
                subAgents: msg.subAgents || [],
              }));
              break;
            case "log:entry":
              setState((s) => ({
                ...s,
                logs: [...s.logs, msg.entry],
              }));
              break;
            case "note:update":
              setState((s) => ({ ...s, notes: msg.notes }));
              break;
            case "kanban:update":
              setState((s) => ({ ...s, kanbanCards: msg.cards }));
              break;
            case "config:update":
              setState((s) => ({ ...s, config: msg.config }));
              break;
            case "policy:update":
              setState((s) => ({ ...s, policy: { nodes: msg.nodes, edges: msg.edges } }));
              break;
            case "goal:update":
              setState((s) => ({ ...s, goals: msg.goals }));
              break;
            case "task:update":
              setState((s) => ({ ...s, tasks: msg.tasks }));
              break;
            case "archive:logs":
              setState((s) => ({ ...s, archiveLogs: msg.logs }));
              break;
            case "archive:system_docs":
              setState((s) => ({ ...s, archiveSystemDocs: msg.docs }));
              break;
            case "job:details":
              setState((s) => ({ ...s, lastJobDetails: msg.job }));
              break;
            case "skillRequests:list:result":
              setState((s) => ({ ...s, skillRequests: msg.requests }));
              break;
            case "skillMetrics:list:result":
              setState((s) => ({ ...s, skillMetrics: msg.metrics }));
              break;
            case "skillMetrics:get:result":
              setState((s) => {
                const index = s.skillMetrics.findIndex(m => m.skill_id === msg.metric.skill_id);
                if (index === -1) return { ...s, skillMetrics: [...s.skillMetrics, msg.metric] };
                const newMetrics = [...s.skillMetrics];
                newMetrics[index] = msg.metric;
                return { ...s, skillMetrics: newMetrics };
              });
              break;
            case "pong":
              setState((s) => ({
                ...s,
                diagnostics: { ...s.diagnostics, lastPong: new Date().toISOString() },
              }));
              break;
            case "dashboard:authenticated":
              console.log("[cairn] session authenticated by server");
              break;
            case "system:update_progress":
              setState((s) => ({
                ...s,
                updateProgress: { stage: msg.stage, message: msg.message },
              }));
              break;
            case "builder:status":
              setState((s) => ({ ...s, builder: { ...s.builder, status: msg.status } }));
              break;
            case "builder:progress":
              setState((s) => ({ ...s, builder: { ...s.builder, progress: msg.message } }));
              break;
            case "builder:report":
              setState((s) => ({ ...s, builder: { ...s.builder, lastReport: msg.report } }));
              break;
          }
        } catch {
          // Ignore malformed messages
        }
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onmessage = null;
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
      }
    };
  }, [wsUrl, dashboardAuthToken]);

  const sendChat = useCallback((text: string, attachments?: ChatAttachment[]) => {
    const payload: Record<string, unknown> = { type: "chat:send", text };
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }

    const optimisticId = `local-${crypto.randomUUID()}`;
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      role: "user",
      text,
      timestamp: isoClock(),
      source: "dashboard",
      attachments,
      deliveryStatus: "queued",
      pending: true,
    };

    setState((s) => {
      const messages = [...s.messages, optimisticMessage];
      const pendingCount = messages.filter((m) => m.pending).length;
      return {
        ...s,
        messages,
        chatActivity: {
          active: true,
          phase: "queued",
          label: "Sending request…",
          startedAt: Date.now(),
          pendingCount,
        },
      };
    });

    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === optimisticId
            ? { ...m, deliveryStatus: "sent" as const }
            : m
        ),
        chatActivity: {
          ...s.chatActivity,
          active: true,
          phase: "thinking",
          label: "Request sent. Cairn is thinking…",
        },
      }));
    } else {
      setState((s) => ({
        ...s,
        messages: s.messages.map((m) =>
          m.id === optimisticId
            ? { ...m, deliveryStatus: "failed" as const, pending: false }
            : m
        ),
        chatActivity: {
          active: true,
          phase: "failed",
          label: "Not connected. Message not sent.",
          startedAt: s.chatActivity.startedAt,
          pendingCount: s.messages.filter((m) => m.pending && m.id !== optimisticId).length,
        },
      }));
    }
  }, []);

  const createNote = useCallback((content: string) => {
    wsRef.current?.send(JSON.stringify({ type: "note:create", content }));
  }, []);

  const markNoteRead = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: "note:mark_read", id }));
  }, []);

  const resurfaceNote = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: "note:resurface", id }));
  }, []);

  const setOpenAIKey = useCallback((key: string) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_openai_key", key }));
  }, []);

  const setHeartbeat = useCallback((interval_ms: number) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_heartbeat", interval_ms }));
  }, []);

  const setSpendLimit = useCallback((limit_usd: number) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_spend_limit", limit_usd }));
  }, []);

  const setTelegramToken = useCallback((token: string) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_telegram_token", token }));
  }, []);

  const setTelegramAdminChatId = useCallback((chat_id: string) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_telegram_admin_chat_id", chat_id }));
  }, []);

  const setDecisionLimit = useCallback((limit: number) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_decision_limit", limit }));
  }, []);

  const setInteractionLimit = useCallback((limit: number) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_interaction_limit", limit }));
  }, []);

  const archiveCard = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: "kanban:archive", id }));
  }, []);

  const restoreCard = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: "kanban:restore", id }));
  }, []);

  const deleteCard = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: "kanban:delete", id }));
  }, []);

  const updateCardStatus = useCallback((id: string, status: string) => {
    wsRef.current?.send(JSON.stringify({ type: "kanban:update_status", id, status }));
  }, []);

  const setCardProject = useCallback((id: string, project: string) => {
    wsRef.current?.send(JSON.stringify({ type: "kanban:set_project", id, project }));
  }, []);

  const setProactiveConfig = useCallback((config: Partial<ProactiveConfig>) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_proactive_config", config }));
  }, []);

  const createGoal = useCallback((title: string, success_definition: string) => {
    wsRef.current?.send(JSON.stringify({ type: "goal:create", title, success_definition }));
  }, []);

  const updateGoal = useCallback((id: string, changes: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify({ type: "goal:update", id, changes }));
  }, []);

  const deleteGoal = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: "goal:delete", id }));
  }, []);

  const createTask = useCallback((title: string, type: "one-off" | "recurring", schedule?: any) => {
    wsRef.current?.send(JSON.stringify({ type: "task:create", title, taskType: type, schedule }));
  }, []);

  const updateTask = useCallback((id: string, changes: Record<string, unknown>) => {
    wsRef.current?.send(JSON.stringify({ type: "task:update", id, changes }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: "task:delete", id }));
  }, []);

  const refreshArchiveLogs = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "archive:get_logs" }));
  }, []);

  const refreshSystemDocs = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "archive:get_system_docs" }));
  }, []);

  const getJobDetails = useCallback((id: string) => {
    wsRef.current?.send(JSON.stringify({ type: "job:get", id }));
  }, []);

  const refreshSkills = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "skillRequests:list" }));
    wsRef.current?.send(JSON.stringify({ type: "skillMetrics:list" }));
  }, []);

  const setMobileConfig = useCallback((enabled: boolean, defaultClient: "telegram" | "mobile") => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_mobile_config", enabled, defaultClient }));
  }, []);

  const setLocalMode = useCallback((enabled: boolean) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_local_mode", enabled }));
  }, []);

  const triggerUpdate = useCallback(() => {
    setState((s) => ({ ...s, updateProgress: { stage: "pulling" as const, message: "Starting update..." } }));
    wsRef.current?.send(JSON.stringify({ type: "system:update" }));
  }, []);

  const triggerBuilder = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: "builder:trigger" }));
  }, []);

  return {
    ...state,
    sendChat,
    createNote,
    markNoteRead,
    resurfaceNote,
    setOpenAIKey,
    setHeartbeat,
    setSpendLimit,
    setTelegramToken,
    setTelegramAdminChatId,
    setDecisionLimit,
    setInteractionLimit,
    archiveCard,
    restoreCard,
    deleteCard,
    updateCardStatus,
    setCardProject,
    setProactiveConfig,
    setMobileConfig,
    createGoal,
    updateGoal,
    deleteGoal,
    createTask,
    updateTask,
    deleteTask,
    refreshArchiveLogs,
    refreshSystemDocs,
    getJobDetails,
    refreshSkills,
    setLocalMode,
    triggerUpdate,
    builder: state.builder,
    triggerBuilder,
  };
}
