export type RegistryLifecycleState = "experimental" | "active" | "merged" | "deprecated" | "archived";

export interface RegistryMergeLineage {
  parent_skill?: string;
  merged_from?: string[];
  merged_into?: string;
}

export interface SkillRegistryEntry {
  name: string;
  path: string;
  entry_script: string;
  enabled: boolean;
  version: number;
  hash_sha256?: string;
  runtime_skill_id?: string | null;
  tier?: number;
  required_tools?: string[];
  semantic_version?: string;
  lifecycle_state?: RegistryLifecycleState;
  merge_lineage?: RegistryMergeLineage;
  evolved_from_request_id?: string;
  last_promoted_at?: string;
  archived_at?: string;
  archived_reason?: string;
}

export interface SkillManifestRegistry {
  version: number;
  skills: SkillRegistryEntry[];
}

export interface EvolutionQualityGateInput {
  changeSummary: string;
  risks: string[];
  metrics: string[];
  rollbackSteps: string[];
}

function normalizeEntry(entry: SkillRegistryEntry): SkillRegistryEntry {
  return {
    ...entry,
    runtime_skill_id: entry.runtime_skill_id ?? null,
    required_tools: entry.required_tools ?? ["shell"],
    tier: entry.tier ?? 1,
    semantic_version: entry.semantic_version ?? "1.0.0",
    lifecycle_state: entry.lifecycle_state ?? "active",
    merge_lineage: entry.merge_lineage ?? {},
  };
}

export function parseManifestRegistry(raw: unknown): SkillManifestRegistry {
  if (!raw || typeof raw !== "object") {
    return { version: 2, skills: [] };
  }

  const candidate = raw as Partial<SkillManifestRegistry>;
  if (!Array.isArray(candidate.skills)) {
    throw new Error("manifest-registry.json must contain skills[]");
  }

  return {
    version: typeof candidate.version === "number" ? candidate.version : 2,
    skills: candidate.skills.map((entry) => normalizeEntry(entry as SkillRegistryEntry)),
  };
}

export function validateSkillConstitution(entry: SkillRegistryEntry): string[] {
  const issues: string[] = [];
  if (!entry.name || !/^[a-z0-9-]+$/.test(entry.name)) issues.push("name must be kebab-case");
  if (!entry.path?.endsWith("/SKILL.md")) issues.push("path must point to SKILL.md");
  if (!entry.entry_script?.includes("/scripts/")) issues.push("entry_script must be in scripts/");
  if ((entry.required_tools || []).length === 0) issues.push("required_tools must not be empty");
  if (!entry.semantic_version || !/^\d+\.\d+\.\d+$/.test(entry.semantic_version)) issues.push("semantic_version must be semver");

  if (entry.lifecycle_state === "merged" && !entry.merge_lineage?.merged_into) {
    issues.push("merged skills require merge_lineage.merged_into");
  }

  if (entry.lifecycle_state === "archived" && !entry.archived_at) {
    issues.push("archived skills require archived_at timestamp");
  }

  return issues;
}

export function ensureEvolutionQualityGate(input: EvolutionQualityGateInput): void {
  if (!input.changeSummary.trim()) throw new Error("quality gate: changeSummary is required");
  if (input.risks.length === 0) throw new Error("quality gate: at least one risk is required");
  if (input.metrics.length === 0) throw new Error("quality gate: at least one metric is required");
  if (input.rollbackSteps.length === 0) throw new Error("quality gate: rollbackSteps are required");
}

export function upsertSkillEntry(
  registry: SkillManifestRegistry,
  entry: SkillRegistryEntry,
): SkillManifestRegistry {
  const normalized = normalizeEntry(entry);
  const remaining = registry.skills.filter((skill) => skill.name !== normalized.name);
  return {
    version: Math.max(2, registry.version || 2),
    skills: [...remaining, normalized].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export function applyLifecycleTransition(
  registry: SkillManifestRegistry,
  skillName: string,
  targetState: RegistryLifecycleState,
  options?: { mergedInto?: string; archivedReason?: string; timestamp?: string },
): SkillManifestRegistry {
  const timestamp = options?.timestamp ?? new Date().toISOString();
  const skill = registry.skills.find((s) => s.name === skillName);
  if (!skill) throw new Error(`skill not found: ${skillName}`);

  const next: SkillRegistryEntry = { ...skill, lifecycle_state: targetState };

  if (targetState === "merged") {
    if (!options?.mergedInto) throw new Error("merged transition requires mergedInto");
    next.enabled = false;
    next.merge_lineage = { ...(next.merge_lineage || {}), merged_into: options.mergedInto };
  }

  if (targetState === "deprecated") {
    next.enabled = false;
  }

  if (targetState === "archived") {
    next.enabled = false;
    next.archived_at = timestamp;
    next.archived_reason = options?.archivedReason ?? "manual_archive";
  }

  if (targetState === "active") {
    next.enabled = true;
    // recoverable flow from archived/deprecated
    next.archived_at = undefined;
    next.archived_reason = undefined;
  }

  const issues = validateSkillConstitution(next);
  if (issues.length > 0) {
    throw new Error(`constitution check failed: ${issues.join("; ")}`);
  }

  return upsertSkillEntry(registry, next);
}

export function computeNextSemver(previous?: string): string {
  if (!previous) return "1.0.0";
  const parts = previous.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part) || part < 0)) {
    return "1.0.0";
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}
