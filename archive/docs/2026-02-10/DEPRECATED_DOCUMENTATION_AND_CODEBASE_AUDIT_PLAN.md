# Cairn Documentation Consolidation & Codebase Sweep

**Single-Source Truth + Structural Audit Plan**

## Objective (Non-Negotiable)

Create **one authoritative source of truth** for Cairn and eliminate structural ambiguity in the codebase.
After this plan is executed:

* There is **exactly one place** an LLM (or human) should look for system truth.
* Every runtime capability has a **clear owner, lifecycle, and boundary**.
* Dead, misleading, or speculative code is **either removed or explicitly quarantined**.
* The system can fail fast instead of looping blindly.

If ambiguity remains, the audit failed.

---

## Phase 1 — Documentation Consolidation (Truth Centre)

### Goal

Replace fragmented, contradictory, and stale markdown with a **single, ordered documentation spine** optimized for:

* LLM grounding
* architectural reasoning
* long-term evolution

### New Canonical Location

```
/documents/
```

No other markdown outside this folder is considered authoritative.

---

### Canonical Document Set

#### 01_CORE_IDENTITY.md

**Purpose:** Define what Cairn *is* and what it will never violate.

Contents:

* Ownership model (single-user, authority assumptions)
* Core values and design philosophy
* Non-negotiable invariants (security, autonomy, scope)
* Explicit “Cairn is NOT…” section

Merged from:

* SOUL.md
* IDENTITY.md
* CAIRN_INVARIANTS.md

This document outranks all others in conflicts.

---

#### 02_ARCHITECTURE.md

**Purpose:** Describe how the system actually runs in reality.

Contents:

* Six-service architecture (roles + responsibilities)
* Data flow between services
* Memory tiers (cold / warm / ephemeral)
* Long-lived vs ephemeral components
* Explicit anti-patterns (what not to build)

Merged from:

* truth.md
* CAPABILITIES.md (filtered for reality only)

No aspirational features allowed here.

---

#### 03_CAPABILITY_REGISTRY.md  **(NEW – REQUIRED)**

**Purpose:** Define what Cairn can *actually do*.

This is the missing piece that caused your web automation failures.

For each capability/tool:

* Name
* Owning service or agent
* Invocation context (planner, executor, web agent, etc.)
* Lifecycle (stateless / stateful / persistent)
* Permissions & constraints
* Failure modes (and how they surface)

This document is the **contract between planners, executors, and reality**.

If it’s not listed here, Cairn cannot assume it exists.

---

#### 04_POLICIES_AND_GATES.md

**Purpose:** Define evolution rules and safety rails.

Contents:

* Development phase gates
* Policy checks before enabling new capabilities
* Tool-use restrictions
* Failure and halt conditions (no infinite refinement loops)

Merged from:

* POLICY.md
* PHASE_GATES.md

This document answers: *“Are we allowed to do this?”*

---

#### 05_ROADMAP.md

**Purpose:** Track intent over time without contaminating architecture.

Contents:

* Completed milestones (locked)
* Active priorities
* Explicitly deferred ideas
* Explicitly rejected ideas (this is important)

Merged from:

* ROADMAP.md
* MEGA_BRAIN_ROADMAP.md

Nothing in this file is assumed to exist until implemented.

---

### Archival Rules (Strict)

* All old markdown in `/docs` or root is moved to:

```
/archive/docs/YYYY-MM-DD/
```

* Archived docs must be prefixed with `DEPRECATED_`
* No archived doc is referenced by code or agents

If stale docs remain visible, LLMs *will* hallucinate from them.

---

## Phase 2 — Codebase Sweep (Structural Audit)

### Scope

All **packages and apps** in the monorepo (no exceptions).

### Sweep Categories

#### 1. Dead Code Elimination

Definition of “dead”:

* Not imported or invoked by any runtime path
* Not registered in an event system
* Not listed as a planned stub in the roadmap

Rules:

* Truly dead → delete
* Future-planned → stub + annotate
* Unsure → log and defer (no silent keeps)

No sentimental code hoarding.

---

#### 2. Capability Wiring Audit

Ensure that:

* Every emitted event is handled somewhere
* Every handler corresponds to a real emitter
* No “hope-based” wiring exists

Special focus:

* Orchestrator → Executor → Gateway chains
* Browser / web automation pathways
* Failure propagation (errors must surface, not vanish)

If an action has no observer, it’s broken.

---

#### 3. Configuration Parity Check

* `.env.example` must exactly match runtime expectations
* No hidden env requirements
* No legacy env keys referenced in code

If the system can’t cold-boot from `.env.example`, it’s lying.

---

#### 4. Error Handling & Loop Safety

Identify:

* Silent failures
* Infinite retry or refinement loops
* Missing terminal failure states

Add:

* Explicit failure classes (e.g. `CAPABILITY_MISSING`, `PERMISSION_DENIED`)
* Hard stop conditions with surfaced reasoning

Failure > confusion.

---

## Phase 3 — Verification & Lock-In

### Automated Checks

Must pass:

* `pnpm install`
* `pnpm build` (all packages)
* `pnpm lint` (if present)
* Any existing environment validation scripts

No partial passes.

---

### Manual Verification (Required)

Answer **yes** to all:

* Can a new LLM understand Cairn using only `/documents`?
* Is it clear which agent owns web automation?
* Are long-lived vs ephemeral components unambiguous?
* Can the system fail loudly instead of looping?

If any answer is “no”, stop and fix.

---

## Definition of Done

This audit is complete when:

* `/documents` is the **only source of truth**
* Capabilities are explicitly declared and enforced
* Dead or misleading code is gone
* The system’s limits are clear and respected

This is not cleanup.
This is **structural hygiene**.

---

If you want next steps, the smartest follow-ups would be:

* Drafting **03_CAPABILITY_REGISTRY.md** together
* Designing a **WebAgent contract** that plugs cleanly into this plan
* Writing a one-page “Cairn for LLMs” entrypoint doc

But as a sweep plan?
This one won’t waste your time or lie to your system.
