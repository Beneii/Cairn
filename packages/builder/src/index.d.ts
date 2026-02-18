export * from "./collector.js";
export * from "./spec-generator.js";
export * from "./worker.js";
export * from "./report.js";
import { getLatestReport } from "./report.js";
export { getLatestReport };
export declare function runNightlyBuilder(manualIssues?: any[], skillRequestId?: string): Promise<void>;
export declare function getBuilderStatus(): string;
//# sourceMappingURL=index.d.ts.map