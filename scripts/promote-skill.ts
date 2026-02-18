#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { appendEntry, initLedger } from "../packages/ledger/src/index.ts";
import {
  computeNextSemver,
  getSkillRequestById,
  initSkillRequestStore,
  listSkillRequests,
  parseManifestRegistry,
  updateSkillRequestStatus,
  upsertSkillEntry,
} from "../packages/skills/src/index.ts";

function ensureSelfGrowthMode() {
  const grow = process.env.CAIRN_MODE === "grow" || process.env.CAIRN_SELF_GROWTH === "enabled";
  if (!grow) {
    throw new Error("Promotion blocked: set CAIRN_MODE=grow or CAIRN_SELF_GROWTH=enabled");
  }
}

async function assertWithin(baseDir: string, targetDir: string, label: string) {
  const realBase = await fsp.realpath(baseDir);
  const realTarget = await fsp.realpath(targetDir);
  if (!(realTarget === realBase || realTarget.startsWith(realBase + path.sep))) {
    throw new Error(`${label} is outside allowed root`);
  }
}

async function walkNoSymlinks(dir: string): Promise<void> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const st = await fsp.lstat(full);
    if (st.isSymbolicLink()) {
      throw new Error(`Symlink not allowed in promoted skill: ${full}`);
    }
    if (entry.isDirectory()) {
      await walkNoSymlinks(full);
    }
  }
}

async function listFiles(dir: string, prefix = dir): Promise<string[]> {
  const out: string[] = [];
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await listFiles(full, prefix)));
    }
    if (entry.isFile()) {
      out.push(path.relative(prefix, full));
    }
  }
  return out.sort();
}

async function computeFolderHash(dir: string): Promise<string> {
  const files = await listFiles(dir);
  const h = crypto.createHash("sha256");
  for (const rel of files) {
    const content = await fsp.readFile(path.join(dir, rel));
    h.update(rel);
    h.update("\0");
    h.update(content);
    h.update("\0");
  }
  return h.digest("hex");
}

async function copyDir(src: string, dst: string): Promise<void> {
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      await fsp.copyFile(s, d);
      const st = await fsp.stat(s);
      await fsp.chmod(d, st.mode);
    }
  }
}

function parseArgs(argv: string[]): { skillName?: string; requestId?: string } {
  let skillName: string | undefined;
  let requestId: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--request-id") {
      requestId = argv[i + 1];
      i++;
      continue;
    }
    if (!skillName && !arg.startsWith("--")) {
      skillName = arg;
    }
  }

  return { skillName, requestId };
}

async function resolveRequestId(skillName: string, explicitId?: string): Promise<string | undefined> {
  initSkillRequestStore();

  if (explicitId) {
    const req = getSkillRequestById(explicitId);
    if (!req) {
      throw new Error(`SkillRequest not found: ${explicitId}`);
    }
    return explicitId;
  }

  const candidates = listSkillRequests().filter((r) => {
    const text = `${r.goal} ${r.source_context || ""}`.toLowerCase();
    return text.includes(skillName.toLowerCase());
  });

  return candidates[0]?.id;
}

async function appendEvolutionLogEntry(params: {
  skillName: string;
  semver: string;
  hash: string;
  requestId?: string;
  mergedFrom: string[];
}) {
  const logPath = path.join(process.cwd(), "documents", "evolution-log.md");
  const nowIso = new Date().toISOString();
  const mergeLabel = params.mergedFrom.length > 0 ? params.mergedFrom.join(", ") : "none";

  const block = `\n## ${nowIso} Skill Promotion (${params.skillName})\n\n### Change summary\n- Promoted \\`${params.skillName}\\` into production registry.\n- Advanced lifecycle metadata: state=\\`active\\`, semantic_version=\\`${params.semver}\\`.\n- Merge lineage updated (merged_from=${mergeLabel}).\n\n### Metrics before/after\n- Registry entry hash: \\`${params.hash}\\`.\n- Associated SkillRequest: ${params.requestId ? `\\`${params.requestId}\\`` : "none"}.\n\n### Risk introduced\n- Low: metadata schema expanded; older readers that assume v1 fields only may ignore new lifecycle fields.\n\n### Rollback instructions\n1. Revert this promotion commit (or remove \\`${params.skillName}\\` from \\`skills/manifest-registry.json\\`).\n2. Re-run: \\`pnpm lint && pnpm test && pnpm build\\`.\n`;

  await fsp.mkdir(path.dirname(logPath), { recursive: true });
  await fsp.appendFile(logPath, block, "utf-8");
}

