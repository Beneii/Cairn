import { checkTool, PolicyViolation } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { newId, now, bus, FailureCode, withFailureCode } from "@cairn/shared";
import type { ToolInput, ToolResult, ToolContext } from "./tools.js";
import { getTool } from "./tools.js";

export async function executeTool(
  input: ToolInput,
  context: ToolContext & { allowedTools: string[] },
): Promise<ToolResult> {
  // 1. Policy enforcement
  try {
    checkTool(context.nodeName, input.name, 0);
  } catch (err) {
    if (err instanceof PolicyViolation) {
      await appendEntry(
        "security",
        context.nodeName,
        context.jobId,
        `Tool policy violation: ${input.name} not allowed for ${context.nodeName}`,
      );
      return {
        success: false,
        output: withFailureCode(FailureCode.PERMISSION_DENIED, `Tool "${input.name}" is not permitted for this node`),
      };
    }
    throw err;
  }

  // 2. Resolve tool
  const toolFn = getTool(input.name);
  if (!toolFn) {
    return {
      success: false,
      output: withFailureCode(FailureCode.CAPABILITY_MISSING, `Tool "${input.name}" does not exist`),
    };
  }

  // 3. Execute
  try {
    bus.emit("log:entry", {
      id: newId(),
      timestamp: now(),
      type: "tool",
      content: `Executing tool: ${input.name}(${JSON.stringify(input.args)})`,
    });

    const result = await toolFn(input.args, context);

    bus.emit("log:entry", {
      id: newId(),
      timestamp: now(),
      type: "tool",
      content: `Tool result: ${result.output.substring(0, 200)}`,
    });

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, output: withFailureCode(FailureCode.TOOL_EXECUTION_FAILED, `Tool error: ${errorMsg}`) };
  }
}

export async function executeTools(
  inputs: ToolInput[],
  context: ToolContext & { allowedTools: string[] },
): Promise<ToolResult[]> {
  return Promise.all(inputs.map((input) => executeTool(input, context)));
}
