
import { SkillManifest } from "@cairn/shared";
import { DEFAULT_SKILLS_MANIFEST } from "./definitions.js";

interface RegisteredSkill {
    manifest: SkillManifest;
    // Handlers are bound at runtime in the orchestrator/executor
    // This registry is purely for metadata management
}

const skills = new Map<string, RegisteredSkill>();

/**
 * Initialize the registry with default skills.
 */
export function initRegistry(): void {
    if (skills.size > 0) return; // Already initialized

    for (const manifest of DEFAULT_SKILLS_MANIFEST) {
        registerSkillManifest(manifest);
    }
    console.log(`[@cairn/skills] Initialized registry with ${skills.size} skills`);
}

/**
 * Register a single skill manifest.
 * Overwrites if ID exists.
 */
export function registerSkillManifest(manifest: SkillManifest): void {
    if (skills.has(manifest.id)) {
        console.warn(`[@cairn/skills] Overwriting skill manifest: ${manifest.id}`);
    }
    skills.set(manifest.id, { manifest });
}

/**
 * Get a skill manifest by ID.
 */
export function getSkillManifest(id: string): SkillManifest | undefined {
    return skills.get(id)?.manifest;
}

/**
 * Get all registered skill manifests.
 */
export function getAllSkillManifests(): SkillManifest[] {
    return Array.from(skills.values()).map(s => s.manifest);
}

/**
 * Get all ENABLED skill manifests.
 */
export function getEnabledSkills(): SkillManifest[] {
    return Array.from(skills.values())
        .map(s => s.manifest)
        .filter(m => m.enabled);
}
