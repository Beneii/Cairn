export * from "./collector.js";
export * from "./spec-generator.js";
export * from "./worker.js";
export * from "./report.js";

import { collectIssue, getIssueBacklog, updateIssueStatus } from "./collector.js";
import { generateSpec } from "./spec-generator.js";
import { BranchWorker } from "./worker.js";
import { saveReport, getLatestReport } from "./report.js";
export { getLatestReport };
import { bus } from "@cairn/shared";

let isRunning = false;

export async function runNightlyBuilder(manualIssues?: any[]): Promise<void> {
    if (isRunning) {
        console.warn("[builder] Already running, skipping trigger");
        return;
    }
    isRunning = true;
    bus.emit("builder:status", "running");

    try {
        // 1. Collect issues
        let issues = manualIssues || await getIssueBacklog("open");
        if (issues.length === 0) {
            console.log("[builder] No open issues to process.");
            return;
        }

        // 2. Generate Spec
        bus.emit("builder:progress", "Generating design spec...");
        const spec = await generateSpec(issues);

        // 3. Run Worker
        const worker = new BranchWorker(spec);
        await worker.run();

        // 4. Save Report
        const report = await saveReport(spec, worker.getReport().state);

        // 5. Update issues
        for (const issueId of spec.issues) {
            await updateIssueStatus(issueId, "addressed");
        }

        bus.emit("builder:report", report);
        bus.emit("builder:status", "completed");

    } catch (err) {
        console.error("[builder] Nightly run failed:", err);
        bus.emit("builder:status", "failed");
    } finally {
        isRunning = false;
    }
}

export function getBuilderStatus(): string {
    return isRunning ? "running" : "idle";
}
