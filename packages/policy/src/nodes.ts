import type { NodeConfig } from "@cairn/shared";

export const NODES: Record<string, NodeConfig> = {
  gatekeeper: {
    name: "gatekeeper",
    allowed_callers: ["system"],
    allowed_tools: [],
    memory_access: ["hot"],
    memory_write: ["hot"],
    max_runtime_seconds: 10,
    max_tokens_per_call: 1000,
    assigned_model: "gpt-4o-mini",
  },
  planner: {
    name: "planner",
    allowed_callers: ["orchestrator"],
    allowed_tools: ["memory_read"],
    memory_access: ["hot", "warm"],
    memory_write: ["hot", "warm"],
    max_runtime_seconds: 120,
    max_tokens_per_call: 10000,
    assigned_model: "gpt-4o",
  },
  executor: {
    name: "executor",
    allowed_callers: ["planner", "orchestrator"],
    allowed_tools: ["memory_read", "memory_write", "ledger_write", "web_search", "fetch_url"],
    memory_access: ["hot", "warm"],
    memory_write: ["hot", "warm"],
    max_runtime_seconds: 300,
    max_tokens_per_call: 5000,
    assigned_model: "gpt-4o",
  },
  logger: {
    name: "logger",
    allowed_callers: ["all"],
    allowed_tools: ["ledger_write"],
    memory_access: [],
    memory_write: [],
    max_runtime_seconds: 5,
    max_tokens_per_call: 0,
    assigned_model: "none",
  },
};

/** Allowed transitions: from -> to[] */
export const GRAPH_EDGES: Record<string, string[]> = {
  system: ["gatekeeper"],
  gatekeeper: ["planner", "logger"],
  planner: ["executor", "logger"],
  executor: ["logger"],
  logger: [],
};
