import type { Artifact } from "@cairn/shared";
export interface ToolInput {
    name: string;
    args: Record<string, unknown>;
}
export interface ToolResult {
    success: boolean;
    output: string;
    artifact?: Artifact;
}
export interface ToolContext {
    jobId: string;
    nodeName: string;
    memoryRead: (tier: string, key: string) => unknown | undefined;
    memoryWrite: (tier: string, key: string, value: unknown) => Promise<void>;
}
export type ToolFn = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;
export declare function getTool(name: string): ToolFn | undefined;
export declare function listTools(): string[];
//# sourceMappingURL=tools.d.ts.map