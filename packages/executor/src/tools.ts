import { appendEntry } from "@cairn/ledger";
import type { Artifact, LedgerEntryType } from "@cairn/shared";
import { newId, now } from "@cairn/shared";

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

export type ToolFn = (
  args: Record<string, unknown>,
  ctx: ToolContext,
) => Promise<ToolResult>;

const toolRegistry = new Map<string, ToolFn>();

// ---- memory_read ----
toolRegistry.set("memory_read", async (args, ctx) => {
  const tier = args.tier as string;
  const key = args.key as string;
  const value = ctx.memoryRead(tier, key);
  return {
    success: true,
    output: value !== undefined ? JSON.stringify(value) : "No value found",
  };
});

// ---- memory_write ----
toolRegistry.set("memory_write", async (args, ctx) => {
  const tier = args.tier as string;
  const key = args.key as string;
  const value = args.value;
  await ctx.memoryWrite(tier, key, value);
  return {
    success: true,
    output: `Written to ${tier}:${key}`,
  };
});

// ---- ledger_write ----
toolRegistry.set("ledger_write", async (args, ctx) => {
  const type = (args.type as LedgerEntryType) || "agent";
  const content = args.content as string;
  await appendEntry(type, ctx.nodeName, ctx.jobId, content);
  return {
    success: true,
    output: `Logged: ${content}`,
  };
});

export function getTool(name: string): ToolFn | undefined {
  return toolRegistry.get(name);
}

export function listTools(): string[] {
  return Array.from(toolRegistry.keys());
}
