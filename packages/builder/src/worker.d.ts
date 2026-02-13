import { BuildSpec } from "./spec-generator.js";
export interface WorkerState {
    status: "idle" | "working" | "paused" | "completed" | "failed";
    currentTask?: string;
    stepsCompleted: number;
    logs: string[];
}
export declare class BranchWorker {
    private spec;
    private state;
    private root;
    constructor(spec: BuildSpec);
    private log;
    run(): Promise<boolean>;
    private executeTask;
    private exec;
    getReport(): any;
}
//# sourceMappingURL=worker.d.ts.map