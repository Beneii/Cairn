import { getDataPath, now } from "@cairn/shared";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
export async function saveReport(spec, state) {
    const report = {
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
//# sourceMappingURL=report.js.map