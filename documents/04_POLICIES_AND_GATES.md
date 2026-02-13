# 04 — Policies and Gates

## Node & Tool Gate Model

- Node caller and transition checks are enforced by the policy package (`packages/policy`).
- Tool usage is policy-checked before execution.
- Disallowed tools are denied with explicit failure messaging.

### Registered Nodes

All nodes must be registered in `packages/policy/src/nodes.ts` with:
- `assigned_model`: LLM model for the node
- `max_tokens_per_call`: token budget
- `allowed_tools`: list of tools this node may invoke

#### V1 Pipeline Nodes
- `gatekeeper` — intent classification and greeting handling
- `planner` — multi-step reasoning and tool selection
- `executor` — iterative tool execution
- `web_agent` — browser automation and web navigation
- `critic` — output validation

#### V2 Pipeline Nodes
- `classifier` — LLM-based intent classification
- `responder` — direct response composition
- `skill_executor` — typed skill execution
- `planner` (shared) — multi-step planning for complex requests

### Graph Edges

Valid node transitions are declared in `GRAPH_EDGES`. A transition not in the graph is a policy violation.

## WebSocket Capability Gates

Each WebSocket message type requires a capability grant on the session:

| Capability | Grants |
|---|---|
| `chat:write` | `chat:send`, `chat:stop` |
| `config:write` | `config:set_*`, `system:update` |
| `log:read` | `logs:subscribe` |

## Capability Introduction Gate

Before enabling a new tool/capability:

1. Add implementation.
2. Register policy permissions in `packages/policy/src/nodes.ts`.
3. Register planner/executor allowlists.
4. Add to `03_CAPABILITY_REGISTRY.md`.
5. Add/verify env keys in `.env.example`.

All five are required.

## Failure and Halt Requirements

- Missing or denied capabilities must surface with explicit failure codes.
- Executor must not claim success when tool execution fails.
- Blocked state is terminal for the current job execution path.

## Tool-Use Restrictions

- Only declared allowlisted tool names are accepted.
- URL fetching must pass SSRF safety checks.
- Protected memory key prefixes cannot be accessed via tools.
