import type { NodeConfig } from "@cairn/shared";
export declare class PolicyViolation extends Error {
    violation: string;
    caller: string;
    target: string;
    detail?: string | undefined;
    constructor(violation: string, caller: string, target: string, detail?: string | undefined);
}
export declare function getNodeConfig(nodeName: string): NodeConfig;
export declare function checkCaller(caller: string, targetNode: string): void;
export declare function checkTransition(from: string, to: string): void;
export declare function checkTool(nodeName: string, tool: string, toolTier: number): void;
export declare function checkAllowlist(domain: string, allowlist: string[]): void;
export declare function checkMemoryAccess(nodeName: string, tier: string, operation: "read" | "write"): void;
//# sourceMappingURL=check.d.ts.map