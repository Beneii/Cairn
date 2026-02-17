export type SkillRequestStatus =
  | "pending"
  | "building"
  | "promoted"
  | "rejected";

export interface SkillRequest {
  id: string;
  goal: string;
  required_tools: string[];
  proposed_tier?: number;
  status: SkillRequestStatus;
  created_at: number;
  updated_at: number;
  source_context?: string;
}


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
