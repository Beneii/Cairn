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
tools: [memory_read]
memory_read: [hot, warm]
memory_write: [hot, warm]
can_call: [executor, logger]
```

### executor

```yaml
role: Execute plans, run tools, produce results
model: gpt-4o
tools: [memory_read, memory_write, ledger_write, web_search, fetch_url]
memory_read: [hot, warm]
memory_write: [hot]
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

### Currently Implemented (MVP)

| Tool | Description | Allowed Nodes |
|------|-------------|---------------|
| `memory_read` | Read from hot/warm memory | planner, executor |
| `memory_write` | Write to hot/warm memory | executor |
| `ledger_write` | Append entry to audit ledger | executor, logger |
| `web_search` | Search the web (mocked in MVP) | executor |
| `fetch_url` | Fetch content from a URL | executor |

### Tool Input/Output Contracts

All tools follow this interface:

```typescript
interface ToolInput {
  name: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  success: boolean;
  output: string;
  artifact?: Artifact;
}
```

### Phase 2 Tools (Planned)

| Tool | Description | Notes |
|------|-------------|-------|
| `browser` | Headless browser for JS-rendered pages | web_locked node only |
| `parser` | Extract structured data from HTML | web_locked node only |
| `vector_search` | Query cold memory via embeddings | RAG retrieval |

### Phase 3 Tools (Planned)

| Tool | Description | Notes |
|------|-------------|-------|
| `google_calendar_read` | Read calendar events | Read-only integration |
| `google_drive_read` | Read documents | Read-only integration |
| `gmail_read` | Read emails | Read-only integration |

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
  - User preferences
  - Task summaries
  - Recent important events
  - Stable context
access: planner/executor can read, planner can write
```

### Cold Memory (Phase 2)

```yaml
type: Vector database + RAG
ttl: None (permanent archive)
use_cases:
  - Historical notes
  - Document archive
  - Long-term knowledge
access: Read-only via vector_search tool
write: Curator process only (warm → cold promotion)
```

---

## Interface Capabilities

### Currently Implemented (MVP)

| Interface | Type | Status |
|-----------|------|--------|
| WebSocket | Real-time bidirectional | ✅ Active |
| HTTP REST | Health checks, status | ✅ Active |
| Dashboard UI | React web application | ✅ Active |

### Planned Interfaces

| Interface | Type | Phase |
|-----------|------|-------|
| Telegram Bot | Messaging | MVP (pending) |
| Mobile App | iOS/Android | Phase 3 |
| CLI | Command line | Phase 2 |

---

## UI Capabilities

### Panels

| Panel | Purpose | Status |
|-------|---------|--------|
| **Nucleus** | Visual state indicator (idle/thinking/tooling/error) | ✅ |
| **Chat** | Conversation interface | ✅ |
| **Notes** | Inbox for captured items | ✅ |
| **Logs** | Real-time activity stream | ✅ |
| **Kanban** | Task board (backlog/active/blocked/done) | ✅ |

### Pages

| Page | Purpose | Status |
|------|---------|--------|
| **Agents** | View node graph and configurations | ✅ |
| **Integrations** | Manage external connections | ✅ (placeholder) |
| **Preferences** | System configuration | ✅ |

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

- Policy enforcement at node transitions
- Tool allowlists per node
- Memory tier access control
- Hash-chained append-only ledger
- Heartbeat integrity checks

### Planned (Phase 3)

- Prompt injection detection in web content
- Secret exposure detection in outputs
- Forbidden file access detection
- Security auditor node

---

## Expansion Rules

New capabilities require:

1. Update to this file (CAPABILITIES.md)
2. Corresponding update to POLICY.md if security-relevant
3. Implementation following existing patterns
4. No violation of core invariants in truth.md

**Remember**: Six services only. New tools go in Executor. New nodes go in Orchestrator. No exceptions without truth.md revision.
