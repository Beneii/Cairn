import { getDataPath, newId, now, bus } from "@cairn/shared";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export interface BuilderIssue {
    id: string;
    timestamp: string;
    source: "ledger" | "bus" | "manual";
    category: "parse_error" | "tool_failure" | "build_error" | "type_error" | "behaviour" | "other";
    summary: string;
    rawContext?: string;
    file?: string;
    severity: "low" | "medium" | "high";
    status: "open" | "addressed" | "deferred";
}

const ISSUE_FILE = join(getDataPath("builder"), "issues.json");

let issues: BuilderIssue[] = [];
let initialized = false;

async function ensureInit(): Promise<void> {
    if (initialized) return;
    try {
        await mkdir(getDataPath("builder"), { recursive: true });
        if (existsSync(ISSUE_FILE)) {
            const raw = await readFile(ISSUE_FILE, "utf-8");
            issues = JSON.parse(raw);
        }
    } catch (err) {
        console.error("[builder] Failed to init issues db:", err);
    }
    initialized = true;
}

async function persist(): Promise<void> {
    await ensureInit();
    await writeFile(ISSUE_FILE, JSON.stringify(issues, null, 2));
}

export async function collectIssue(input: Omit<BuilderIssue, "id" | "timestamp" | "status" | "severity"> & { severity?: BuilderIssue["severity"] }): Promise<string> {
    await ensureInit();

    // Deduplicate: if same summary exists and is open, just bump timestamp
    const existing = issues.find(i => i.summary === input.summary && i.status === "open");
    if (existing) {
        existing.timestamp = now();
        existing.rawContext = input.rawContext; // update detailed context
        await persist();
        return existing.id;
    }

    const issue: BuilderIssue = {
        id: newId(),
        timestamp: now(),
        status: "open",
        severity: input.severity || "medium",
        ...input,
    };

    issues.push(issue);
    await persist();

    // Notify dashboard
    bus.emit("builder:issue", issue);

    return issue.id;
}

export async function getIssueBacklog(status?: BuilderIssue["status"]): Promise<BuilderIssue[]> {
    await ensureInit();
    if (status) return issues.filter(i => i.status === status);
    return issues;
}

export async function updateIssueStatus(id: string, status: BuilderIssue["status"]): Promise<void> {
    await ensureInit();
    const issue = issues.find(i => i.id === id);
    if (issue) {
        issue.status = status;
        await persist();
    }
}
