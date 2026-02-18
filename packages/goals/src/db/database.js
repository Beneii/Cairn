/**
 * SQLite Database Layer
 *
 * Persistent storage for goals.
 */
import Database from "better-sqlite3";
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { getDataPath } from "@cairn/shared";
let db = null;
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
  timeline TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);
`;
// ---- Init ----
export function initDatabase() {
    if (db)
        return db;
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
    db.exec("DROP TABLE IF EXISTS hypotheses");
    db.exec("DROP TABLE IF EXISTS tool_cache");
    // Migrate goals table if old schema detected (missing domain or time_horizon or timeline)
    try {
        const cols = db.prepare("PRAGMA table_info(goals)").all();
        const colNames = cols.map(c => c.name);
        if (colNames.includes("domain") && !colNames.includes("time_horizon")) {
            console.log("[db] Migrating goals table to new schema...");
            db.exec("DROP TABLE goals");
        }
        // Add timeline column if missing
        if (!colNames.includes("timeline")) {
            console.log("[db] Adding timeline column to goals table...");
            db.exec("ALTER TABLE goals ADD COLUMN timeline TEXT DEFAULT '[]'");
        }
    }
    catch (err) {
        console.error("[db] Migration error:", err);
    }
    // Create tables
    db.exec(SCHEMA);
    console.log(`[db] SQLite initialized at ${dbPath}`);
    return db;
}
export function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}
export function closeDatabase() {
    if (db) {
        db.close();
        db = null;
        console.log("[db] Database closed");
    }
}
// ---- Helpers ----
export function now() {
    return new Date().toISOString();
}
export function parseJSON(str, fallback) {
    if (!str)
        return fallback;
    try {
        return JSON.parse(str);
    }
    catch {
        return fallback;
    }
}
//# sourceMappingURL=database.js.map