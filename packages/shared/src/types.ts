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
  attachments?: ChatAttachment[];
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

export interface ChatAttachment {
  id: string;
  type: "image";
  mimeType: string;
  dataUrl: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
  tools?: string[];
  source?: "telegram" | "dashboard" | "mobile";
  attachments?: ChatAttachment[];
}

export type NoteStatus = "unread" | "read" | "archived";

export interface Note {
  id: string;
  content: string;
  status: NoteStatus;
  timestamp: string;
  source?: "user" | "agent";
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
  heartbeat_interval_ms: number;
  monthly_spend_limit_usd: number;
  max_decisions_per_day: number;
  max_interactions_per_day: number;
  has_openai_key: boolean;
  has_telegram_token: boolean;
  telegram_admin_chat_id: string;
  has_google_calendar: boolean;
  mobile_app_enabled: boolean;
  default_client: "telegram" | "mobile";
  proactive: ProactiveConfig;
  local_mode_enabled: boolean;
}

export type OllamaModel =
  | "phi3.5:latest"
  | "gemma3:12b"
  | "phi3:mini"
  | "gemma3:4b"
  | "mistral:7b-instruct"
  | "deepseek-coder-v2:6.7b"
  | "qwen2.5:7b"
  | "llava-llama3:8b";

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
  // Schedules
  checkInsEnabled: boolean;
  briefingEnabled: boolean;
  briefingWindowStart: number; // 0-23, default 7
  briefingWindowEnd: number;   // 0-23, default 9
  librarianEnabled: boolean;
  librarianHour: number;       // 0-23, default 17
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

export interface SkillMetrics {
  skill_id: string;
  invocation_count: number;
  success_count: number;
  failure_count: number;
  p50_latency_ms?: number;
  p95_latency_ms?: number;
  last_used_at?: number;
  last_error_at?: number;
}

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
  goal_id?: string; // Links task to parent goal

  // Metadata
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// ---- WebSocket Protocol ----

export type ClientMessage =
  | { type: "ping" }
  | { type: "chat:send"; text: string; attachments?: ChatAttachment[] }
  | { type: "note:create"; content: string }
  | { type: "note:mark_read"; id: string }
  | { type: "note:resurface"; id: string }
  | { type: "note:archive"; id: string }
  | { type: "note:delete"; id: string }
  | { type: "kanban:archive"; id: string }
  | { type: "kanban:restore"; id: string }
  | { type: "kanban:delete"; id: string }
  | { type: "kanban:update_status"; id: string; status: KanbanStatus }
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
  | { type: "auth:dashboard"; token: string }
  | { type: "auth:mobile"; token: string }
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
  | { type: "archive:get_system_docs" }
  | { type: "system:update" }
  | { type: "builder:trigger"; skillRequestId?: string }
  | { type: "builder:stop" }
  | { type: "skillRequests:list"; status?: "pending" | "building" | "promoted" | "rejected" }
  | { type: "skillMetrics:list" }
  | { type: "skillMetrics:get"; skill_id: string };

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
  | { type: "policy:update"; nodes: Record<string, NodeConfig>; edges: Record<string, string[]> }
  | { type: "goal:update"; goals: Goal[] }
  | { type: "task:update"; tasks: Task[] }
  | { type: "archive:logs"; logs: any[] }
  | { type: "archive:system_docs"; docs: any[] }
  | { type: "job:details"; job: Job }
  | { type: "dashboard:authenticated"; success: boolean; capabilities?: string[] }
  | { type: "mobile:authenticated"; success: boolean; capabilities?: string[] }
  | { type: "system:update_progress"; stage: "pulling" | "building" | "restarting" | "error"; message: string }
  | { type: "builder:status"; status: "idle" | "running" | "failed" | "completed" }
  | { type: "builder:progress"; message: string }
  | { type: "builder:report"; report: any }
  | { type: "skillRequests:list:result"; requests: any[] }
  | { type: "skillMetrics:list:result"; metrics: SkillMetrics[] }
  | { type: "skillMetrics:get:result"; metric: SkillMetrics | null };

// ---- Cairn V2 Pipeline Types ----

export interface CairnMessage {
  messageId: string;
  userText: string;
  timestamp: string;
  sessionId: string;
  workingState?: Record<string, any>;
  attachments?: ChatAttachment[];
}

export interface PreRouteDecision {
  route: "DIRECT" | "LLM_CLASSIFY";
  lockedIntent?: string;
  directResponse?: string;
  reason: string;
}

export interface IntentClassification {
  intent: string;
  recommendedAction: "none" | "skill" | "plan";
  suggestedSkillId?: string | null;
  suggestedArguments?: Record<string, any> | null;
  needsPlanner: boolean;
  confidence: number;
}

export interface ActionContract {
  actionType: "none" | "skill" | "plan";
  skillId?: string;
  arguments?: Record<string, any>;
  requiresConfirmation: boolean;
  justification: string;
  confidence: number;
}

export interface SkillManifest {
  id: string;
  version: string;
  description: string;
  inputSchema: Record<string, any>; // JSON Schema
  outputSchema: Record<string, any>; // JSON Schema
  riskLevel: "low" | "medium" | "high";
  dependencies?: string[];
  tags?: string[];
  enabled: boolean;

  // Runtime metadata (optional in manifest, required for execution)
  requiresPlanner?: boolean;
  costEstimate?: "trivial" | "cheap" | "medium" | "expensive";
  localOnly?: boolean;
  maxInvocations?: number;
  confirmationRequired?: boolean;
}

// Deprecated alias to ease migration
export type SkillDefinition = SkillManifest;

export interface PlanGovernance {
  maxParallelLightWorkers?: number;
  maxParallelHeavyWorkers?: number;
  maxRetriesPerStep?: number;
  escalationMode?: "none" | "final-step";
  minConfidenceForAutonomy?: number;
  createHumanTicketOnFailure?: boolean;
}

export interface Plan {
  steps: PlanStep[];
  maxToolCalls: number;
  riskLevel: "low" | "medium" | "high";
  governance?: PlanGovernance;
}

export interface PlanStep {
  skillId: string;
  arguments: Record<string, any>;
  workerClass?: "default" | "light" | "heavy";
  parallelGroup?: string;
  maxRetries?: number;
  escalationSkillId?: string;
  confidenceHint?: number;
}

export type FailureStatus =
  | "SUCCESS"
  | "PARSE_ERROR_CLASSIFIER"
  | "CONTRACT_VALIDATION_FAIL"
  | "SKILL_NOT_FOUND"
  | "MODEL_NOT_AVAILABLE"
  | "TOOL_TIMEOUT"
  | "INFRASTRUCTURE_FAIL";

export interface PipelineTrace {
  messageId: string;
  preRouteDecision: PreRouteDecision;
  classifierOutput?: IntentClassification;
  actionContract?: ActionContract;
  plannerOutput?: Plan;
  executionTrace?: { skillId: string; durationMs: number; success: boolean; confidence: number }[];
  finalStatus: FailureStatus;
  totalLatencyMs: number;
  totalCostUsd: number;
}

export interface ActionableDigestItem {
  source: "university" | "admin" | "task" | "other";
  title: string;
  summary: string;
  dueAt?: string;
  owner?: string;
  priority?: "low" | "medium" | "high";
  confidence: number;
  tags?: string[];
}

export interface ActionableDigest {
  generatedAt: string;
  items: ActionableDigestItem[];
  risks: string[];
  recommendedNextActions: string[];
}

export interface ActionableExtractor<TInput = unknown> {
  id: string;
  description: string;
  extract: (input: TInput) => Promise<ActionableDigestItem[]>;
}
