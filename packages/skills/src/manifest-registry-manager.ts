export type RegistryLifecycleState = "experimental" | "active" | "merged" | "deprecated";

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
}

export interface SkillManifestRegistry {
  version: number;
  skills: SkillRegistryEntry[];
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

export function computeNextSemver(previous?: string): string {
  if (!previous) return "1.0.0";
  const parts = previous.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part) || part < 0)) {
    return "1.0.0";
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}
