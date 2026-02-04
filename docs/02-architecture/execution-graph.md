# Execution Graph

Understanding CAIRN's node-based orchestration model.

## Overview

From [truth.md](../../truth.md):

The Orchestrator executes a **policy-enforced directed graph** of nodes.

**Hard rule:**
> If a transition is not declared in the graph, it cannot occur.

This ensures:
- Explicit control flow
- No hidden paths
- Security through declaration
- Clear permissions

## Node Structure

Each node declares:

```typescript
interface NodeConfig {
  // Who can call this node
  allowed_callers: string[];

  // What tools this node can use
  allowed_tools: string[];

  // What memory tiers this node can access
  memory_access: ("hot" | "warm" | "cold")[];
  memory_write: ("hot" | "warm")[];  // Never "cold"

  // Execution constraints
  max_runtime_seconds: number;
  max_tokens_per_call: number;

  // Which model to use
  assigned_model: string;
}
```

## Example Nodes

### gatekeeper

```typescript
{
  allowed_callers: ["system"],
  allowed_tools: ["none"],        // No tool execution
  memory_access: ["hot"],
  memory_write: ["hot"],
  max_runtime_seconds: 10,
  max_tokens_per_call: 1000,
  assigned_model: "gpt-4o-mini"   // Cheap model
}
```

**Purpose:** Intent classification, complexity estimation

**Called by:** System (entry point)

**Calls:** Sends job to Orchestrator

### planner

```typescript
{
  allowed_callers: ["orchestrator", "scheduler"],
  allowed_tools: ["memory_read"],
  memory_access: ["hot", "warm"],
  memory_write: ["hot", "warm"],
  max_runtime_seconds: 120,
  max_tokens_per_call: 10000,
  assigned_model: "gpt-4o"        // Powerful model
}
```

**Purpose:** Create task plans, decompose problems

**Called by:** Orchestrator, Scheduler

**Calls:** Executor

### executor

```typescript
{
  allowed_callers: ["planner", "orchestrator"],
  allowed_tools: ["api_call", "file_read", "file_write", "shell"],
  memory_access: ["hot", "warm"],
  memory_write: ["hot"],
  max_runtime_seconds: 300,
  max_tokens_per_call: 5000,
  assigned_model: "gpt-4o"
}
```

**Purpose:** Execute tools, run code, make API calls

**Called by:** Planner

**Calls:** Logger, error handler

### researcher_web_locked

```typescript
{
  allowed_callers: ["planner"],
  allowed_tools: ["browser", "parser"],  // Limited tools
  memory_access: ["hot", "warm"],
  memory_write: ["hot"],
  max_runtime_seconds: 60,
  max_tokens_per_call: 5000,
  assigned_model: "gpt-4o",
  // Additional safety
  no_persistence: true,
  no_cookies: true,
  strip_imperative_language: true
}
```

**Purpose:** Web research with safety constraints

**Called by:** Planner

**Safety:** Cannot store state, no persistent auth

### logger

```typescript
{
  allowed_callers: ["all"],          // Any node can log
  allowed_tools: ["ledger_write"],
  memory_access: ["ledger"],
  memory_write: ["ledger"],
  max_runtime_seconds: 5,
  max_tokens_per_call: 1000,
  assigned_model: "none"             // No model, just logging
}
```

**Purpose:** Write to audit trail

**Called by:** All nodes

**Calls:** Nowhere (terminal node)

## Execution Flow Example

```
User Input
    ↓
┌─────────────────────────────────────────┐
│ gatekeeper (intent classification)      │
│ - Classify task as "write code"         │
│ - Estimate complexity as "large"        │
│ - Create job in "queued" status         │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│ planner (create plan)                   │
│ - Read job requirements                 │
│ - Create step-by-step plan              │
│ - Update job with plan artifact         │
└────────────────┬────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────┐
│ executor (run tools)                    │
│ - Execute step 1: fetch requirements    │
│ - Execute step 2: write code            │
│ - Execute step 3: test code             │
└────────────────┬────────────────────────┘
                 │
                 ↓
        All nodes call → logger
        (log all actions)
                 ↓
            Job complete
```

## Permission Enforcement

### Before Node Executes

```typescript
// 1. Check caller permission
if (!config.allowed_callers.includes(caller)) {
  throw new SecurityError("Unauthorized caller");
  // Log violation to ledger
}

// 2. Check memory access
requested_memory_tier.forEach(tier => {
  if (!config.memory_access.includes(tier)) {
    throw new SecurityError("Memory access denied");
  }
});

// 3. Check tool allowlist
if (tool_request && !config.allowed_tools.includes(tool_request)) {
  throw new SecurityError("Tool not allowed");
}

// All checks pass → execute node
```

### Hard Fail Behavior

Any violation:
1. **Stops execution** immediately
2. **Logs to Ledger** with details
3. **Returns error** to caller
4. **Updates Nucleus** to error state

No way to recover, escalate, or bypass.

## LangGraph Comparison

CAIRN's graph model is inspired by LangGraph:

| Aspect | LangGraph | CAIRN |
|--------|-----------|-------|
| Nodes | Functions/agents | Services |
| Edges | Message passing | Permission declarations |
| State | Shared state dict | Memory tiers |
| Transitions | Conditional routing | Pre-declared only |
| Tools | Available to all | Per-node allowlists |

CAIRN is more restrictive (stricter security).

## Graph Visualization

The Agents page shows the execution graph:

```
        ┌─────────────┐
        │ gatekeeper  │
        └──────┬──────┘
               │ calls
               ↓
        ┌─────────────┐
        │  planner    │
        └──────┬──────┘
               │ calls
               ↓
    ┌──────────────────┐
    │   executor      │
    └──────┬───────────┘
           │ also
           ↓
    ┌──────────────────┐
    │ researcher_web   │
    └──────┬───────────┘
           │ all call
           ↓
        ┌──────────┐
        │  logger  │
        └──────────┘
```

## Graph Definition

(This will be JSON/TypeScript in actual implementation)

```typescript
const executionGraph = {
  nodes: {
    gatekeeper: { /* config */ },
    planner: { /* config */ },
    executor: { /* config */ },
    researcher_web_locked: { /* config */ },
    logger: { /* config */ },
    security_auditor: { /* config */ },
    heartbeat: { /* config */ }
  },
  edges: [
    { from: "gatekeeper", to: "planner" },
    { from: "planner", to: "executor" },
    { from: "planner", to: "researcher_web_locked" },
    { from: "executor", to: "logger" },
    // ... all other transitions
  ]
};
```

## Future Enhancements

- [ ] Dynamic graph updates (add nodes at runtime)
- [ ] Graph visualization in Agents page
- [ ] Per-node latency tracking
- [ ] Graph cycle detection
- [ ] Failure recovery paths

## See Also

- [Architecture Overview](overview.md) — System design
- [Memory Tiers](memory-tiers.md) — Memory access model
- [Core Principles](../07-reference/core-principles.md) — "System > Agent"
- [truth.md](../../truth.md) — Authoritative specification

*Note: Graph definition not yet implemented. Current MVP uses simplified routing.*
