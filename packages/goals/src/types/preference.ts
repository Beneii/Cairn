/**
 * Preference Model Types
 * 
 * Weighted preferences that evolve from feedback.
 * Used to score items against user taste.
 */

import { now, newId } from "@cairn/shared";

// ---- Feedback ----

export type FeedbackResponse =
    | "strong_yes"   // +0.2 to relevant weights
    | "yes"          // +0.1
    | "meh"          // no change
    | "no"           // -0.1  
    | "strong_no";   // -0.2

export interface FeedbackEntry {
    id: string;
    itemId: string;                       // What was being evaluated
    response: FeedbackResponse;
    features: Record<string, unknown>;    // Features present in item
    timestamp: string;
    appliedWeightChanges?: Record<string, number>; // Debug: what changed
}

// ---- Preference Profile ----

export interface PreferenceProfile {
    id: string;
    name: string;                         // "Housing Taste", "Restaurant Preferences"
    domain: string;                       // "housing", "food", "general"

    // Feature weights (evolving)
    // Positive = like, Negative = dislike
    // e.g. { "hardwood_floors": 0.8, "carpet": -0.6, "natural_light": 0.7 }
    weights: Record<string, number>;

    // Hard vetoes (instant reject if present)
    vetoes: string[];                     // ["carpet", "ground_floor", "highway_adjacent"]

    // Hard requirements (must have)
    requirements: string[];               // ["kitchen", "bathroom"]

    // Feedback history for calibration
    feedbackHistory: FeedbackEntry[];

    // Confidence (how many data points)
    feedbackCount: number;
    confidenceScore: number;              // 0-1, increases with feedback

    createdAt: string;
    updatedAt: string;
}

// ---- Weight update constants ----

const WEIGHT_DELTAS: Record<FeedbackResponse, number> = {
    strong_yes: 0.2,
    yes: 0.1,
    meh: 0,
    no: -0.1,
    strong_no: -0.2,
};

const MAX_WEIGHT = 1.0;
const MIN_WEIGHT = -1.0;

// ---- Factory ----

export function createPreferenceProfile(
    name: string,
    domain: string,
    initialWeights?: Record<string, number>
): PreferenceProfile {
    const timestamp = now();
    return {
        id: newId(),
        name,
        domain,
        weights: initialWeights ?? {},
        vetoes: [],
        requirements: [],
        feedbackHistory: [],
        feedbackCount: 0,
        confidenceScore: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
    };
}

// ---- Weight Update Logic ----

/**
 * Apply feedback to update weights.
 * Features present in the item get weight adjustments based on response.
 */
export function applyFeedback(
    profile: PreferenceProfile,
    itemId: string,
    response: FeedbackResponse,
    features: Record<string, unknown>
): PreferenceProfile {
    const delta = WEIGHT_DELTAS[response];
    const appliedChanges: Record<string, number> = {};

    // Clone weights
    const newWeights = { ...profile.weights };

    // Only adjust weights for features that are present (truthy)
    for (const [feature, value] of Object.entries(features)) {
        if (!value) continue; // Skip false/null/undefined features

        const currentWeight = newWeights[feature] ?? 0;
        const newWeight = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, currentWeight + delta));

        if (newWeight !== currentWeight) {
            newWeights[feature] = newWeight;
            appliedChanges[feature] = delta;
        }
    }

    // Create feedback entry
    const entry: FeedbackEntry = {
        id: newId(),
        itemId,
        response,
        features,
        timestamp: now(),
        appliedWeightChanges: appliedChanges,
    };

    // Update confidence (simple: more feedback = more confident, capped at 1.0)
    const newFeedbackCount = profile.feedbackCount + 1;
    const newConfidence = Math.min(1.0, newFeedbackCount / 50); // Full confidence at 50 data points

    return {
        ...profile,
        weights: newWeights,
        feedbackHistory: [...profile.feedbackHistory, entry],
        feedbackCount: newFeedbackCount,
        confidenceScore: newConfidence,
        updatedAt: now(),
    };
}

// ---- Scoring ----

/**
 * Score an item against a preference profile.
 * Returns a number where higher = better match.
 */
export function scoreItem(
    profile: PreferenceProfile,
    features: Record<string, unknown>
): { score: number; vetoed: boolean; missingRequirements: string[] } {
    // Check vetoes first
    for (const veto of profile.vetoes) {
        if (features[veto]) {
            return { score: -Infinity, vetoed: true, missingRequirements: [] };
        }
    }

    // Check requirements
    const missingRequirements: string[] = [];
    for (const req of profile.requirements) {
        if (!features[req]) {
            missingRequirements.push(req);
        }
    }

    // Calculate weighted score
    let score = 0;
    let weightCount = 0;

    for (const [feature, value] of Object.entries(features)) {
        if (!value) continue;

        const weight = profile.weights[feature];
        if (weight !== undefined) {
            score += weight;
            weightCount++;
        }
    }

    // Normalize by number of weighted features (if any)
    if (weightCount > 0) {
        score = score / weightCount;
    }

    return { score, vetoed: false, missingRequirements };
}
