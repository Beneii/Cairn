/**
 * Preference Store
 * 
 * Persistent storage for preference profiles with feedback-based updates.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { getDataPath, now } from "@cairn/shared";
import type { PreferenceProfile, FeedbackResponse } from "../types/preference.js";
import { createPreferenceProfile, applyFeedback, scoreItem } from "../types/preference.js";

// ---- State ----

let profiles: PreferenceProfile[] = [];
let dataPath: string;

// ---- Persistence ----

async function persist(): Promise<void> {
    const dir = dirname(dataPath);
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
    await writeFile(dataPath, JSON.stringify(profiles, null, 2));
}

async function load(): Promise<void> {
    try {
        const data = await readFile(dataPath, "utf-8");
        profiles = JSON.parse(data);
        console.log(`[preferences] Loaded ${profiles.length} profiles`);
    } catch {
        profiles = [];
        console.log("[preferences] No existing profiles, starting fresh");
    }
}

// ---- Init ----

export async function initPreferenceStore(): Promise<void> {
    dataPath = join(getDataPath(), "goals", "preferences.json");
    await load();
}

// ---- CRUD ----

export function getProfiles(): PreferenceProfile[] {
    return [...profiles];
}

export function getProfile(id: string): PreferenceProfile | undefined {
    return profiles.find(p => p.id === id);
}

export function getProfileByDomain(domain: string): PreferenceProfile | undefined {
    return profiles.find(p => p.domain === domain);
}

export async function createProfile(
    name: string,
    domain: string,
    initialWeights?: Record<string, number>
): Promise<PreferenceProfile> {
    const profile = createPreferenceProfile(name, domain, initialWeights);
    profiles.push(profile);
    await persist();
    console.log(`[preferences] Created profile: ${name} (${domain})`);
    return profile;
}

export async function getOrCreateProfile(
    name: string,
    domain: string,
    initialWeights?: Record<string, number>
): Promise<PreferenceProfile> {
    const existing = getProfileByDomain(domain);
    if (existing) return existing;
    return createProfile(name, domain, initialWeights);
}

// ---- Feedback ----

export async function recordFeedback(
    profileId: string,
    itemId: string,
    response: FeedbackResponse,
    features: Record<string, unknown>
): Promise<PreferenceProfile | undefined> {
    const idx = profiles.findIndex(p => p.id === profileId);
    if (idx === -1) return undefined;

    const updated = applyFeedback(profiles[idx], itemId, response, features);
    profiles[idx] = updated;
    await persist();

    console.log(`[preferences] Recorded ${response} feedback on ${itemId}`);
    return updated;
}

// ---- Scoring ----

export function score(
    profileId: string,
    features: Record<string, unknown>
): { score: number; vetoed: boolean; missingRequirements: string[] } | undefined {
    const profile = getProfile(profileId);
    if (!profile) return undefined;
    return scoreItem(profile, features);
}

// ---- Veto Management ----

export async function addVeto(profileId: string, feature: string): Promise<PreferenceProfile | undefined> {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return undefined;

    if (!profile.vetoes.includes(feature)) {
        profile.vetoes.push(feature);
        profile.updatedAt = now();
        await persist();
    }
    return profile;
}

export async function removeVeto(profileId: string, feature: string): Promise<PreferenceProfile | undefined> {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return undefined;

    const idx = profile.vetoes.indexOf(feature);
    if (idx !== -1) {
        profile.vetoes.splice(idx, 1);
        profile.updatedAt = now();
        await persist();
    }
    return profile;
}

// ---- Weight Adjustment ----

export async function setWeight(
    profileId: string,
    feature: string,
    weight: number
): Promise<PreferenceProfile | undefined> {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return undefined;

    profile.weights[feature] = Math.max(-1, Math.min(1, weight));
    profile.updatedAt = now();
    await persist();
    return profile;
}

export async function deleteProfile(id: string): Promise<boolean> {
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return false;

    profiles.splice(idx, 1);
    await persist();
    return true;
}
