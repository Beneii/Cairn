import type { ToolInput, ToolResult, ToolContext } from "./tools.js";
export declare function executeTool(input: ToolInput, context: ToolContext & {
    allowedTools: string[];
}): Promise<ToolResult>;
export declare function executeTools(inputs: ToolInput[], context: ToolContext & {
    allowedTools: string[];
}): Promise<ToolResult[]>;
//# sourceMappingURL=executor.d.ts.map