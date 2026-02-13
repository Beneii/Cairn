export interface BuilderIssue {
    id: string;
    timestamp: string;
    source: "ledger" | "bus" | "manual";
    category: "parse_error" | "tool_failure" | "build_error" | "type_error" | "behaviour" | "other";
    summary: string;
    rawContext?: string;
    file?: string;
    severity: "low" | "medium" | "high";
    status: "open" | "addressed" | "deferred";
}
export declare function collectIssue(input: Omit<BuilderIssue, "id" | "timestamp" | "status" | "severity"> & {
    severity?: BuilderIssue["severity"];
}): Promise<string>;
export declare function getIssueBacklog(status?: BuilderIssue["status"]): Promise<BuilderIssue[]>;
export declare function updateIssueStatus(id: string, status: BuilderIssue["status"]): Promise<void>;
//# sourceMappingURL=collector.d.ts.map