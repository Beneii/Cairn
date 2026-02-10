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
    allowed_tools: ["memory_read", "memory_write", "ledger_write", "web_search", "fetch_url", "vector_search", "calendar_read", "gmail_read", "goals_read", "goals_update", "tasks_read", "tasks_create", "tasks_complete", "note_create", "research_ingest", "browser_navigate", "browser_click", "browser_screenshot"],
    memory_access: ["hot", "warm"],
    memory_write: ["hot", "warm"],
    max_runtime_seconds: 300,
    max_tokens_per_call: 5000,
    assigned_model: "gpt-4o",
  },
  critic: {
    name: "critic",
    allowed_callers: ["executor", "orchestrator"],
    allowed_tools: ["memory_read", "goals_read"],
    memory_access: ["hot", "warm"],
    memory_write: [],
    max_runtime_seconds: 60,
    max_tokens_per_call: 4000,
    assigned_model: "gpt-4o",
  },
  web_locked: {
    name: "web_locked",
    allowed_callers: ["planner", "executor", "orchestrator"],
    allowed_tools: [], // NO TOOLS - read-only analysis only
    memory_access: [], // NO MEMORY ACCESS
    memory_write: [], // NO MEMORY WRITE - this is critical
    max_runtime_seconds: 60,
    max_tokens_per_call: 4000,
    assigned_model: "gpt-4o-mini",
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
  web_agent: {
    name: "web_agent",
    allowed_callers: ["orchestrator"],
    allowed_tools: ["browser_navigate", "browser_click", "browser_type", "browser_press", "browser_screenshot", "browser_close", "browser_observe"],
    memory_access: ["hot", "warm"],
    memory_write: ["hot", "warm"],
    max_runtime_seconds: 300,
    max_tokens_per_call: 5000,
    assigned_model: "gpt-4o",
  },
};

/** Allowed transitions: from -> to[] */
export const GRAPH_EDGES: Record<string, string[]> = {
  system: ["gatekeeper"],
  gatekeeper: ["planner", "logger", "web_agent"],
  planner: ["executor", "web_locked", "logger"],
  executor: ["critic", "web_locked", "logger"],
  critic: ["executor", "logger"],
  web_locked: ["logger"], // Can only log, cannot call anything else
  web_agent: ["logger"],
  logger: [],
};

