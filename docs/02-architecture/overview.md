# Architecture Overview

High-level design of the CAIRN agentic AI system framework.

## Core Philosophy

From [truth.md](../../truth.md):

> **UI is truth** — If a behavior, state, or process cannot be represented in the UI (logs, nucleus motion, job state, cost), it must not exist.

This principle shapes everything: CAIRN is fundamentally transparent and visible.

## The Six Services (Exactly Six)

CAIRN is built from six core services that orchestrate AI agents. From [truth.md](../../truth.md):

### 1. Gateway — Gatekeeper / Fast Path

**Role:** First point of contact for user input.

**Responsibilities:**
- Receive raw user input
- Perform cheap intent classification
- Estimate task complexity (small/medium/large)
- Respond immediately to the user
- Enqueue a job for the Orchestrator

**Constraints:**
- No deep reasoning
- No tool execution
- No memory writes beyond hot memory

**Example outputs:**
- "Hey — what do you need?"
- "That's a larger task. I'm handing it to the planner; ETA ~2–5 minutes."

### 2. Orchestrator — Graph Engine

**Role:** The brain stem. Owns flow, permissions, and execution state.

**Responsibilities:**
- Execute a policy-enforced directed graph of nodes
- Enforce node-to-node call permissions
- Enforce tool allowlists per node
- Enforce memory access tiers per node
- Track job lifecycle and node transitions

**Model:**
- LangGraph-style state machine
- Declarative graph definition (JSON/TypeScript schema)

**Hard rule:**
> If a transition is not declared in the graph, it cannot occur.

### 3. Executor — Tool Runner / Sandbox

**Role:** Safe, auditable execution environment.

**Responsibilities:**
- Execute tools: APIs, code, scraping, file operations
- Enforce strict allowlists
- Redact secrets from outputs
- Emit structured artifacts

**Security:**
- No unrestricted shell access
- No persistent global state
- Tools return strict schemas

### 4. Memory — Three-Tier System

**Role:** Preserve context without contamination.

**Hot Memory (volatile)**
- Current conversation slice
- Active task context
- Short TTL, auto-expired

**Warm Memory (curated)**
- Task summaries
- Stable preferences
- Recent important events
- Stored as structured JSON + short text

**Cold Memory (RAG)**
- Notes, documents, logs
- Vector embeddings
- Retrieval only (no raw DB access)

**Critical rule:**
> Agents never write directly to cold memory. Promotion from warm → cold is handled by a curator process.

### 5. Ledger — Costs & Audit Trail

**Role:** Accountability and trust.

**Responsibilities:**
- Token usage per model
- Cost per job / per day
- Tool call ledger
- Security events

**Properties:**
- Append-only
- Hash-chained (tamper evident)
- Both machine-readable and human-readable

### 6. Scheduler — Heartbeat & Jobs

**Role:** Time awareness. Continuity. Liveness.

**Responsibilities:**
- Run heartbeat every 30–60 minutes
- Execute queued background jobs
- Trigger periodic audits

**Heartbeat loop:**
1. Scan inboxes (read-only)
2. Review Kanban for stalled tasks
3. If possible, perform one incremental step
4. Summarize status to logs
5. Perform lightweight security scan
6. Sleep

> Heartbeat is allowed to do nothing. This is correct behavior.

---

## Core Invariants (Non-Negotiable)

These principles are fundamental to CAIRN's design:

### 1. UI is Truth
Everything must be visible. If behavior cannot be represented in the UI (logs, animations, state, costs), it does not exist.

### 2. System > Agent
Agents are constrained workers. The system owns:
- State
- Memory
- Permissions
- Security
- Time

### 3. No Invisible Work
Every meaningful action produces:
- A log entry
- A job state change
- A cost delta
- Or a visible animation/state change

### 4. Six Services Only
Adding a seventh service without explicit revision of this document is a design failure.

### 5. No Self-Modifying Policy
The system may read its identity and policy. It may never rewrite them.

---

## Execution Model

### Two-Tier Inference

**Tier A — Gatekeeper (Cheap & Fast)**
- Greeting handling
- Intent classification
- Complexity estimation
- Job enqueue
- Uses small, fast models only

**Tier B — Brain (Powerful)**
- Planning and reasoning
- Tool orchestration
- Memory updates
- Kanban and logs
- Invoked only when required

### Graph-Based Orchestration

Each node in the execution graph declares:

- **Allowed callers** — Which nodes can call this node
- **Allowed tools** — What tools this node can execute
- **Allowed memory tiers** — What memory this node can access
- **Max runtime** — Execution timeout
- **Assigned model** — Which AI model to use

