/**
 * SQLite Database Layer
 *
 * Persistent storage for goals and hypotheses.
 */

import Database from "better-sqlite3";
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { getDataPath } from "@cairn/shared";

let db: Database.Database | null = null;

// ---- Schema ----

const SCHEMA = `
-- Goals (long-term constraints on Cairn's behavior)
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  time_horizon TEXT NOT NULL DEFAULT '3mo',
  priority TEXT NOT NULL DEFAULT 'soft',
  success_definition TEXT DEFAULT '',
  anti_goals TEXT DEFAULT '[]',
  metrics TEXT DEFAULT '[]',
  allowed_interruption_level REAL DEFAULT 0.3,
  review_cadence_days INTEGER DEFAULT 7,
  confidence REAL DEFAULT 0.5,
  related_projects TEXT DEFAULT '[]',
  last_reviewed TEXT,
  next_review TEXT,
  max_interruptions_per_day INTEGER DEFAULT 3,
  interruptions_today INTEGER DEFAULT 0,
  blocked_reason TEXT,
  actions_log TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
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
  status TEXT DEFAULT 'active',
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
CREATE INDEX IF NOT EXISTS idx_hypotheses_status ON hypotheses(status);
CREATE INDEX IF NOT EXISTS idx_cache_expires ON tool_cache(expires_at);
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

    // Drop dead tables from old schema
    db.exec("DROP TABLE IF EXISTS preference_profiles");
    db.exec("DROP TABLE IF EXISTS approvals");
    db.exec("DROP TABLE IF EXISTS snapshots");

    // Migrate goals table if old schema detected
    try {
        const cols = db.prepare("PRAGMA table_info(goals)").all() as Array<{ name: string }>;
        const colNames = cols.map(c => c.name);

        if (colNames.includes("domain") && !colNames.includes("time_horizon")) {
            console.log("[db] Migrating goals table to new schema...");
            db.exec("DROP TABLE goals");
        }
    } catch {
        // Table doesn't exist yet
    }

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
