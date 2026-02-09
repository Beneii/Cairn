# Phase Gates — Hard Boundaries Between Phases

**Purpose**: Mechanically prevent premature work and scope creep by defining clear pass/fail criteria for phase transitions.

**Enforcement**: A phase CANNOT be entered until all gates for the previous phase pass. No exceptions.

---

## Phase Definitions

### Phase A: Security Hardening (Single-User Safety)
**Goal**: Prevent self-owning via prompt injection, tool abuse, memory poisoning.

**Status**: ✅ **COMPLETE** (2026-02-08)

**Delivered**:
- Zod schemas validate all LLM outputs (gatekeeper, planner, executor)
- Tool guardrails block SSRF (private IPs, metadata endpoints)
- Memory key validation protects system keys
- Ledger hash chain verified on startup + every heartbeat
- Error redaction strips paths/keys/tokens before user display

---

### Phase B: Core Expansion
**Goal**: Complete truth.md Phase 2 requirements + foundational integrations.

**Status**: ✅ **COMPLETE** (2026-02-09)

**Delivered**:
- Kanban system (CRUD, auto-create from jobs, archive/restore)
- Cold memory / RAG (SQLite vector store, embeddings, curator promotion)
- Telegram bot (admin chat, typing indicator, message source labels)
- Web search (DuckDuckGo API)
- Memory intelligence (auto-capture, active learning)
- Google OAuth + Calendar integration (read-only)
- Proactive check-ins (2hr cadence, quiet hours)
- Daily briefing (morning delivery, calendar-aware, confidence gating)
- Proactive nudges (goal reminders, anomaly detection, calendar-aware)
- Policy graph visualization (reactflow)

**NOT delivered (deferred)**:
- web_locked research node (deferred — needs prompt injection stripping)

---

### Phase C: Goals as First-Class Objects
**Goal**: Long-term goals that actively shape Cairn's behavior.

**Status**: 🔧 **IN PROGRESS**

**Scope**:
- Goal CRUD via chat (user-authored, Cairn-sharpened)
- Goal type: time_horizon, priority, success_definition, anti_goals, metrics
- Hard limit: max 3 active goals
- Goals Board UI (visible on working surface, not buried in settings)
- Goal Detail panel (edit constraints, review cadence, interruption budget)
- Planner integration (check goals before suggesting actions)
- Drift detection (no progress in N days → suggest archive)
- Review cadence enforcement

**NOT in scope**: Preference learning, approval gates, domain-specific scoring

---

### Phase D: Autonomy & Tools
**Goal**: Expand Cairn's ability to take real-world actions.

**Status**: 🔒 **LOCKED** until Phase C gates pass

**Scope**:
- web_locked research node (truth.md §4)
- Approval gates (ask before external actions)
- Cost dashboards
- Security auditor node

---

## Gate: Phase B → Phase C

### Exit Criteria (All Must Pass)

- [x] Phase A security controls still working
- [x] Cold memory / RAG infrastructure operational
- [x] Kanban, Notes, Chat, Logs all functional
- [x] Proactive system running (check-ins, briefing, nudges)
- [x] `pnpm build` completes without errors
- [x] No new services added (still exactly 6)
- [x] Event bus remains sole inter-service communication

### Status: ✅ **PASSED** (2026-02-09)

---

## Gate: Phase C → Phase D

### Exit Criteria (All Must Pass)

- [ ] Goals CRUD working via chat + dashboard
- [ ] Max 3 active goals enforced at DB level
- [ ] Goals Board visible on main dashboard view
- [ ] Planner checks active goals before responding
- [ ] Drift detection fires for stale goals
- [ ] Review cadence triggers check-in messages
- [ ] `pnpm build` completes without errors
- [ ] System runs 24h with goals active

### Status: 🔒 **LOCKED** (Phase C must complete first)

---

## Enforcement Rules

### Rule 1: No Premature Work
Any commit containing Phase N+1 code while in Phase N is auto-rejected.

### Rule 2: Gate Passage Is Explicit
Moving to the next phase requires:
1. All checkboxes checked in this document
2. Git commit with message: `chore: pass Phase X → Y gate`
3. Update to PHASE_GATES.md showing new phase status

### Rule 3: Stability Windows Are Mandatory
- Phase B → C: 24 hours ✅
- Phase C → D: 24 hours
- Phase D → Future: 7 days

---

## Current Status Summary

| Phase | Status | Frozen Date |
|-------|--------|-------------|
| A     | ✅ Complete | 2026-02-08 |
| B     | ✅ Complete | 2026-02-09 |
| C     | 🔧 In Progress | - |
| D     | 🔒 Locked | - |

---

*Last updated: 2026-02-09*