**Example nodes:**
- `gatekeeper` — Route user input
- `planner` — Create task plans
- `coder` — Generate code
- `researcher_web_locked` — Web research (isolated)
- `executor` — Execute tools
- `summarizer` — Summarize content
- `security_auditor` — Security scanning
- `heartbeat` — Periodic maintenance

**Enforcement:**
- Any violation hard-fails
- All violations logged
- Graph structure is immutable

---

## Security Model

### Web Access Safety

**Principle:** Web content is data, never instruction.

**web_locked node**
- Tools: browser + parser only
- Outputs: structured findings
- No state mutation

**Hard rules:**
- No cookies by default
- No persistence
- Imperative language stripped
- Prevents prompt injection attacks

### Identity & Policy System

Policy system has four source files:
- **SOUL.md** — Values, tone, purpose
- **IDENTITY.md** — Ownership, access
- **POLICY.md** — Hard safety rules
- **CAPABILITIES.md** — Tools and tiers

These compile into:
- Runtime permissions
- Node-specific system prompts
- Audit rules

**Hard rule:** Agents may never edit these files.

### Audit Trail

- Append-only, hash-chained log (tamper evident)
- Policy violation detection
- Secret exposure detection
- Forbidden file access detection
- Prompt-injection detection in web outputs

---

## Data Models

### Job

- `id` — Unique identifier
- `status` — queued | running | waiting | done | failed
- `nodes_traversed` — Path through execution graph
- `artifacts` — Generated outputs
- `costs_so_far` — Token/cost tracking

### Artifact

- `type` — String type identifier
- `metadata` — Type-specific data
- `origin_node` — Which node created it
- `storage_reference` — Where to find it

### Memory Tiers

**Hot:**
- Current message
- Active context
- Volatile, auto-expire

**Warm:**
- Task summaries (JSON)
- Preferences
- Recent events
- Curated, human-readable

**Cold:**
- Documents, logs
- Vector embeddings
- RAG-retrievable
- Agents cannot write directly

---

## Implementation Phases

### MVP (Phase 1) — Current Target

**Mandatory services:**
- Gateway + Telegram interface
- Orchestrator with 4 nodes: gatekeeper, planner, executor, logger
- Logs panel (visible in UI)
- Notes inbox (visible in UI)
- Minimal heartbeat

**UI Components:**
- ✅ Nucleus animation
- ✅ Chat interface
- ✅ Notes inbox
- ✅ Kanban board
- ✅ Logs viewer
- ✅ Navigation pages

**What this is NOT:**
- ❌ Web browsing
- ❌ Vector databases
- ❌ Google APIs
- ❌ Cost billing beyond counters
- ❌ Persistent memory beyond hot memory

### Phase 2 — Future

- Kanban integration with backend
- web_locked research node
- Cold memory (RAG system with vector embeddings)

### Phase 3 — Future

- Google read-only integration
- Cost dashboards
- Security auditor node

---

## Current State

**What exists:**
- ✅ Complete architecture specification (truth.md)
- ✅ Production-ready React UI with all components
- ✅ TypeScript interfaces and types
- ✅ Design system (Tailwind, shadcn/ui, Framer Motion)

**What's planned:**
- 🚧 Backend services (Gateway, Orchestrator, etc.)
- 🚧 WebSocket/HTTP API
- 🚧 Memory service implementation
- 🚧 Ledger service (cost tracking)
- 🚧 Scheduler (heartbeat)

---

## Key Principles Applied

### Principle: UI is Truth

The Nucleus component embodies this:
- Shows system state through animation
- Different states = different motion patterns
- Cannot hide system activity

### Principle: System > Agent

The Orchestrator enforces this:
- All permissions declared upfront
- Nodes cannot escalate
- No agent can modify its own policy

### Principle: No Invisible Work

The Logs component shows this:
- Every tool call logged
- Every state change visible
- Every cost tracked

---

## Next Steps

1. **Deep Dive on Core Principles** — [Core Principles](../07-reference/core-principles.md)
2. **Understand Execution Graph** — [Execution Graph](execution-graph.md)
3. **Explore Memory Tiers** — [Memory Tiers](memory-tiers.md)
4. **Read the Spec** — [truth.md](../../truth.md)
5. **View UI Components** — [UI Components Overview](../03-ui-components/overview.md)

---

## Reference

- [truth.md](../../truth.md) — Authoritative architecture specification
- [Core Principles](../07-reference/core-principles.md) — Detailed invariant explanations
- [Execution Graph](execution-graph.md) — Graph orchestration details
- [Memory Tiers](memory-tiers.md) — Memory system details
