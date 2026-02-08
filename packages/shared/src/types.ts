// ---- Job lifecycle ----

export type JobStatus = "queued" | "running" | "waiting" | "done" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  input: string;
  intent?: string;
  complexity?: "small" | "medium" | "large";
  nodes_traversed: string[];
  artifacts: Artifact[];
  costs_so_far: CostEntry[];
  created_at: string;
  updated_at: string;
}

// ---- Artifacts ----

export interface Artifact {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  origin_node: string;
  created_at: string;
}

// ---- Cost tracking ----

export interface CostEntry {
  node: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  timestamp: string;
}

// ---- Memory ----

export type MemoryTier = "hot" | "warm" | "cold";

// ---- Node configuration (policy-enforced) ----

export interface NodeConfig {
  name: string;
  allowed_callers: string[];
  allowed_tools: string[];
  memory_access: MemoryTier[];
  memory_write: ("hot" | "warm")[];
  max_runtime_seconds: number;
  max_tokens_per_call: number;
  assigned_model: string;
}

// ---- Ledger ----

export type LedgerEntryType =
  | "thought" | "tool" | "file" | "api" | "agent" | "error" | "cost" | "security";

export interface LedgerEntry {
  id: string;
  sequence: number;
  timestamp: string;
  type: LedgerEntryType;
  node: string;
  job_id: string;
  content: string;
  metadata?: Record<string, unknown>;
  prev_hash: string;
  hash: string;
}

// ---- UI-facing types (must match UI/src/app/components/cairn/types.ts) ----

export type NucleusState = "idle" | "thinking" | "tooling" | "waiting" | "error";

export interface SubAgent {
  id: string;
  name: string;
  action: string;
  model: string;
}

export type ChatRole = "user" | "cairn";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
  tools?: string[];
  source?: "telegram" | "dashboard";
}

export type NoteStatus = "unread" | "read";

export interface Note {
  id: string;
  content: string;
  status: NoteStatus;
  timestamp: string;
}

export type KanbanStatus = "backlog" | "active" | "blocked" | "done";

export interface KanbanCard {
  id: string;
  title: string;
  status: KanbanStatus;
  jobId?: string;
  project?: string;    // Category: "general", "work", or custom project name
  archived?: boolean;  // True if moved to archive page
  createdAt: string;
  updatedAt: string;
}

export type LogType = "thought" | "tool" | "file" | "api" | "agent" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  type: LogType;
  content: string;
}
export interface SystemConfig {
  openai_api_key?: string;
  heartbeat_interval_ms: number;
  monthly_spend_limit_usd: number;
}
