/**
 * Hypothesis Tracking (Reflection/Learning)
 * 
 * Track assumptions about user preferences, validate or invalidate them.
 */

import { getDatabase, now } from "./database.js";
import { newId } from "@cairn/shared";

export type HypothesisStatus = "active" | "validated" | "invalidated";

export interface Hypothesis {
    id: string;
    goalId?: string;          // Optional: specific to a goal
    domain: string;           // "housing", "general"
    hypothesis: string;       // "User prefers hardwood floors"
    confidence: number;       // 0-1
    evidenceFor: number;      // Count of supporting evidence
    evidenceAgainst: number;  // Count of contradicting evidence
    status: HypothesisStatus;
    createdAt: string;
    updatedAt: string;
}

interface HypothesisRow {
    id: string;
    goal_id: string | null;
    domain: string;
    hypothesis: string;
    confidence: number;
    evidence_for: number;
    evidence_against: number;
    status: string;
    created_at: string;
    updated_at: string;
}

function rowToHypothesis(row: HypothesisRow): Hypothesis {
    return {
        id: row.id,
        goalId: row.goal_id ?? undefined,
        domain: row.domain,
        hypothesis: row.hypothesis,
        confidence: row.confidence,
        evidenceFor: row.evidence_for,
        evidenceAgainst: row.evidence_against,
        status: row.status as HypothesisStatus,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ---- Queries ----

export function getActiveHypotheses(domain?: string): Hypothesis[] {
    const db = getDatabase();
    if (domain) {
        const rows = db.prepare(
            "SELECT * FROM hypotheses WHERE status = 'active' AND domain = ? ORDER BY confidence DESC"
        ).all(domain) as HypothesisRow[];
        return rows.map(rowToHypothesis);
    }
    const rows = db.prepare(
        "SELECT * FROM hypotheses WHERE status = 'active' ORDER BY confidence DESC"
    ).all() as HypothesisRow[];
    return rows.map(rowToHypothesis);
}

export function getHypothesis(id: string): Hypothesis | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM hypotheses WHERE id = ?").get(id) as HypothesisRow | undefined;
    return row ? rowToHypothesis(row) : undefined;
}

export function getInvalidatedHypotheses(domain?: string): Hypothesis[] {
    const db = getDatabase();
    const query = domain
        ? "SELECT * FROM hypotheses WHERE status = 'invalidated' AND domain = ?"
        : "SELECT * FROM hypotheses WHERE status = 'invalidated'";
    const rows = (domain
        ? db.prepare(query).all(domain)
        : db.prepare(query).all()) as HypothesisRow[];
    return rows.map(rowToHypothesis);
}

// ---- Mutations ----

export function createHypothesis(
    domain: string,
    hypothesis: string,
    goalId?: string,
    initialConfidence = 0.5
): Hypothesis {
    const h: Hypothesis = {
        id: newId(),
        goalId,
        domain,
        hypothesis,
        confidence: initialConfidence,
        evidenceFor: 0,
        evidenceAgainst: 0,
        status: "active",
        createdAt: now(),
        updatedAt: now(),
    };

    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO hypotheses (
      id, goal_id, domain, hypothesis, confidence,
      evidence_for, evidence_against, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    stmt.run(
        h.id, h.goalId ?? null, h.domain, h.hypothesis, h.confidence,
        h.evidenceFor, h.evidenceAgainst, h.status, h.createdAt, h.updatedAt
    );

    console.log(`[hypotheses] Created: "${hypothesis}" (${domain})`);
    return h;
}

export function recordEvidence(id: string, supports: boolean): Hypothesis | undefined {
    const h = getHypothesis(id);
    if (!h || h.status !== "active") return h;

    const newFor = supports ? h.evidenceFor + 1 : h.evidenceFor;
    const newAgainst = supports ? h.evidenceAgainst : h.evidenceAgainst + 1;

    // Recalculate confidence using Bayesian-like update
    const total = newFor + newAgainst;
    const newConfidence = total > 0 ? newFor / total : 0.5;

    // Auto-invalidate if confidence drops too low with enough evidence
    let newStatus: HypothesisStatus = h.status;
    if (total >= 5 && newConfidence < 0.2) {
        newStatus = "invalidated";
        console.log(`[hypotheses] Invalidated: "${h.hypothesis}" (confidence: ${newConfidence.toFixed(2)})`);
    } else if (total >= 5 && newConfidence > 0.8) {
        newStatus = "validated";
        console.log(`[hypotheses] Validated: "${h.hypothesis}" (confidence: ${newConfidence.toFixed(2)})`);
    }

    const db = getDatabase();
    const stmt = db.prepare(`
    UPDATE hypotheses SET
      evidence_for = ?, evidence_against = ?, confidence = ?,
      status = ?, updated_at = ?
    WHERE id = ?
  `);

    stmt.run(newFor, newAgainst, newConfidence, newStatus, now(), id);

    return { ...h, evidenceFor: newFor, evidenceAgainst: newAgainst, confidence: newConfidence, status: newStatus, updatedAt: now() };
}

export function invalidateHypothesis(id: string, reason?: string): Hypothesis | undefined {
    const h = getHypothesis(id);
    if (!h) return undefined;

    const db = getDatabase();
    db.prepare("UPDATE hypotheses SET status = 'invalidated', updated_at = ? WHERE id = ?").run(now(), id);

    console.log(`[hypotheses] Manually invalidated: "${h.hypothesis}"${reason ? ` - ${reason}` : ""}`);
    return { ...h, status: "invalidated", updatedAt: now() };
}

export function deleteHypothesis(id: string): boolean {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM hypotheses WHERE id = ?").run(id);
    return result.changes > 0;
}
