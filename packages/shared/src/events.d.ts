import type { Job, LogEntry, ChatMessage, Note, KanbanCard, NucleusState, SubAgent } from "./types.js";
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
    "goals:updated": (goals: any[]) => void;
    "tasks:updated": (tasks: any[]) => void;
    "cold:promoted": (info: {
        documentId: string;
        title: string;
        chunkCount: number;
        tokenCount: number;
    }) => void;
    "note:create": (data: {
        content: string;
    }) => void;
    "builder:issue": (issue: any) => void;
    "builder:status": (status: "idle" | "running" | "failed" | "completed") => void;
    "builder:progress": (message: string) => void;
    "builder:report": (report: any) => void;
    "builder:log": (data: {
        specId: string;
        msg: string;
    }) => void;
    "system:update_progress": (data: {
        stage: "error" | "pulling" | "building" | "restarting";
        message: string;
    }) => void;
}
declare class TypedEventBus {
    private emitter;
    constructor();
    emit<K extends keyof CairnEvents>(event: K, ...args: Parameters<CairnEvents[K]>): void;
    on<K extends keyof CairnEvents>(event: K, handler: CairnEvents[K]): void;
    off<K extends keyof CairnEvents>(event: K, handler: CairnEvents[K]): void;
    removeAllListeners(): void;
}
export declare const bus: TypedEventBus;
export {};
//# sourceMappingURL=events.d.ts.map