export * from "./collector.js";
export * from "./spec-generator.js";
export * from "./worker.js";
export * from "./report.js";
import { getIssueBacklog, updateIssueStatus } from "./collector.js";
import { generateSpec } from "./spec-generator.js";
import { BranchWorker } from "./worker.js";
import { saveReport, getLatestReport } from "./report.js";
export { getLatestReport };
import { bus } from "@cairn/shared";
import { getSkillRequestById, initSkillRequestStore, listSkillRequests, updateSkillRequestStatus, } from "@cairn/skills";
let isRunning = false;
function isSelfGrowthEnabled() {
    return process.env.CAIRN_MODE === "grow" || process.env.CAIRN_SELF_GROWTH === "enabled";
}
function toIssueFromSkillRequest(req) {
    return {
        id: req.id,
        timestamp: new Date(req.created_at).toISOString(),
        source: "manual",
        category: "behaviour",
        summary: `SkillRequest: ${req.goal}`,
        rawContext: JSON.stringify({
            required_tools: req.required_tools,
            proposed_tier: req.proposed_tier,
            source_context: req.source_context,
        }),
        severity: "high",
        status: "open",
    };
}
export async function runNightlyBuilder(manualIssues, skillRequestId) {
    if (!isSelfGrowthEnabled()) {
        console.warn("[builder] Disabled unless CAIRN_MODE=grow or CAIRN_SELF_GROWTH=enabled");
        return;
    }
    if (isRunning) {
        console.warn("[builder] Already running, skipping trigger");
        return;
    }
    initSkillRequestStore();
    const pending = listSkillRequests("pending");
    console.log(`[builder] Pending skill requests: ${pending.length}`);
    let boundSkillRequestId;
    if (skillRequestId) {
        const req = getSkillRequestById(skillRequestId);
        if (!req) {
            console.warn(`[builder] SkillRequest not found: ${skillRequestId}`);
            return;
        }
        if (req.status !== "pending") {
            console.warn(`[builder] SkillRequest ${skillRequestId} is not pending (status=${req.status})`);
            return;
        }
        updateSkillRequestStatus(skillRequestId, "building");
        boundSkillRequestId = skillRequestId;
        manualIssues = [toIssueFromSkillRequest(req)];
        bus.emit("builder:progress", `Building explicit SkillRequest ${skillRequestId}`);
    }
    isRunning = true;
    bus.emit("builder:status", "running");
    try {
        // 1. Collect issues
        let issues = manualIssues || await getIssueBacklog("open");
        if (issues.length === 0) {
            console.log("[builder] No open issues to process.");
            bus.emit("builder:progress", "No open issues found.");
            bus.emit("builder:status", "completed");
            return;
        }
        // 2. Generate Spec
        bus.emit("builder:progress", `Found ${issues.length} issues. Generating design spec...`);
        const spec = await generateSpec(issues);
        // 3. Run Worker
        bus.emit("builder:progress", "Starting build process...");
        const worker = new BranchWorker(spec);
        const success = await worker.run();
        // 4. Save Report
        const report = await saveReport(spec, worker.getReport().state);
        if (boundSkillRequestId) {
            if (success) {
                bus.emit("builder:progress", `SkillRequest ${boundSkillRequestId} built; awaiting promotion.`);
            }
            else {
                updateSkillRequestStatus(boundSkillRequestId, "rejected");
                bus.emit("builder:progress", `SkillRequest ${boundSkillRequestId} rejected after failed build.`);
            }
        }
        // 5. Update issues
        for (const issueId of spec.issues) {
            await updateIssueStatus(issueId, "addressed");
        }
        bus.emit("builder:report", report);
        bus.emit("builder:status", success ? "completed" : "failed");
        bus.emit("builder:progress", success ? "Build completed successfully." : "Build failed.");
    }
    catch (err) {
        if (boundSkillRequestId) {
            try {
                updateSkillRequestStatus(boundSkillRequestId, "rejected");
            }
            catch {
                // Ignore transition errors in catch path
            }
        }
        console.error("[builder] Nightly run failed:", err);
        bus.emit("builder:status", "failed");
        bus.emit("builder:progress", `Error: ${err}`);
    }
    finally {
        isRunning = false;
    }
}
export function getBuilderStatus() {
    return isRunning ? "running" : "idle";
}
//# sourceMappingURL=index.js.map