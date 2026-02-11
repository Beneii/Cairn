import { checkTool, PolicyViolation } from "@cairn/policy";
import { appendEntry } from "@cairn/ledger";
import { newId, now, bus, FailureCode, withFailureCode } from "@cairn/shared";
import { metrics } from "@cairn/telemetry";
import type { ToolInput, ToolResult, ToolContext } from "./tools.js";
import { getTool } from "./tools.js";
import { executeTool as executeManifestTool } from "./manifest.js";
import { registerAllTools } from "./tools/index.js";

let manifestRegistered = false;

function ensureManifestRegistry(): void {
  if (manifestRegistered) return;
  registerAllTools();
  manifestRegistered = true;
}

const MANIFEST_TOOL_ALIAS: Partial<Record<string, string>> = {
  "memory_read": "memory.read",
  "memory_write": "memory.write",
  "fetch_url": "web.fetch",
  "vector_search": "vector_search",
  "calendar_read": "calendar.list_events",
};

type ManifestMode = "fallback" | "prefer" | "strict";

function getManifestMode(): ManifestMode {
  const mode = process.env.EXECUTOR_MANIFEST_MODE;
  if (mode === "prefer" || mode === "strict") return mode;
  return "fallback";
}

function toManifestInput(name: string, args: Record<string, unknown>): Record<string, unknown> {
  if (name === "fetch_url") {
    return {
      url: args.url,
      maxBytes: 2000,
    };
  }
  if (name === "vector_search") {
    return {
      query: args.query,
      top_k: 5,
      min_score: 0.3,
    };
  }
  if (name === "calendar_read") {
    return {
      days: Number(args.days ?? 1),
    };
  }
  return args;
}

function fromManifestOutput(name: string, data: unknown, args: Record<string, unknown>): string {
  if (name === "memory_read") {
    const payload = data as { found?: boolean; value?: unknown };
    return payload?.found ? JSON.stringify(payload.value) : "No value found";
  }
  if (name === "memory_write") {
    return `Written to ${String(args.tier)}:${String(args.key)} `;
  }
  if (name === "fetch_url") {
    const payload = data as { content?: string };
    return payload?.content ?? "";
  }
  if (name === "vector_search") {
    const payload = data as { results?: Array<{ content: string; score: number; document_title: string }> };
    return JSON.stringify(
      (payload?.results || []).map((r) => ({
        content: r.content,
        score: r.score.toFixed(3),
        source: r.document_title,
      })),
    );
  }
  if (name === "calendar_read") {
    const payload = data as { events?: unknown[]; count?: number };
    return JSON.stringify({
      event_count: payload?.count ?? payload?.events?.length ?? 0,
      events: payload?.events ?? [],
    });
  }
  return JSON.stringify(data ?? { ok: true });
}

async function runManifestMappedTool(
  input: ToolInput,
  context: ToolContext & { allowedTools: string[] },
): Promise<ToolResult | null> {
  ensureManifestRegistry();
  const manifestTool = MANIFEST_TOOL_ALIAS[input.name];
  if (!manifestTool) return null;

  const manifestResult = await executeManifestTool(
    manifestTool,
    toManifestInput(input.name, input.args),
    {
      jobId: context.jobId,
      nodeName: context.nodeName,
      memoryRead: context.memoryRead,
      memoryWrite: context.memoryWrite,
    },
  );

  if (manifestResult.ok) {
    return {
      success: true,
      output: fromManifestOutput(input.name, manifestResult.output.data, input.args),
    };
  }

  return {
    success: false,
    output: withFailureCode(
      FailureCode.TOOL_EXECUTION_FAILED,
      manifestResult.output.error || `Manifest tool error: ${manifestTool}`,
    ),
  };
}

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
  const manifestMode = getManifestMode();
  const mappedManifestTool = MANIFEST_TOOL_ALIAS[input.name];

  if (mappedManifestTool && (manifestMode === "prefer" || manifestMode === "strict")) {
    metrics.record("executor_manifest_attempt", 1, {
      tool: input.name,
      manifest_tool: mappedManifestTool,
      mode: manifestMode,
      path: "prefer_or_strict",
    });
    const manifestResult = await runManifestMappedTool(input, context);
    if (manifestResult?.success || manifestMode === "strict") {
      metrics.record("executor_manifest_success", 1, {
        tool: input.name,
        manifest_tool: mappedManifestTool,
        mode: manifestMode,
      });
      return manifestResult as ToolResult;
    }
    metrics.record("executor_manifest_failure", 1, {
      tool: input.name,
      manifest_tool: mappedManifestTool,
      mode: manifestMode,
      fallback: "legacy",
    });
  }

  const toolFn = getTool(input.name);
  if (!toolFn) {
    if (mappedManifestTool) {
      metrics.record("executor_manifest_attempt", 1, {
        tool: input.name,
        manifest_tool: mappedManifestTool,
        mode: manifestMode,
        path: "fallback_missing_legacy",
      });
      const manifestResult = await runManifestMappedTool(input, context);
      if (manifestResult) {
        metrics.record(manifestResult.success ? "executor_manifest_success" : "executor_manifest_failure", 1, {
          tool: input.name,
          manifest_tool: mappedManifestTool,
          mode: manifestMode,
          fallback: "none",
        });
        return manifestResult;
      }
    }
    metrics.record("executor_capability_missing", 1, {
      tool: input.name,
      mode: manifestMode,
    });
    return {
      success: false,
      output: withFailureCode(FailureCode.CAPABILITY_MISSING, `Tool "${input.name}" does not exist`),
    };
  }

  // 3. Execute
  try {
    metrics.record("executor_legacy_attempt", 1, {
      tool: input.name,
      mode: manifestMode,
    });
    bus.emit("log:entry", {
      id: newId(),
      timestamp: now(),
      type: "tool",
      content: `Executing tool: ${input.name}(${JSON.stringify(input.args)})`,
    });

    const result = await toolFn(input.args, context);
    metrics.record(result.success ? "executor_legacy_success" : "executor_legacy_failure", 1, {
      tool: input.name,
      mode: manifestMode,
    });

    bus.emit("log:entry", {
      id: newId(),
      timestamp: now(),
      type: "tool",
      content: `Tool result: ${result.output.substring(0, 200)}`,
    });

    return result;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    metrics.record("executor_legacy_failure", 1, {
      tool: input.name,
      mode: manifestMode,
      reason: "exception",
    });
    return { success: false, output: withFailureCode(FailureCode.TOOL_EXECUTION_FAILED, `Tool error: ${errorMsg}`) };
  }
}

export async function executeTools(
  inputs: ToolInput[],
  context: ToolContext & { allowedTools: string[] },
): Promise<ToolResult[]> {
  return Promise.all(inputs.map((input) => executeTool(input, context)));
}
