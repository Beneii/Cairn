export type NoteState = "unread" | "read" | "archived";
export type KanbanStatus = "backlog" | "active" | "blocked" | "done";

export interface Note {
  id: string;
  content: string;
  status: NoteState;
  timestamp: string;
}

export interface ChatAttachment {
  id: string;
  type: "image";
  mimeType: string;
  dataUrl: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "cairn";
  text: string;
  timestamp: string;
  tools?: string[]; // Collapsible tool output
  source?: "telegram" | "dashboard" | "mobile";
  attachments?: ChatAttachment[];
}

export interface Artifact {
  id: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  origin_node: string;
  created_at: string;
}

export interface CostEntry {
  node: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  timestamp: string;
}

export interface Job {
  id: string;
  status: "queued" | "running" | "waiting" | "done" | "failed";
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

export interface KanbanCard {
  id: string;
  title: string;
  status: KanbanStatus;
  jobId?: string;
  project?: string;    // Category: "general", "work", or custom project name
  archived?: boolean;  // True if moved to archive page
  archivedAt?: string; // ISO timestamp when archived
}

export type LogType = "thought" | "tool" | "file" | "api" | "agent" | "error";

export interface LogEntry {
  id: string;
  timestamp: string;
  type: LogType;
  content: string;
}

export interface SubAgent {
  id: string;
  name: string;
  action: string;
  model: string;
}

export interface ProactiveConfig {
  enabled: boolean;
  maxDailyNudges: number;
  quietHoursStart: number; // 0-23
  quietHoursEnd: number;   // 0-23
  minHoursBetweenNudges: number;
  nudgeTypes: {
    goal_progress: boolean;
    task_uncorking: boolean;
    reflection: boolean;
  };
  // New fields
  briefingEnabled?: boolean;
  briefingWindowStart?: number;
  briefingWindowEnd?: number;
  checkInsEnabled?: boolean;
  librarianEnabled?: boolean;
  librarianHour?: number;
}

// ---- Goals ----

export interface Goal {
  id: string;
  title: string;
  status: "active" | "paused" | "blocked" | "completed" | "abandoned";
  success_definition: string;
  time_horizon: "1mo" | "3mo" | "6mo" | "12mo";
  priority: "hard" | "soft";
  confidence: number;
  actions_log: {
    id: string;
    timestamp: string;
    action: string;
    result: string;
  }[];
  last_reviewed?: string;
  next_review?: string;
  created_at: string;
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

// ---- Skills ----

export type SkillRequestStatus = "pending" | "building" | "failed" | "promoted";

export interface SkillRequest {
  id: string;
  goal: string;
  source_context?: string;
  status: SkillRequestStatus;
  created_at: string;
  updated_at: string;
}

export interface SkillMetric {
  skill_id: string;
  success_count: number;
  failure_count: number;
  usage_count: number;
  last_used?: string;
}

