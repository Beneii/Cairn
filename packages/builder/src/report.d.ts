import { BuildSpec } from "./spec-generator.js";
import { WorkerState } from "./worker.js";
export interface BuildReport {
    id: string;
    date: string;
    branch: string;
    status: WorkerState["status"];
    stepsCompleted: number;
    issuesAddressed: string[];
    logs: string[];
    summary: string;
}
export declare function saveReport(spec: BuildSpec, state: WorkerState): Promise<BuildReport>;
//# sourceMappingURL=report.d.ts.map