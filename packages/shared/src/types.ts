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
  metadata?: Record<string, any>;
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
  local_model: string;
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

export type NucleusState = "idle" | "thinking" | "tooling" | "waiting" | "error" | "researching";

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
  source?: "telegram" | "dashboard" | "mobile";
}

export type NoteStatus = "unread" | "read" | "archived";

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
  archivedAt?: string; // ISO timestamp when archived
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
  max_decisions_per_day: number;
  max_interactions_per_day: number;
  local_mode_enabled: boolean;
}

export type OllamaModel =
  | "phi-3.5-mini"
  | "gemma3:12b"
  | "phi-3-mini"
  | "gemma3:4b"
  | "mistral:7b-instruct"
  | "deepseek-coder-v2:6.7b"
  | "qwen2.5:7b";

// ---- Proactive Intelligence ----

export interface ProactiveConfig {
  enabled: boolean;
  maxDailyNudges: number;
  quietHoursStart: number; // 0-23
  quietHoursEnd: number;   // 0-23
  minHoursBetweenNudges: number;
  nudgeTypes: {
    goal_reminder: boolean;
    calendar_aware: boolean;
    anomaly_alert: boolean;
    pattern_suggestion: boolean;
  };
}

// ---- Goals ----

export type GoalStatus =
  | "active"
  | "paused"
  | "blocked"
  | "completed"
  | "abandoned";

export type TimeHorizon = "1mo" | "3mo" | "6mo" | "12mo";

export type GoalPriority = "hard" | "soft";

export interface ActionLog {
  id: string;
  timestamp: string;
  action: string;
  result: "success" | "failed" | "pending" | "skipped";
  details?: string;
}

export interface Goal {
  id: string;
  title: string;
  status: GoalStatus;

  // Core definition
  time_horizon: TimeHorizon;
  priority: GoalPriority;
  success_definition: string;
  anti_goals: string[];
  metrics: string[];

  // Behavioral tuning
  allowed_interruption_level: number;
  review_cadence_days: number;
  confidence: number;

  // Connections
  related_projects: string[];

  // Scheduling
  last_reviewed?: string;
  next_review?: string;

  // Interruption budget
  max_interruptions_per_day: number;
  interruptions_today: number;

  // State
  blocked_reason?: string;

  // History
  actions_log: ActionLog[];
  timeline: GoalTimelineEvent[];

  // Metadata
  created_at: string;
  updated_at: string;
}

export interface GoalTimelineEvent {
  id: string;
  timestamp: string;
  type: "created" | "updated" | "milestone" | "comment" | "status_change";
  message: string;
  agent?: string; // "user" or agent name
}

// ---- Tasks ----

export type TaskStatus = "todo" | "done" | "archived";
export type TaskType = "one-off" | "recurring";

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  type: TaskType;

  // Scheduling
  due_date?: string;       // Hard deadline
  scheduled_date?: string; // Planned execution date (YYYY-MM-DD)

  // Recurrence (if type === recurring)
  recurrence_rule?: "daily" | "weekly" | "monthly";

  // Context
  source: "user" | "cairn";
  suggested_by_agent?: boolean; // If true, requires user approval

  // Metadata
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// ---- WebSocket Protocol ----

export type ClientMessage =
  | { type: "ping" }
  | { type: "chat:send"; text: string }
  | { type: "note:create"; content: string }
  | { type: "note:mark_read"; id: string }
  | { type: "note:resurface"; id: string }
  | { type: "note:archive"; id: string }
  | { type: "note:delete"; id: string }
  | { type: "kanban:archive"; id: string }
  | { type: "kanban:restore"; id: string }
  | { type: "kanban:set_project"; id: string; project: string }
  | { type: "config:request_sync" }
  | { type: "config:set_openai_key"; key: string }
  | { type: "config:set_heartbeat"; interval_ms: number }
  | { type: "config:set_spend_limit"; limit_usd: number }
  | { type: "config:set_decision_limit"; limit: number }
  | { type: "config:set_interaction_limit"; limit: number }
  | { type: "config:set_telegram_token"; token: string }
  | { type: "config:set_telegram_admin_chat_id"; chat_id: string }
  | { type: "config:set_proactive_config"; config: Partial<ProactiveConfig> }
  | { type: "config:set_mobile_config"; enabled: boolean; defaultClient: "telegram" | "mobile" }
  | { type: "config:set_local_mode"; enabled: boolean }
  | { type: "mobile:connect"; secret: string }
  | { type: "mobile:send"; text: string }
  | { type: "goal:create"; title: string; success_definition: string }
  | { type: "goal:update"; id: string; changes: Partial<Goal> }
  | { type: "goal:delete"; id: string }
  | { type: "task:create"; title: string; taskType: TaskType; schedule?: { due?: string; on?: string; recurrence?: "daily" | "weekly" | "monthly" } }
  | { type: "task:update"; id: string; changes: Partial<Task> }
  | { type: "task:delete"; id: string }
  | { type: "job:get"; id: string }
  | { type: "archive:get_logs" }
  | { type: "archive:get_system_docs" };

export type ServerMessage =
  | { type: "pong" }
  | { type: "error"; message: string }
  | { type: "nucleus:state"; state: NucleusState; subAgents?: SubAgent[] }
  | { type: "chat:message"; message: ChatMessage }
  | { type: "note:update"; notes: Note[] }
  | { type: "kanban:update"; cards: KanbanCard[] }
  | { type: "log:entry"; entry: LogEntry }
  | { type: "job:update"; job: { id: string; status: JobStatus; nodes_traversed: string[] } }
  | { type: "config:update"; config: SystemConfig }
  | { type: "policy:update"; nodes: NodeConfig[]; edges: any[] }
  | { type: "goal:update"; goals: Goal[] }
  | { type: "task:update"; tasks: Task[] }
  | { type: "archive:logs"; logs: any[] }
  | { type: "archive:system_docs"; docs: any[] }
  | { type: "job:details"; job: Job }
  | { type: "mobile:authenticated"; success: boolean };
