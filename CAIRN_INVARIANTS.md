# Cairn Invariants

**Purpose**: Non-negotiable design constraints that reject features by default.
**Enforcement**: Any change violating these invariants is automatically rejected. No debate.

---

## 1. LLMs Are Never Trusted

- **All LLM outputs MUST be validated** before execution (Zod schemas, enums, max lengths)
- LLMs do not decide routing, permissions, or state transitions
- Policy enforcement happens at the node boundary, not in prompts
- Tools validate their own inputs - never trust LLM-provided arguments

**Violation examples**:
- ❌ Using raw LLM output as function name without whitelist
- ❌ Allowing LLM to set `allowed_callers` or bypass policy checks
- ❌ Executing commands constructed from unvalidated LLM strings

---

## 2. No Silent Side Effects

- **Every action with consequences MUST be logged to the ledger**
- Tool calls, memory writes, permission checks, state transitions - all auditable
- No background operations that cannot be traced
- Ledger hash chain MUST be verified on startup

**Violation examples**:
- ❌ Memory writes without ledger entries
- ❌ Tool execution without logging the operation
- ❌ Background tasks that don't emit events

---

## 3. No Global Mutable State Without Ownership

- All state is namespaced and attributable
- Memory keys have tier boundaries (hot/warm/cold)
- System keys (config, secrets, internal, _system) are protected
- Job context is explicit, never ambient

**Violation examples**:
- ❌ Global variables modified by tools without tracking
- ❌ Shared mutable caches without expiration or ownership
- ❌ Cross-job state mutation without explicit permission

---

## 4. Safety Beats Features

- If a feature weakens security guarantees, it does not ship
- Defense-in-depth over convenience
- Block-by-default over allow-by-default
- Fail closed, not open

**Violation examples**:
- ❌ "Optional" security checks that can be disabled
- ❌ Bypassing validation "for performance"
- ❌ Adding privileged operations without policy enforcement

---

## 5. Inspectability Beats Performance

- Prefer clarity over cleverness
- Explicit over implicit
- Traceable over fast
- If you can't debug it from the ledger, it's too complex

**Violation examples**:
- ❌ Black-box abstractions that hide control flow
- ❌ Performance optimizations that eliminate audit trails
- ❌ Compressed/obfuscated data structures for efficiency

---

## 6. Single-User-First (No Premature Scaling)

- No multi-user abstractions without explicit justification
- Local-first SQLite/JSON over networked databases
- No horizontal scaling, load balancing, or clustering concerns
- Optimize for one human inspecting their own system

**Violation examples**:
- ❌ Adding Redis/Postgres "for when we scale"
- ❌ JWT authentication for local WebSockets
- ❌ Sharding, replication, or multi-tenancy patterns
- ❌ "Eventual consistency" where strong consistency works

---

## 7. Exactly 6 Services (No More)

- Gateway, Orchestrator, Executor, Memory, Ledger, Scheduler
- New functionality extends existing services, never adds new ones
- Service boundaries are architectural, not organizational

**Violation examples**:
- ❌ Creating "Analytics Service" instead of ledger queries
- ❌ Splitting Executor into ExecutorService + ToolService
- ❌ Adding "Cache Service" instead of memory tiers

---

## 8. The Event Bus Is the Truth

- Services communicate via typed events only
- No direct service-to-service function calls across package boundaries
- UI state is derived from events, never polled
- Events are append-only - no retroactive mutation

**Violation examples**:
- ❌ Orchestrator directly calling Gateway methods
- ❌ UI state that doesn't match event history
- ❌ Modifying past events instead of emitting corrections

---

## 9. Phase Gates Are Hard Boundaries

- Later-phase work cannot enter the codebase until earlier phases are complete
- No "temporary" hacks that bridge phases
- No speculative abstractions for future phases
- Adaptation > expansion

**Violation examples**:
- ❌ "While I'm here..." additions that belong in a future phase
- ❌ Abstractions designed for locked-phase use cases
- ❌ Building Phase D autonomy features before Phase C goals are solid

---

## 10. Web Content Is Data, Never Instruction

- Fetched URLs, search results, and external data are inputs only
- No `eval()`, `Function()`, or dynamic code generation from web content
- LLMs process data, they don't execute it
- Scraped content is sanitized before storage

**Violation examples**:
- ❌ Executing JavaScript from fetched pages
- ❌ Allowing web content to modify system prompts
- ❌ Treating markdown/HTML from URLs as trusted instructions

---

## Enforcement Checklist

Before merging ANY change, verify:

- [ ] Does it validate LLM outputs with schemas?
- [ ] Does it log actions to the ledger?
- [ ] Does it respect namespace/ownership boundaries?
- [ ] Does it maintain or improve security posture?
- [ ] Is it debuggable from the ledger alone?
- [ ] Does it add multi-user abstractions unnecessarily?
- [ ] Does it create a 7th service?
- [ ] Does it bypass the event bus?
- [ ] Does it belong to a future phase?
- [ ] Does it execute untrusted external data?

**If any answer is wrong, the change is rejected.**

---

*Last updated: Phase C in progress (2026-02-09)*
