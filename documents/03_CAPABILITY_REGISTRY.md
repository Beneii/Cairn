# 03 — Capability Registry

This is the contract between planning, execution, and runtime reality.
If a capability is not listed here, Cairn must treat it as unavailable.

## V2 Skill Registry (Active)

Skills are registered in `packages/orchestrator/src/skill-registry.ts` and invoked by the V2 pipeline.
Each skill wraps a legacy executor tool with a typed schema.

| Skill ID | Description | Required Args | Cost | Backing Tool |
|----------|-------------|---------------|------|--------------|
| `task.create` | Create a new task | `title` | trivial | `tasks_create` |
| `task.read` | Read tasks by status | — | trivial | `tasks_read` |
| `task.complete` | Mark task done | `task_id` | trivial | `tasks_complete` |
| `note.create` | Create a dashboard note | `content` | trivial | `note_create` |
| `web.search` | DuckDuckGo web search | `query` | cheap | `web_search` |
| `web.fetch` | Fetch URL content | `url` | cheap | `fetch_url` |
| `memory.read` | Read from memory tier | `tier`, `key` | trivial | `memory_read` |
| `memory.write` | Write to memory tier | `tier`, `key`, `value` | trivial | `memory_write` |
| `calendar.read` | Read calendar events | — | cheap | `calendar_read` |
| `email.read` | Read Gmail messages | — | cheap | `gmail_read` |
| `goal.read` | Read active goals | — | trivial | `goals_read` |
| `goal.update` | Update a goal | `goal_id` | trivial | `goals_update` |
| `vector.search` | Semantic memory search | `query` | medium | `vector_search` |
| `research.ingest` | Ingest URL into cold memory | `url` | expensive | `research_ingest` |

## V1 Legacy Executor Tools

These are invoked by the V1 planner/executor pipeline via `packages/executor/src/tools.ts`.
See `09_TOOL_MIGRATION_MATRIX.md` for migration status to manifest tools.

| Tool | Owner | Lifecycle | Constraints |
|------|-------|-----------|-------------|
| `memory_read` | executor | stateless | Protected key prefixes blocked |
| `memory_write` | executor | stateful | Protected key prefixes blocked |
| `ledger_write` | executor | stateful (append) | Policy-gated |
| `web_search` | executor | stateless | External web only |
| `fetch_url` | executor | stateless | SSRF protections enforced |
| `calendar_read` | executor + integrations | stateless | Requires Google OAuth |
| `gmail_read` | executor + integrations | stateless | Requires Google OAuth |
| `vector_search` | executor + memory | stateless | Requires embeddings/API key |
| `goals_read` | executor + goals | stateless | Internal |
| `goals_update` | executor + goals | stateful | Goal must exist |
| `tasks_read` | executor + tasks | stateless | Internal |
| `tasks_create` | executor + tasks | stateful | Title required |
| `tasks_complete` | executor + tasks | stateful | Task ID required |
| `note_create` | executor | stateful | Content required |

## Web Agent

- Partially implemented browser automation via `packages/orchestrator/src/nodes/web-agent.ts`.
- Routes through V1 gatekeeper when `needs_web_agent` is detected.
- Supports web search, URL navigation, and basic page interaction.

## Dashboard System Capabilities

| Message Type | Required Capability | Description |
|---|---|---|
| `config:set_*` | `config:write` | Update system configuration |
| `system:update` | `config:write` | Trigger git pull + build + restart |
| `builder:trigger` | `system:write` | Trigger autonomous branch builder |

## Autonomous Agents (New)

- **Local Branch Builder**: [`packages/builder`](../packages/builder)
  - **Type**: Autonomous Developer
  - **Trigger**: Schedule (2am) or Manual
  - **Capabilities**: Issue collection, spec generation, code editing, git ops.

## Standard Failure Codes

- `CAPABILITY_MISSING`
- `PERMISSION_DENIED`
- `TOOL_EXECUTION_FAILED`
- `SKILL_NOT_FOUND` (V2)
- `PARSE_ERROR_CLASSIFIER` (V2)
- `CONTRACT_VALIDATION_FAIL` (V2)
- `MODEL_NOT_AVAILABLE`
- `INFRASTRUCTURE_FAIL`

These are emitted as part of tool/skill failure responses and interpreted by orchestration.
