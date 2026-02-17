import Database from "better-sqlite3";
import { dirname, join, normalize, resolve } from "path";
import { existsSync, mkdirSync } from "fs";
import { getDataPath } from "@cairn/shared";
import type { SkillMetrics } from "./types.js";

let db: Database.Database | null = null;

const METRICS_SCHEMA = `
CREATE TABLE IF NOT EXISTS skill_metrics (
  skill_id TEXT PRIMARY KEY,
  invocation_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  total_latency_ms INTEGER NOT NULL DEFAULT 0,
  p50_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  last_used_at INTEGER,
  last_error_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_skill_metrics_last_used
  ON skill_metrics(last_used_at);
`;

const latencyCache = new Map<string, number[]>();
const MAX_LATENCY_SAMPLES = 100;

function getSkillsDbPath(): string {
  const dataDir = resolve(getDataPath());
  const skillsDbPath = resolve(join(dataDir, "skills.db"));
  const normalizedData = normalize(dataDir);
  const normalizedDb = normalize(skillsDbPath);

  if (!normalizedDb.startsWith(normalizedData + normalize("/")) && normalizedDb !== normalizedData) {
    throw new Error("skills.db path rejected: outside data directory");
  }

  return skillsDbPath;
}

function getDb(): Database.Database {
  if (!db) {
    initSkillMetricsStore();
  }
  return db as Database.Database;
}

function percentile(sorted: number[], p: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function computePercentiles(skillId: string, latencyMs: number): { p50?: number; p95?: number } {
  const samples = latencyCache.get(skillId) ?? [];
  samples.push(Math.max(0, Math.round(latencyMs)));

  if (samples.length > MAX_LATENCY_SAMPLES) {
    samples.splice(0, samples.length - MAX_LATENCY_SAMPLES);
  }

  latencyCache.set(skillId, samples);

  const sorted = [...samples].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}

function rowToSkillMetrics(row: any): SkillMetrics {
  return {
    skill_id: row.skill_id,
    invocation_count: row.invocation_count,
    success_count: row.success_count,
    failure_count: row.failure_count,
    p50_latency_ms: row.p50_latency_ms ?? undefined,
    p95_latency_ms: row.p95_latency_ms ?? undefined,
    last_used_at: row.last_used_at ?? undefined,
    last_error_at: row.last_error_at ?? undefined,
  };
}

export function initSkillMetricsStore(): void {
  if (db) return;

  const dbPath = getSkillsDbPath();
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(METRICS_SCHEMA);
}

export function recordSkillInvocation(params: {
  skill_id: string;
  latency_ms: number;
  success: boolean;
}): void {
  const database = getDb();
  const nowMs = Date.now();
  const latencyMs = Math.max(0, Math.round(params.latency_ms));
  const { p50, p95 } = computePercentiles(params.skill_id, latencyMs);

  const stmt = database.prepare(`
    INSERT INTO skill_metrics (
      skill_id,
      invocation_count,
      success_count,
      failure_count,
      total_latency_ms,
      p50_latency_ms,
      p95_latency_ms,
      last_used_at,
      last_error_at
    ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(skill_id) DO UPDATE SET
      invocation_count = invocation_count + 1,
      success_count = success_count + excluded.success_count,
      failure_count = failure_count + excluded.failure_count,
      total_latency_ms = total_latency_ms + excluded.total_latency_ms,
      p50_latency_ms = excluded.p50_latency_ms,
      p95_latency_ms = excluded.p95_latency_ms,
      last_used_at = excluded.last_used_at,
      last_error_at = CASE
        WHEN excluded.last_error_at IS NOT NULL THEN excluded.last_error_at
        ELSE skill_metrics.last_error_at
      END
  `);

  stmt.run(
    params.skill_id,
    params.success ? 1 : 0,
    params.success ? 0 : 1,
    latencyMs,
    p50 ?? null,
    p95 ?? null,
    nowMs,
    params.success ? null : nowMs,
  );
}

export function getSkillMetrics(skill_id: string): SkillMetrics | null {
  const database = getDb();
  const row = database
    .prepare("SELECT * FROM skill_metrics WHERE skill_id = ?")
    .get(skill_id);

  if (!row) return null;
  return rowToSkillMetrics(row);
}

export function listSkillMetrics(): SkillMetrics[] {
  const database = getDb();
  const rows = database
    .prepare("SELECT * FROM skill_metrics ORDER BY last_used_at DESC")
    .all();

  return rows.map(rowToSkillMetrics);
}
