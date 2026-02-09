import type {
  ChatMessage,
  LogEntry,
  Note,
  KanbanCard,
  NucleusState,
  SubAgent,
  Job,
  NodeConfig,
  ProactiveConfig,
} from "./types.js";

// ---- Client → Server ----

export type ClientMessage =
  | { type: "chat:send"; text: string }
  | { type: "note:create"; content: string }
  | { type: "note:mark_read"; id: string }
  | { type: "note:resurface"; id: string }
  | { type: "kanban:archive"; id: string }
  | { type: "kanban:restore"; id: string }
  | { type: "kanban:set_project"; id: string; project: string }
  | { type: "config:set_openai_key"; key: string }
  | { type: "config:set_telegram_token"; token: string }
  | { type: "config:set_telegram_admin_chat_id"; chat_id: string }
  | { type: "config:set_heartbeat"; interval_ms: number }
  | { type: "config:set_spend_limit"; limit_usd: number }
  | { type: "config:set_decision_limit"; limit: number }
  | { type: "config:set_interaction_limit"; limit: number }
  | { type: "config:set_proactive_config"; config: Partial<ProactiveConfig> }
  | { type: "config:request_sync" }
  | { type: "ping" };

// ---- Server → Client ----

export type ServerMessage =
  | { type: "chat:message"; message: ChatMessage }
  | { type: "nucleus:state"; state: NucleusState; subAgents?: SubAgent[] }
  | { type: "log:entry"; entry: LogEntry }
  | { type: "note:update"; notes: Note[] }
  | { type: "kanban:update"; cards: KanbanCard[] }
  | { type: "job:update"; job: Pick<Job, "id" | "status" | "nodes_traversed"> }
  | { type: "config:update"; config: { heartbeat_interval_ms: number, monthly_spend_limit_usd: number, max_decisions_per_day: number, max_interactions_per_day: number, has_openai_key: boolean, has_telegram_token: boolean, telegram_admin_chat_id: string, has_google_calendar: boolean, proactive?: ProactiveConfig } }
  | { type: "policy:update"; nodes: Record<string, NodeConfig>, edges: Record<string, string[]> }
  | { type: "error"; message: string; code?: string }
  | { type: "pong" };
