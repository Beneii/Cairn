/**
 * SQLite Database Layer
 * 
 * Persistent storage for cognition: goals, preferences, hypotheses, cache.
 * JSON files remain for config/templates/static data.
 */

import Database from "better-sqlite3";
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { getDataPath } from "@cairn/shared";

let db: Database.Database | null = null;

// ---- Schema ----

const SCHEMA = `
-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  completion_conditions TEXT DEFAULT '[]',
  blocked_reason TEXT,
  constraints TEXT DEFAULT '[]',
  preferences TEXT DEFAULT '[]',
  friction_level REAL DEFAULT 0.3,
  regret_profile TEXT DEFAULT 'avoid_mistake',
  max_interruptions_per_day INTEGER DEFAULT 5,
  interruptions_today INTEGER DEFAULT 0,
  check_schedule TEXT,
  last_checked TEXT,
  next_check TEXT,
  next_action TEXT,
  actions_log TEXT DEFAULT '[]',
  rejected_item_ids TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Preferences
CREATE TABLE IF NOT EXISTS preference_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  weights TEXT DEFAULT '{}',
  vetoes TEXT DEFAULT '[]',
  requirements TEXT DEFAULT '[]',
  feedback_history TEXT DEFAULT '[]',
  feedback_count INTEGER DEFAULT 0,
  confidence_score REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Approval Requests
CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  payload TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT,
  expires_at TEXT
);

-- Hypotheses (for reflection/learning)
CREATE TABLE IF NOT EXISTS hypotheses (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  domain TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  confidence REAL DEFAULT 0.5,
  evidence_for INTEGER DEFAULT 0,
  evidence_against INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',  -- active, validated, invalidated
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Tool Results Cache
CREATE TABLE IF NOT EXISTS tool_cache (
  cache_key TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  output TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- State Snapshots (for compact goal context)
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  snapshot_type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_goals_domain ON goals(domain);
CREATE INDEX IF NOT EXISTS idx_prefs_domain ON preference_profiles(domain);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_hypotheses_status ON hypotheses(status);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON tool_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_goal ON snapshots(goal_id);
`;

// ---- Init ----

export function initDatabase(): Database.Database {
    if (db) return db;

    const dbPath = join(getDataPath(), "cairn.db");
    const dir = dirname(dbPath);

    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    // Create tables
    db.exec(SCHEMA);

    console.log(`[db] SQLite initialized at ${dbPath}`);
    return db;
}

export function getDatabase(): Database.Database {
    if (!db) {
        return initDatabase();
    }
    return db;
}

export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
        console.log("[db] Database closed");
    }
}

// ---- Helpers ----

export function now(): string {
    return new Date().toISOString();
}

export function parseJSON<T>(str: string | null | undefined, fallback: T): T {
    if (!str) return fallback;
    try {
        return JSON.parse(str) as T;
    } catch {
        return fallback;
    }
}
