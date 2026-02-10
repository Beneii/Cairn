# 02 — Architecture (Implemented Reality)

This file describes current implemented runtime behavior.
No aspirational features belong here.

## Runtime Service Spine

Cairn's active runtime is centered on six long-lived services/components:

1. **Gateway** (`apps/gateway`) — HTTP/WebSocket ingress and outward integration boundary.
2. **Orchestrator** (`packages/orchestrator`) — node sequencing: gatekeeper → planner → executor.
3. **Executor** (`packages/executor`) — tool invocation boundary with policy checks.
4. **Memory** (`packages/memory`) — hot/warm/cold memory operations and embedding-backed retrieval.
5. **Ledger** (`packages/ledger`) — append-only audit/event logging.
6. **Scheduler** (`packages/scheduler`) — heartbeat cadence for periodic work.

## Data / Control Flow

1. User input arrives via Gateway.
2. Orchestrator creates and advances a Job across nodes.
3. Planner decides whether execution tools are needed.
4. Executor calls allowed tools and returns result or blocked state.
5. Artifacts and logs are emitted to bus/ledger and surfaced back to clients.

## Memory Tiers

- **Hot**: ephemeral session-level values.
- **Warm**: persistent key-value context.
- **Cold**: long-term embedded/chunked memory for semantic search.

## Lifecycle Boundaries

### Long-lived
- Gateway server
- Orchestrator runtime
- Scheduler loop
- Persistent stores (warm/cold memory, ledger files)

### Ephemeral
- Job execution context
- Individual LLM calls
- Single tool invocations

## Explicit Anti-Patterns

- No implicit tool availability.
- No hidden env dependencies.
- No silent fallback that masks capability absence.
- No roadmap claims in architecture docs.
