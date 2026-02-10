import Database from "better-sqlite3";
import { join, dirname } from "path";
import { mkdirSync, existsSync } from "fs";
import { getDataPath } from "@cairn/shared"; // Assume shared exports this, it was used in goals

let db: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  type TEXT NOT NULL DEFAULT 'one-off',
  due_date TEXT,
  scheduled_date TEXT,
  recurrence_rule TEXT,
  source TEXT NOT NULL DEFAULT 'user',
  suggested_by_agent INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON tasks(scheduled_date);
`;

export function initDatabase(): Database.Database {
    if (db) return db;

    const dbPath = join(getDataPath(), "tasks.db");
    const dir = dirname(dbPath);

    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");

    db.exec(SCHEMA);

    console.log(`[tasks] Database initialized at ${dbPath}`);
    return db;
}

export function getDatabase(): Database.Database {
    if (!db) return initDatabase();
    return db;
}

export function closeDatabase(): void {
    if (db) {
        db.close();
        db = null;
    }
}
