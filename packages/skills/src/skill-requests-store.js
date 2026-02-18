import Database from "better-sqlite3";
import { dirname, join, normalize, resolve } from "path";
import { existsSync, mkdirSync } from "fs";
import { getDataPath, newId } from "@cairn/shared";
import { appendEntry, initLedger } from "@cairn/ledger";
let db = null;
const ALLOWED_TRANSITIONS = {
    pending: ["building", "promoted", "rejected"],
    building: ["promoted", "rejected"],
    promoted: [],
    rejected: [],
};
const REQUEST_SCHEMA = `
CREATE TABLE IF NOT EXISTS skill_requests (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  required_tools TEXT NOT NULL,
  proposed_tier INTEGER,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  source_context TEXT
);

CREATE INDEX IF NOT EXISTS idx_skill_requests_status
  ON skill_requests(status);
`;
function getSkillsDbPath() {
    const dataDir = resolve(getDataPath());
    const skillsDbPath = resolve(join(dataDir, "skills.db"));
    const normalizedData = normalize(dataDir);
    const normalizedDb = normalize(skillsDbPath);
    if (!normalizedDb.startsWith(normalizedData + normalize("/")) && normalizedDb !== normalizedData) {
        throw new Error("skills.db path rejected: outside data directory");
    }
    return skillsDbPath;
}
function getDb() {
    if (!db) {
        initSkillRequestStore();
    }
    return db;
}
function appendSkillEvent(jobId, content, metadata) {
    initLedger()
        .then(() => appendEntry("agent", "skills-store", jobId, content, metadata))
        .catch((err) => console.error("[skills-store] failed to append ledger event:", err));
}
function rowToSkillRequest(row) {
    return {
        id: row.id,
        goal: row.goal,
        required_tools: JSON.parse(row.required_tools || "[]"),
        proposed_tier: row.proposed_tier ?? undefined,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        source_context: row.source_context ?? undefined,
    };
}
export function initSkillRequestStore() {
    if (db)
        return;
    const dbPath = getSkillsDbPath();
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.exec(REQUEST_SCHEMA);
}
export function createSkillRequest(data) {
    const database = getDb();
    const nowMs = Date.now();
    const request = {
        id: newId(),
        goal: data.goal,
        required_tools: data.required_tools,
        proposed_tier: data.proposed_tier,
        status: "pending",
        created_at: nowMs,
        updated_at: nowMs,
        source_context: data.source_context,
    };
    const stmt = database.prepare(`
    INSERT INTO skill_requests (id, goal, required_tools, proposed_tier, status, created_at, updated_at, source_context)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
    stmt.run(request.id, request.goal, JSON.stringify(request.required_tools), request.proposed_tier ?? null, request.status, request.created_at, request.updated_at, request.source_context ?? null);
    appendSkillEvent(request.id, `SkillRequest created: ${request.goal}`, {
        request_id: request.id,
        required_tools: request.required_tools,
        proposed_tier: request.proposed_tier,
    });
    return request;
}
export function listSkillRequests(status) {
    const database = getDb();
    if (status) {
        const rows = database
            .prepare("SELECT * FROM skill_requests WHERE status = ? ORDER BY created_at DESC")
            .all(status);
        return rows.map(rowToSkillRequest);
    }
    const rows = database
        .prepare("SELECT * FROM skill_requests ORDER BY created_at DESC")
        .all();
    return rows.map(rowToSkillRequest);
}
export function getSkillRequestById(id) {
    const database = getDb();
    const row = database
        .prepare("SELECT * FROM skill_requests WHERE id = ?")
        .get(id);
    if (!row)
        return null;
    return rowToSkillRequest(row);
}
export function updateSkillRequestStatus(id, status) {
    const database = getDb();
    const current = getSkillRequestById(id);
    if (!current) {
        throw new Error(`SkillRequest not found: ${id}`);
    }
    const allowed = ALLOWED_TRANSITIONS[current.status];
    if (!allowed.includes(status)) {
        throw new Error(`Invalid skill request transition: ${current.status} -> ${status}`);
    }
    const nowMs = Date.now();
    const stmt = database.prepare("UPDATE skill_requests SET status = ?, updated_at = ? WHERE id = ?");
    stmt.run(status, nowMs, id);
    appendSkillEvent(id, `SkillRequest status updated: ${current.status} -> ${status}`, {
        request_id: id,
        from_status: current.status,
        to_status: status,
    });
}
//# sourceMappingURL=skill-requests-store.js.map