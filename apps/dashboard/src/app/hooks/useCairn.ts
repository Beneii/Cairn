import { useState, useEffect, useRef, useCallback } from "react";
import type {
  ChatMessage,
  Note,
  KanbanCard,
  LogEntry,
  SubAgent,
} from "../components/cairn/types";
import type { NucleusState } from "../components/cairn/Nucleus";

const WS_URL =
  import.meta.env.VITE_WS_URL || "ws://localhost:3100/ws";

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
    has_openai_key: boolean;
    has_telegram_token: boolean;
    telegram_admin_chat_id: string;
  };
  policy: {
    nodes: Record<string, any>;
    edges: Record<string, string[]>;
  };
}

export function useCairn() {
  const [state, setState] = useState<CairnState>({
    connected: false,
    nucleusState: "idle",
    subAgents: [],
    messages: [],
    notes: [],
    kanbanCards: [],
    logs: [],
    config: {
      heartbeat_interval_ms: 60000,
      monthly_spend_limit_usd: 50,
      has_openai_key: false,
      has_telegram_token: false,
      telegram_admin_chat_id: "",
    },
    policy: {
      nodes: {},
      edges: {},
    }
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(WS_URL);
    wsRef.current = socket;

    socket.onopen = () => {
      setState((s) => ({ ...s, connected: true }));
      console.log("[cairn] connected");
    };

    socket.onclose = () => {
      setState((s) => ({ ...s, connected: false }));
      console.log("[cairn] disconnected, reconnecting...");
      reconnectTimer.current = setTimeout(connect, 2000);
    };

    socket.onerror = () => {
      socket.close();
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case "chat:message":
            setState((s) => ({
              ...s,
              messages: [...s.messages, msg.message],
            }));
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
        }
      } catch {
        // Ignore malformed messages
      }
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendChat = useCallback((text: string) => {
    wsRef.current?.send(JSON.stringify({ type: "chat:send", text }));
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
  };
}
