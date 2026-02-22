import { EventEmitter } from "events";
import type {
  Job,
  LogEntry,
  ChatMessage,
  Note,
  KanbanCard,
  NucleusState,
  SubAgent,
} from "./types.js";

export interface CairnEvents {
  "job:created": (job: Job) => void;
  "job:updated": (job: Job) => void;
  "job:completed": (job: Job) => void;
  "job:failed": (job: Job, error: Error) => void;
  "nucleus:state": (state: NucleusState, subAgents?: SubAgent[]) => void;
  "log:entry": (entry: LogEntry) => void;
  "chat:message": (message: ChatMessage) => void;
  "note:updated": (notes: Note[]) => void;
  "kanban:updated": (cards: KanbanCard[]) => void;
  "goals:updated": (goals: import("./types.js").Goal[]) => void;
  "tasks:updated": (tasks: import("./types.js").Task[]) => void;
  "cold:promoted": (info: { documentId: string; title: string; chunkCount: number; tokenCount: number }) => void;
  "note:create": (data: { content: string }) => void;
  "builder:issue": (issue: any) => void;
  "builder:status": (status: "idle" | "running" | "failed" | "completed") => void;
  "builder:progress": (message: string) => void;
  "builder:report": (report: any) => void;
  "builder:log": (data: { specId: string; msg: string }) => void;
  "system:update_progress": (data: { stage: "error" | "pulling" | "building" | "restarting"; message: string }) => void; // also needed by gateway
}

class TypedEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<K extends keyof CairnEvents>(
    event: K,
    ...args: Parameters<CairnEvents[K]>
  ): void {
    this.emitter.emit(event, ...args);
  }

  on<K extends keyof CairnEvents>(event: K, handler: CairnEvents[K]): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  off<K extends keyof CairnEvents>(event: K, handler: CairnEvents[K]): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}

export const bus = new TypedEventBus();
