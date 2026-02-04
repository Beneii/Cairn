import type {
  ChatMessage,
  LogEntry,
  Note,
  KanbanCard,
  NucleusState,
  SubAgent,
  Job,
} from "./types.js";

// ---- Client → Server ----

export type ClientMessage =
  | { type: "chat:send"; text: string }
  | { type: "note:create"; content: string }
  | { type: "note:mark_read"; id: string }
  | { type: "note:resurface"; id: string }
  | { type: "ping" };

// ---- Server → Client ----

export type ServerMessage =
  | { type: "chat:message"; message: ChatMessage }
  | { type: "nucleus:state"; state: NucleusState; subAgents?: SubAgent[] }
  | { type: "log:entry"; entry: LogEntry }
  | { type: "note:update"; notes: Note[] }
  | { type: "kanban:update"; cards: KanbanCard[] }
  | { type: "job:update"; job: Pick<Job, "id" | "status" | "nodes_traversed"> }
  | { type: "error"; message: string; code?: string }
  | { type: "pong" };
