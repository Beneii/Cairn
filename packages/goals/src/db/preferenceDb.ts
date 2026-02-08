/**
 * SQLite-backed Preference Store
 */

import { getDatabase, parseJSON, now } from "./database.js";
import { newId } from "@cairn/shared";
import type { PreferenceProfile, FeedbackResponse, FeedbackEntry } from "../types/preference.js";

// ---- Row Mapping ----

interface ProfileRow {
    id: string;
    name: string;
    domain: string;
    weights: string;
    vetoes: string;
    requirements: string;
    feedback_history: string;
    feedback_count: number;
    confidence_score: number;
    created_at: string;
    updated_at: string;
}

function rowToProfile(row: ProfileRow): PreferenceProfile {
    return {
        id: row.id,
        name: row.name,
        domain: row.domain,
        weights: parseJSON<Record<string, number>>(row.weights, {}),
        vetoes: parseJSON<string[]>(row.vetoes, []),
        requirements: parseJSON<string[]>(row.requirements, []),
        feedbackHistory: parseJSON<FeedbackEntry[]>(row.feedback_history, []),
        feedbackCount: row.feedback_count,
        confidenceScore: row.confidence_score,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ---- Queries ----

export function getProfiles(): PreferenceProfile[] {
    const db = getDatabase();
    const rows = db.prepare("SELECT * FROM preference_profiles ORDER BY updated_at DESC").all() as ProfileRow[];
    return rows.map(rowToProfile);
}

export function getProfile(id: string): PreferenceProfile | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM preference_profiles WHERE id = ?").get(id) as ProfileRow | undefined;
    return row ? rowToProfile(row) : undefined;
}

export function getProfileByDomain(domain: string): PreferenceProfile | undefined {
    const db = getDatabase();
    const row = db.prepare("SELECT * FROM preference_profiles WHERE domain = ? LIMIT 1").get(domain) as ProfileRow | undefined;
    return row ? rowToProfile(row) : undefined;
}

// ---- Mutations ----

export function createProfile(
    name: string,
    domain: string,
    initialWeights?: Record<string, number>
): PreferenceProfile {
    const profile: PreferenceProfile = {
        id: newId(),
        name,
        domain,
        weights: initialWeights ?? {},
        vetoes: [],
        requirements: [],
        feedbackHistory: [],
        feedbackCount: 0,
        confidenceScore: 0,
        createdAt: now(),
        updatedAt: now(),
    };

    const db = getDatabase();
    const stmt = db.prepare(`
    INSERT INTO preference_profiles (
      id, name, domain, weights, vetoes, requirements,
      feedback_history, feedback_count, confidence_score,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

    stmt.run(
        profile.id,
        profile.name,
        profile.domain,
        JSON.stringify(profile.weights),
        JSON.stringify(profile.vetoes),
        JSON.stringify(profile.requirements),
        JSON.stringify(profile.feedbackHistory),
        profile.feedbackCount,
        profile.confidenceScore,
        profile.createdAt,
        profile.updatedAt
    );

    console.log(`[prefs-db] Created profile: ${name} (${domain})`);
    return profile;
}

export function getOrCreateProfile(
    name: string,
    domain: string,
    initialWeights?: Record<string, number>
): PreferenceProfile {
    const existing = getProfileByDomain(domain);
    if (existing) return existing;
    return createProfile(name, domain, initialWeights);
}

export function updateProfile(id: string, updates: Partial<PreferenceProfile>): PreferenceProfile | undefined {
    const existing = getProfile(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates, updatedAt: now() };
    const db = getDatabase();

    const stmt = db.prepare(`
    UPDATE preference_profiles SET
      name = ?, domain = ?, weights = ?, vetoes = ?, requirements = ?,
      feedback_history = ?, feedback_count = ?, confidence_score = ?,
      updated_at = ?
    WHERE id = ?
  `);

    stmt.run(
        updated.name,
        updated.domain,
        JSON.stringify(updated.weights),
        JSON.stringify(updated.vetoes),
        JSON.stringify(updated.requirements),
        JSON.stringify(updated.feedbackHistory),
        updated.feedbackCount,
        updated.confidenceScore,
        updated.updatedAt,
        id
    );

    return updated;
}

// ---- Weight Update Constants ----

const WEIGHT_DELTAS: Record<FeedbackResponse, number> = {
    strong_yes: 0.2,
    yes: 0.1,
    meh: 0,
    no: -0.1,
    strong_no: -0.2,
};

const MAX_WEIGHT = 1.0;
const MIN_WEIGHT = -1.0;

export function recordFeedback(
    profileId: string,
    itemId: string,
    response: FeedbackResponse,
    features: Record<string, unknown>
): PreferenceProfile | undefined {
    const profile = getProfile(profileId);
    if (!profile) return undefined;

    const delta = WEIGHT_DELTAS[response];
    const appliedChanges: Record<string, number> = {};
    const newWeights = { ...profile.weights };

    // Update weights for present features
    for (const [feature, value] of Object.entries(features)) {
        if (!value) continue;
        const currentWeight = newWeights[feature] ?? 0;
        const newWeight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, currentWeight + delta));
        if (newWeight !== currentWeight) {
            newWeights[feature] = newWeight;
            appliedChanges[feature] = delta;
        }
    }

    const entry: FeedbackEntry = {
        id: newId(),
        itemId,
        response,
        features,
        timestamp: now(),
        appliedWeightChanges: appliedChanges,
    };

    const newFeedbackCount = profile.feedbackCount + 1;
    const newConfidence = Math.min(1.0, newFeedbackCount / 50);

    return updateProfile(profileId, {
        weights: newWeights,
        feedbackHistory: [...profile.feedbackHistory, entry],
        feedbackCount: newFeedbackCount,
        confidenceScore: newConfidence,
    });
}

// ---- Scoring ----

export function score(
    profileId: string,
    features: Record<string, unknown>
): { score: number; vetoed: boolean; missingRequirements: string[] } | undefined {
    const profile = getProfile(profileId);
    if (!profile) return undefined;

    // Check vetoes
    for (const veto of profile.vetoes) {
        if (features[veto]) {
            return { score: -Infinity, vetoed: true, missingRequirements: [] };
        }
    }

    // Check requirements
    const missingRequirements = profile.requirements.filter(req => !features[req]);

    // Calculate score
    let totalScore = 0;
    let weightCount = 0;

    for (const [feature, value] of Object.entries(features)) {
        if (!value) continue;
        const weight = profile.weights[feature];
        if (weight !== undefined) {
            totalScore += weight;
            weightCount++;
        }
    }

    const normalizedScore = weightCount > 0 ? totalScore / weightCount : 0;

    return { score: normalizedScore, vetoed: false, missingRequirements };
}

// ---- Veto Management ----

export function addVeto(profileId: string, feature: string): PreferenceProfile | undefined {
    const profile = getProfile(profileId);
    if (!profile || profile.vetoes.includes(feature)) return profile;
    return updateProfile(profileId, { vetoes: [...profile.vetoes, feature] });
}

export function removeVeto(profileId: string, feature: string): PreferenceProfile | undefined {
    const profile = getProfile(profileId);
    if (!profile) return undefined;
    return updateProfile(profileId, { vetoes: profile.vetoes.filter(v => v !== feature) });
}

export function setWeight(profileId: string, feature: string, weight: number): PreferenceProfile | undefined {
    const profile = getProfile(profileId);
    if (!profile) return undefined;
    return updateProfile(profileId, {
        weights: { ...profile.weights, [feature]: Math.max(-1, Math.min(1, weight)) },
    });
}

export function deleteProfile(id: string): boolean {
    const db = getDatabase();
    const result = db.prepare("DELETE FROM preference_profiles WHERE id = ?").run(id);
    return result.changes > 0;
}
