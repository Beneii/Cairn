export type NoteState = "unread" | "read";
export type KanbanStatus = "backlog" | "active" | "blocked" | "done";

export interface Note {
  id: string;
  content: string;
  status: NoteState;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "cairn";
  text: string;
  timestamp: string;
  tools?: string[]; // Collapsible tool output
  source?: "telegram" | "dashboard";
}

export interface KanbanCard {
  id: string;
  title: string;
  status: KanbanStatus;
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
    goal_reminder: boolean;
    calendar_aware: boolean;
    anomaly_alert: boolean;
    pattern_suggestion: boolean;
  };
}
