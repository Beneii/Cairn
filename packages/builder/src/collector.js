import { getDataPath, newId, now, bus } from "@cairn/shared";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
const ISSUE_FILE = join(getDataPath("builder"), "issues.json");
let issues = [];
let initialized = false;
async function ensureInit() {
    if (initialized)
        return;
    try {
        await mkdir(getDataPath("builder"), { recursive: true });
        if (existsSync(ISSUE_FILE)) {
            const raw = await readFile(ISSUE_FILE, "utf-8");
            issues = JSON.parse(raw);
        }
    }
    catch (err) {
        console.error("[builder] Failed to init issues db:", err);
    }
    initialized = true;
}
async function persist() {
    await ensureInit();
    await writeFile(ISSUE_FILE, JSON.stringify(issues, null, 2));
}
export async function collectIssue(input) {
    await ensureInit();
    // Deduplicate: if same summary exists and is open, just bump timestamp
    const existing = issues.find(i => i.summary === input.summary && i.status === "open");
    if (existing) {
        existing.timestamp = now();
        existing.rawContext = input.rawContext; // update detailed context
        await persist();
        return existing.id;
    }
    const issue = {
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
export async function getIssueBacklog(status) {
    await ensureInit();
    if (status)
        return issues.filter(i => i.status === status);
    return issues;
}
export async function updateIssueStatus(id, status) {
    await ensureInit();
    const issue = issues.find(i => i.id === id);
    if (issue) {
        issue.status = status;
        await persist();
    }
}
//# sourceMappingURL=collector.js.map