# CAIRN — Capabilities

> This file defines what Cairn can do: tools, tiers, and interfaces. It is read-only at runtime.

---

## Inference Tiers

Cairn uses a two-tier inference model to balance responsiveness with capability.

### Tier A — Gatekeeper (Fast Path)

**Purpose**: Instant responsiveness

| Aspect | Value |
|--------|-------|
| Model | gpt-4o-mini (or equivalent fast model) |
| Max Tokens | 1,000 |
| Max Runtime | 10 seconds |
| Use Cases | Greeting, intent classification, complexity estimation, job enqueue |

**Explicitly Forbidden**:
- Deep reasoning
- Tool execution
- Memory writes beyond hot memory

### Tier B — Brain (Deep Path)

**Purpose**: Planning and execution

| Aspect | Value |
|--------|-------|
| Model | gpt-4o (or equivalent capable model) |
| Max Tokens | 5,000-10,000 (per node) |
| Max Runtime | 120-300 seconds (per node) |
| Use Cases | Planning, tool orchestration, memory updates, complex reasoning |

**Invoked Only When Required**: The gatekeeper decides when Tier B is needed.

---

## Node Capabilities

### gatekeeper

```yaml
role: First contact, classification, acknowledgement
model: gpt-4o-mini
tools: []
memory_read: [hot]
memory_write: [hot]
can_call: [planner, logger]
```

### planner

```yaml
role: Create execution plans, decide routing
model: gpt-4o
tools: [memory_read, vector_search]
memory_read: [hot, warm, cold]
memory_write: [hot, warm]
can_call: [executor, logger]
```

### executor

```yaml
role: Execute plans, run tools, produce results
model: gpt-4o
tools: [memory_read, memory_write, ledger_write, web_search, fetch_url, calendar_read, gmail_read, vector_search]
memory_read: [hot, warm, cold]
memory_write: [hot, warm]
can_call: [logger]
```

### logger

```yaml
role: Record entries to ledger
model: none (deterministic)
tools: [ledger_write]
memory_read: []
memory_write: []
can_call: []
```

---

## Tool Registry

### Implemented

| Tool | Description | Allowed Nodes |
|------|-------------|---------------|
| `memory_read` | Read from hot/warm memory | planner, executor |
| `memory_write` | Write to hot/warm memory | executor |
| `ledger_write` | Append entry to audit ledger | executor, logger |
| `web_search` | Search the web (DuckDuckGo) | executor |
| `fetch_url` | Fetch content from a URL | executor |
| `calendar_read` | Read Google Calendar events | executor |
| `gmail_read` | Read recent emails | executor |
| `vector_search` | Query cold memory via RAG embeddings | planner, executor |

### Phase D Tools (Planned)

| Tool | Description | Notes |
|------|-------------|-------|
| `browser` | Headless browser for JS-rendered pages | web_locked node only |
| `parser` | Extract structured data from HTML | web_locked node only |

---

## Memory Capabilities

### Hot Memory

```yaml
type: Volatile, in-memory
ttl: 5 minutes (configurable)
use_cases:
  - Current conversation context
  - Active task working state
  - Temporary calculations
access: All nodes can read, gatekeeper/planner/executor can write
```

### Warm Memory

```yaml
type: Persistent, JSON files
ttl: None (persists until cleared)
use_cases:
  - User context and preferences
  - Task summaries
  - Recent important events
  - Chat history (last 10 turns)
access: planner/executor can read and write
```

### Cold Memory

```yaml
type: SQLite + vector embeddings (RAG)
ttl: None (permanent archive)
use_cases:
  - Historical notes and documents
  - Long-term knowledge
  - Semantic search over past context
access: Read-only via vector_search tool
write: Curator process only (warm → cold promotion)
```

---

## Interface Capabilities

### Implemented

| Interface | Type | Status |
|-----------|------|--------|
| WebSocket | Real-time bidirectional | Active |
| HTTP REST | Health checks, OAuth | Active |
| Dashboard UI | React web application | Active |
| Telegram Bot | Messaging | Active |

### Planned

| Interface | Type | Phase |
|-----------|------|-------|
| Mobile App | iOS/Android | Phase D+ |

---

## UI Capabilities

### Home Panels

| Panel | Purpose |
|-------|---------|
| **Nucleus** | Visual state indicator (idle/thinking/tooling/error) |
| **Chat** | Conversation interface with tool output |
| **Notes** | Inbox for captured items |
| **Kanban** | Task cards (backlog/active/blocked/done) |
| **Logs** | Real-time activity stream |

### Pages

| Page | Purpose |
|------|---------|
| **Goals** | Active goals board (max 3), creation, timeline |
| **Tasks** | Todo list (today/upcoming/recurring) |
| **Settings** | System config, integrations, diagnostics |
| **Archive** | Archived kanban cards |

---

## Cost Tracking Capabilities

### What Is Tracked

- Prompt tokens per LLM call
- Completion tokens per LLM call
- Cost in USD per call (based on model pricing)
- Cumulative cost per job
- Daily/monthly spend totals

### Cost Controls

| Control | Description |
|---------|-------------|
| `monthly_spend_limit_usd` | Hard cap on monthly spending |
| Per-node token limits | Prevent runaway inference |
| Ledger cost entries | Full audit trail of all costs |

---

## Security Capabilities

### Implemented

- Zod schema validation on all LLM outputs
- Policy enforcement at node transitions
- Tool allowlists per node
- Memory tier access control
- Hash-chained append-only ledger
- Heartbeat integrity checks
- URL allowlists (SSRF prevention)
- Memory key protection (system keys blocked)
- Error redaction before user display

### Planned (Phase D)

- Prompt injection detection in web content
- Security auditor node
- Approval gates for high-risk actions

---

## Expansion Rules

New capabilities require:

1. Update to this file (CAPABILITIES.md)
2. Corresponding update to POLICY.md if security-relevant
3. Implementation following existing patterns
4. No violation of core invariants in truth.md

**Remember**: Six services only. New tools go in Executor. New nodes go in Orchestrator. No exceptions without truth.md revision.
