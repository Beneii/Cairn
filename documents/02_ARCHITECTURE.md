# 02 — Architecture (Implemented Reality)

This file describes current implemented runtime behavior.
No aspirational features belong here.

## Runtime Service Spine

Cairn's active runtime is centered on these long-lived services/components:

1. **Gateway** (`apps/gateway`) — HTTP/WebSocket ingress, client auth, and integration boundary.
2. **Orchestrator** (`packages/orchestrator`) — dual-pipeline message processing (V1 + V2).
3. **Executor** (`packages/executor`) — tool invocation boundary with policy checks.
4. **Skill Registry** (`packages/orchestrator/src/skill-registry.ts`) — V2 typed skill definitions bridging to executor tools.
5. **Memory** (`packages/memory`) — hot/warm/cold memory operations and embedding-backed retrieval.
6. **Ledger** (`packages/ledger`) — append-only audit/event logging.
7. **Scheduler** (`packages/scheduler`) — heartbeat cadence for periodic work.
8. **Policy** (`packages/policy`) — node registration, caller checks, graph-edge enforcement.
9. **Dashboard** (`apps/dashboard`) — React SPA served by gateway, WebSocket-connected.
10. **Mobile** (`apps/mobile`) — React Native companion client.

## Dual-Pipeline Architecture

Cairn runs two parallel processing pipelines. The **Pre-Router** in the orchestrator decides which pipeline handles each message.

### V1 Pipeline (Legacy)

```
User Input → Pre-Router → Gatekeeper → Planner → Executor → Response
```

- **Gatekeeper**: LLM-based intent classification + greeting handling.
- **Planner**: Multi-step reasoning with tool selection.
- **Executor**: Iterative tool execution with LLM-guided argument extraction.
- **Web Agent**: Dedicated browser automation path (when `needs_web_agent` is set).

### V2 Pipeline (Active)

```
User Input → Pre-Router → Classifier → Contract Builder → Skill Executor → Response Composer
```

- **Pre-Router**: Deterministic pattern matching (greetings, web actions) + fallback to LLM classifier.
- **Classifier**: LLM-based intent classification returning structured `IntentClassification`.
- **Contract Builder**: Converts classification to a typed `ActionContract` with validated skill IDs.
- **Skill Executor**: Runs skills from the registry (single or planner-driven multi-step).
- **Response Composer**: Deterministic templates or LLM polish for user-facing output.

### Pre-Router Decision Logic

| Pattern | Route |
|---------|-------|
| Simple greetings (hi, hello, thanks) | Direct response (no LLM) |
| Web action keywords (search, browse, youtube) | V2 with `web.search` hint |
| Everything else | LLM Classifier |

## Skill Registry

The V2 pipeline uses a typed skill registry (`skill-registry.ts`) that wraps existing V1 executor tools:

- Each skill has `id`, `inputSchema`, `outputSchema`, `costEstimate`
- Skills are validated by the contract builder before execution
- 14 skills currently registered (task.*, note.*, web.*, memory.*, goal.*, calendar.*, email.*, research.*, vector.*)
- Skills bridge to legacy tools via `wrapToolAsSkill()`

## Memory Tiers

- **Hot**: ephemeral session-level values.
- **Warm**: persistent key-value context (chat history, preferences).
- **Cold**: long-term embedded/chunked memory for semantic search.

## Client Communication

- **WebSocket**: Real-time bidirectional messaging (chat, logs, config, system updates).
- **Auth**: Token-based session authentication with capability grants per client type.
- **Capability gates**: Each WS message type requires a specific capability (e.g., `system:update` requires `config:write`).

## Lifecycle Boundaries

### Long-lived
- Gateway server
- Orchestrator runtime
- Scheduler loop
- Persistent stores (warm/cold memory, ledger files)
- Skill registry (initialized once, lazy)

### Ephemeral
- Job execution context
- Individual LLM calls
- Single skill invocations
- WebSocket sessions

## Explicit Anti-Patterns

- No implicit tool availability.
- No hidden env dependencies.
- No silent fallback that masks capability absence.
- No roadmap claims in architecture docs.