async function main() {
  ensureSelfGrowthMode();

  const { skillName, requestId } = parseArgs(process.argv.slice(2));
  if (!skillName) {
    throw new Error("Usage: npx tsx scripts/promote-skill.ts <skill-name> [--request-id <id>]");
  }
  if (!/^[a-z0-9-]+$/.test(skillName)) {
    throw new Error("Skill name must be kebab-case [a-z0-9-]");
  }

  const root = process.cwd();
  const workshopRoot = path.join(root, "skills_workshop");
  const skillsRoot = path.join(root, "skills");
  const srcDir = path.join(workshopRoot, skillName);
  const dstDir = path.join(skillsRoot, skillName);
  const registryFile = path.join(skillsRoot, "manifest-registry.json");

  if (!fs.existsSync(srcDir)) {
    throw new Error(`Workshop skill does not exist: ${srcDir}`);
  }

  await assertWithin(workshopRoot, srcDir, "Source skill");
  await walkNoSymlinks(srcDir);

  const skillDoc = path.join(srcDir, "SKILL.md");
  const scriptsDir = path.join(srcDir, "scripts");
  if (!fs.existsSync(skillDoc)) throw new Error(`Missing required file: ${skillDoc}`);
  if (!fs.existsSync(scriptsDir)) throw new Error(`Missing required directory: ${scriptsDir}`);

  const scriptFiles = (await fsp.readdir(scriptsDir)).filter((f) => f.endsWith(".sh")).sort();
  if (scriptFiles.length === 0) throw new Error("No .sh scripts found under scripts/");

  const entryScriptRel = `skills/${skillName}/scripts/${scriptFiles[0]}`;
  const skillPathRel = `skills/${skillName}/SKILL.md`;

  await fsp.mkdir(skillsRoot, { recursive: true });
  if (fs.existsSync(dstDir)) {
    await fsp.rm(dstDir, { recursive: true, force: true });
  }
  await copyDir(srcDir, dstDir);

  const existingRaw = fs.existsSync(registryFile)
    ? JSON.parse(await fsp.readFile(registryFile, "utf-8"))
    : { version: 2, skills: [] };
  const registry = parseManifestRegistry(existingRaw);

  const folderHash = await computeFolderHash(dstDir);
  const associatedRequestId = await resolveRequestId(skillName, requestId);
  const existing = registry.skills.find((s) => s.name === skillName);
  const nextSemver = computeNextSemver(existing?.semantic_version);
  const mergedFrom = existing?.merge_lineage?.merged_from || [];

  const updatedRegistry = upsertSkillEntry(registry, {
    name: skillName,
    path: skillPathRel,
    entry_script: entryScriptRel,
    enabled: true,
    version: (existing?.version || 0) + 1,
    hash_sha256: folderHash,
    runtime_skill_id: existing?.runtime_skill_id ?? null,
    required_tools: existing?.required_tools ?? ["shell"],
    tier: existing?.tier ?? 1,
    lifecycle_state: "active",
    semantic_version: nextSemver,
    evolved_from_request_id: associatedRequestId,
    last_promoted_at: new Date().toISOString(),
    merge_lineage: {
      parent_skill: existing?.merge_lineage?.parent_skill,
      merged_from: mergedFrom,
      merged_into: existing?.merge_lineage?.merged_into,
    },
  });

  await fsp.writeFile(registryFile, JSON.stringify(updatedRegistry, null, 2) + "\n", "utf-8");

  if (associatedRequestId) {
    const req = getSkillRequestById(associatedRequestId);
    if (req && req.status === "building") {
      updateSkillRequestStatus(associatedRequestId, "promoted");
    }
  }

  await initLedger();
  await appendEntry("security", "skill-promoter", associatedRequestId || "promotion", "skill_promoted", {
    type: "skill_promoted",
    skill: skillName,
    request_id: associatedRequestId,
    hash_sha256: folderHash,
    lifecycle_state: "active",
    semantic_version: nextSemver,
    merge_lineage: { merged_from: mergedFrom },
  });

  await appendEvolutionLogEntry({
    skillName,
    semver: nextSemver,
    hash: folderHash,
    requestId: associatedRequestId,
    mergedFrom,
  });

  console.log(`Promoted skill: ${skillName}`);
  console.log(`Entry script: ${entryScriptRel}`);
  console.log(`Folder hash: ${folderHash}`);
  if (associatedRequestId) {
    console.log(`Linked SkillRequest: ${associatedRequestId}`);
  }
}

main().catch((err) => {
  console.error(`[promote-skill] ${err.message}`);
  process.exit(1);
});
