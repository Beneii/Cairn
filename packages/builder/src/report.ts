import { BuildSpec } from "./spec-generator.js";
import { WorkerState } from "./worker.js";
import { getDataPath, now } from "@cairn/shared";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export interface BuildReport {
    id: string; // spec ID
    date: string;
    branch: string;
    status: WorkerState["status"];
    stepsCompleted: number;
    issuesAddressed: string[];
    logs: string[];
    summary: string;
}

export async function saveReport(spec: BuildSpec, state: WorkerState): Promise<BuildReport> {
    const report: BuildReport = {
        id: spec.id,
        date: now(),
        branch: spec.branch,
        status: state.status,
        stepsCompleted: state.stepsCompleted,
        issuesAddressed: spec.issues,
        logs: state.logs,
        summary: `Builder run ${state.status} on branch ${spec.branch}. ${state.stepsCompleted}/${spec.tasks.length} tasks completed.`
    };

    const dir = join(getDataPath("builder"), "reports");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, `${spec.id}.json`), JSON.stringify(report, null, 2));

    return report;
}
