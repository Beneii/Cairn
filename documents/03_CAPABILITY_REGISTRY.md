# 03 — Capability Registry

This is the contract between planning, execution, and runtime reality.
If a capability is not listed here, Cairn must treat it as unavailable.

## Runtime Agents / Owners

- **Planner owner**: `packages/orchestrator/src/nodes/planner.ts`
- **Executor owner**: `packages/orchestrator/src/nodes/executor-node.ts`
- **Tool runtime owner**: `packages/executor/src/tools.ts`

## Capability Table

| Capability | Owner | Invocation Context | Lifecycle | Permissions / Constraints | Failure Surface |
|---|---|---|---|---|---|
| `memory_read` | Executor tools | Executor tool action | Stateless | Key access blocked for protected prefixes | Tool failure (blocked path) |
| `memory_write` | Executor tools | Executor tool action | Stateful (memory mutation) | Protected key prefixes blocked | Tool failure (blocked path) |
| `ledger_write` | Executor tools | Executor tool action | Stateful (append) | Policy-gated tool use | Tool failure (blocked path) |
| `web_search` | Executor tools | Executor tool action | Stateless | External web only; network-dependent | Tool failure (blocked path) |
| `fetch_url` | Executor tools | Executor tool action | Stateless | SSRF protections: private/metadata endpoints blocked | Tool failure (blocked path) |
| `calendar_read` | Executor tools + integrations | Executor tool action | Stateless | Requires Google auth env setup | Tool failure (blocked path) |
| `gmail_read` | Executor tools + integrations | Executor tool action | Stateless | Requires Google auth env setup | Tool failure (blocked path) |
| `vector_search` | Executor tools + memory | Executor tool action | Stateless read over persistent index | Requires embeddings/OpenAI key for full behavior | Tool failure (blocked path) |
| `goals_read` | Executor tools + goals pkg | Executor tool action | Stateless | Internal package access | Tool failure (blocked path) |
| `goals_update` | Executor tools + goals pkg | Executor tool action | Stateful (goal mutation) | Goal must exist | Tool failure (blocked path) |
| `tasks_read` | Executor tools + tasks pkg | Executor tool action | Stateless | Internal package access | Tool failure (blocked path) |
| `tasks_create` | Executor tools + tasks pkg | Executor tool action | Stateful (task mutation) | Title required | Tool failure (blocked path) |
| `tasks_complete` | Executor tools + tasks pkg | Executor tool action | Stateful (task mutation) | Task id required | Tool failure (blocked path) |

| `local_branch_builder` | Future builder worker | Scheduled dev-worker context | Stateful (repo mutation in isolated branch) | Explicit user approval, scope allowlist, budget bounded | Must return blocked/not-implemented until landed |

## Explicitly Unsupported (Current)

- Browser control / web automation agent workflows are **not implemented**.
- Multi-step autonomous browsing is **not implemented**.

Requests requiring these must produce an explicit blocked response, not optimistic planning.

## Standard Failure Codes

- `CAPABILITY_MISSING`
- `PERMISSION_DENIED`
- `TOOL_EXECUTION_FAILED`

These are emitted as part of tool failure strings and interpreted by executor orchestration.
