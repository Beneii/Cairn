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

export async function getLatestReport(): Promise<BuildReport | null> {
    try {
        const dir = join(getDataPath("builder"), "reports");
        const { readdir, readFile } = await import("fs/promises");
        const files = await readdir(dir).catch(() => []);
        if (files.length === 0) return null;

        // Sort by name (which is task ID, could be sorted by mtime for robustness)
        // Task ID is random, so better to sort by mtime
        const { stat } = await import("fs/promises");

        const filesWithStats = await Promise.all(files.map(async (f: string) => {
            const s = await stat(join(dir, f));
            return { name: f, time: s.mtime.getTime() };
        }));

        filesWithStats.sort((a, b) => b.time - a.time);

        if (filesWithStats.length === 0) return null;

        const content = await readFile(join(dir, filesWithStats[0].name), "utf-8");
        return JSON.parse(content);
    } catch (err) {
        console.error("[builder] Failed to load latest report:", err);
        return null;
    }
}
