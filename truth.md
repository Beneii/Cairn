# CAIRN

## UI‑First Agentic System — Authoritative Architecture & Implementation Spec (v1.0)

> **Audience:** Claude Code / implementation agents
> **Purpose:** This document is the *sole source of truth*. Build exactly this system. Do not invent abstractions, services, or concepts not described here.

---

## 0. Core Invariants (Non‑Negotiable)

1. **UI is truth**
   If a behavior, state, or process cannot be represented in the UI (logs, nucleus motion, job state, cost), it must not exist.

2. **System > Agent**
   Agents are constrained workers. The system owns state, memory, time, permissions, and security.

3. **No invisible work**
   Every meaningful action produces:

   * a log entry
   * a job state change
   * a cost delta
   * or a visible animation/state change

4. **Six services only**
   Adding a seventh service without explicit revision of this document is a design failure.

5. **No self‑modifying policy**
   The system may *read* its identity and policy. It may never rewrite them.

---

## 1. Core Architecture (Exactly Six Services)

### 1.1 Gateway — Gatekeeper / Fast Path

**Role:** First point of contact. Immediate responsiveness.

**Interfaces:**

* Telegram (initial)
* WebSocket / HTTP (UI)
* Mobile (future)

**Responsibilities:**

* Receive raw user input
* Perform *cheap* intent classification
* Estimate complexity (small / medium / large)
* Respond immediately to the user
* Enqueue a job for the Orchestrator

**Explicitly forbidden:**

* Deep reasoning
* Tool execution
* Memory writes beyond hot memory

**Model usage:**

* Deterministic rules + very small / fast model
* Optimized for latency and low cost

**Example outputs:**

* “Hey — what do you need?”
* “That’s a larger task. I’m handing it to the planner; ETA ~2–5 minutes.”

---

### 1.2 Orchestrator — Graph Engine

**Role:** The brain stem of Cairn. Owns flow, permissions, and execution state.

**Responsibilities:**

* Execute a **policy‑enforced directed graph** of nodes
* Enforce node‑to‑node call permissions
* Enforce tool allowlists per node
* Enforce memory access tiers per node
* Track job lifecycle and node transitions

**Execution model:**

* LangGraph‑style state machine
* Declarative graph definition (JSON / TS schema)

**Hard rule:**

> If a transition is not declared in the graph, it cannot occur.

---

### 1.3 Executor — Tool Runner / Sandbox

**Role:** Safe, auditable execution environment.

**Responsibilities:**

* Execute tools (APIs, code, scraping, file ops)
* Enforce strict allowlists
* Redact secrets from outputs
* Emit structured artifacts

**Security constraints:**

* No unrestricted shell access
* No persistent global state
* Tools must return strict schemas

---

### 1.4 Memory System — Hot / Warm / Cold

**Role:** Preserve context without contamination.

#### Hot Memory (volatile)

* Current conversation slice
* Active task context
* Working plans
* Short TTL, auto‑expired

#### Warm Memory (curated)

* Task summaries
* Stable preferences
* Recent important events
* Stored as structured JSON + short text

#### Cold Memory (RAG)

* Notes, documents, logs
* Vector embeddings
* Retrieval only (no raw DB access)

**Critical invariant:**

> Agents never write directly to cold memory. Promotion from warm → cold is handled by a curator process.

---

### 1.5 Ledger — Costs & Audit Trail

**Role:** Accountability and trust.

**Responsibilities:**

* Token usage per model
* Cost per job / per day
* Tool call ledger
* Security events

**Properties:**

* Append‑only
* Hash‑chained (tamper evident)
* Both machine‑readable and human‑readable

---

### 1.6 Scheduler — Heartbeat & Jobs

**Role:** Time awareness. Continuity. Liveness.

**Responsibilities:**

* Run heartbeat every 30–60 minutes
* Execute queued background jobs
* Trigger periodic audits

**Heartbeat loop:**

1. Scan inboxes (read‑only)
2. Review Kanban for stalled tasks
3. If possible, perform *one* incremental step
4. Summarize status to logs
5. Perform lightweight security scan
6. Sleep

Heartbeat is allowed to do nothing.

---

## 2. Two‑Tier Inference Model

### Tier A — Gatekeeper

**Purpose:** Instant responsiveness.

* Greeting handling
* Intent classification
* Complexity estimation
* Job enqueue

Uses cheap inference only.

---

### Tier B — Brain

**Purpose:** Planning and execution.

* Planning
* Tool orchestration
* Memory updates
* Kanban and logs

Invoked *only* when required.

---

## 3. Graph‑Based Orchestration

Each node declares:

* Allowed callers
* Allowed tools
* Allowed memory tiers
* Max runtime
* Assigned model

**Example nodes:**

* gatekeeper
* planner
* coder
* researcher_web_locked
* executor
* summarizer
* security_auditor
* heartbeat

**Enforcement:**

* Any violation hard‑fails
* All violations logged

---

## 4. Web Access & Prompt Injection Safety

**Principle:** Web content is data, never instruction.

### web_locked node

* Tools: browser + parser only
* Outputs: structured findings
* No state mutation

**Hard rules:**

* No cookies by default
* No persistence
* Imperative language stripped

---

## 5. Heartbeat Semantics

Heartbeat is not continuous thinking.

It is:

* A checklist
* A queue runner
* A liveness signal

Most heartbeats do nothing. This is correct behavior.

---

## 6. Identity & Policy System

### Source files

* SOUL.md — values, tone, purpose
* IDENTITY.md — ownership, access
* POLICY.md — hard safety rules
* CAPABILITIES.md — tools and tiers

### Compilation

These are compiled into:

* Runtime permissions
* Node‑specific system prompts
* Audit rules

Agents may never edit them.

---

## 7. Memory Promotion Rules

* Brain writes → hot / warm
* Curator summarizes warm
* Promotion job writes → cold

No exceptions.

---

## 8. Security & Self‑Audit

Implemented mechanisms:

* Append‑only audit log
* Policy violation detection
* Secret exposure detection
* Forbidden file access detection
* Prompt‑injection detection in web outputs

**Hard rule:** Policy files are immutable at runtime.

---

## 9. File Structure (Authoritative)

```
cairn/
  apps/
    gateway/
    dashboard/
  packages/
    orchestrator/       # includes nodes/ subdirectory
    executor/
    memory/
    ledger/
    scheduler/
    policy/
    shared/
  data/
    jobs/
    memory/
    ledger/
  configs/
    dev.json
    prod.json
```

No hidden directories. No ad‑hoc files.

---

## 10. Core Data Models

### Job

* id
* status (queued | running | waiting | done | failed)
* nodes traversed
* artifacts
* costs so far

### Artifact

* type
* metadata
* origin node
* storage reference

---

## 11. Build Phases

### MVP (Mandatory)

* Gateway + Telegram
* Orchestrator with 4 nodes: gatekeeper, planner, executor, logger
* Logs panel
* Notes inbox
* Minimal heartbeat

### Phase 2

* Kanban
* web_locked research
* Cold memory (RAG)

### Phase 3

* Google read‑only integration
* Cost dashboards
* Security auditor node

---

## 12. Final Rule

> Cairn is a living instrument.
> The system lives; agents merely work.
