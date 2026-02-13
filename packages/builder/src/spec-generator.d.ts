import { BuilderIssue } from "./collector.js";
export interface BuildTask {
    id: string;
    description: string;
    targetFile: string;
    changeType: "modify" | "create" | "delete";
    testCommand?: string;
}
export interface BuildSpec {
    id: string;
    created: string;
    branch: string;
    issues: string[];
    tasks: BuildTask[];
    successCriteria: string[];
    scopeAllowlist: string[];
    scopeDenylist: string[];
    estimatedSteps: number;
    maxSteps: number;
    maxDurationMinutes: number;
}
export declare function generateSpec(issues: BuilderIssue[]): Promise<BuildSpec>;
//# sourceMappingURL=spec-generator.d.ts.map