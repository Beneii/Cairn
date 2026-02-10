import { useState, useEffect, useRef, useCallback } from "react";
import type {
  ChatMessage,
  ChatAttachment,
  Note,
  KanbanCard,
  LogEntry,
  SubAgent,
  ProactiveConfig,
} from "../components/cairn/types";
import type { NucleusState } from "../components/cairn/Nucleus";
import { getWsUrl, getApiBase, getMode } from "../../config/runtime";

interface CairnState {
  connected: boolean;
  nucleusState: NucleusState;
  subAgents: SubAgent[];
  messages: ChatMessage[];
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
    mobile_pairing_secret?: string;
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
  lastJobDetails: any | null;
  // Diagnostics
  diagnostics: {
    wsUrl: string;
    apiBase: string;
    mode: string;
    lastPong: string | null;
    lastError: string | null;
    reconnectCount: number;
  };
}

export function useCairn() {
  const wsUrl = getWsUrl();
  const apiBase = getApiBase();
  const mode = getMode();

  const [state, setState] = useState<CairnState>({
    connected: false,
    nucleusState: "idle",
    subAgents: [],
    messages: [],
    notes: [],
    kanbanCards: [],
    logs: [],
    goals: [],
    tasks: [],
    archiveLogs: [],
    archiveSystemDocs: [],
    lastJobDetails: null,
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
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

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
                return { ...s, messages: [...s.messages, msg.message] };
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
            case "pong":
              setState((s) => ({
                ...s,
                diagnostics: { ...s.diagnostics, lastPong: new Date().toISOString() },
              }));
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
  }, [wsUrl]);

  const sendChat = useCallback((text: string, attachments?: ChatAttachment[]) => {
    const payload: Record<string, unknown> = { type: "chat:send", text };
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments;
    }
    wsRef.current?.send(JSON.stringify(payload));
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

  const setMobileConfig = useCallback((enabled: boolean, defaultClient: "telegram" | "mobile") => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_mobile_config", enabled, defaultClient }));
  }, []);

  const setLocalMode = useCallback((enabled: boolean) => {
    wsRef.current?.send(JSON.stringify({ type: "config:set_local_mode", enabled }));
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
    setLocalMode,
  };
}
