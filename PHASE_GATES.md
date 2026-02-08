# Phase Gates — Hard Boundaries Between Phases

**Purpose**: Mechanically prevent premature work and scope creep by defining clear pass/fail criteria for phase transitions.

**Enforcement**: A phase CANNOT be entered until all gates for the previous phase pass. No exceptions.

---

## Phase Definitions

### Phase A: Security Hardening (Single-User Safety)
**Goal**: Prevent self-owning via prompt injection, tool abuse, memory poisoning.

**Scope**:
- LLM output validation (Zod schemas)
- Tool sandboxing (URL allowlists, memory namespacing)
- Ledger integrity (hash chain verification)
- Error redaction (strip sensitive data)

**NOT in scope**: Scalability, multi-user concerns, production deployment.

**Status**: ✅ **COMPLETE**

---

### Phase B: Core Expansion
**Goal**: Complete truth.md Phase 2 requirements.

**Scope** (from truth.md §11):
- Kanban system ✅ (already complete)
- web_locked research node (§4)
- Cold memory / RAG (§1.4, §7)

**NOT in scope**: Google integrations, cost dashboards, security auditor node.

**Status**: 🔒 **LOCKED** until Phase A gates pass

---

### Phase C: Integrations & Observability
**Goal**: Complete truth.md Phase 3 requirements.

**Scope** (from truth.md §11):
- Google read-only integration
- Cost dashboards
- Security auditor node

**NOT in scope**: Multi-user features, distributed systems, cloud deployment.

**Status**: 🔒 **LOCKED** until Phase B gates pass

---

## Gate 1: Phase A → Phase B

**Question**: Is Phase A frozen and verified?

### Exit Criteria (All Must Pass)

#### 1. Security Implementation Complete
- [x] Zod schemas validate all LLM outputs (gatekeeper, planner, executor)
- [x] Tool guardrails block SSRF (private IPs, metadata endpoints)
- [x] Memory key validation protects system keys
- [x] Ledger hash chain verified on startup
- [x] Error redaction strips paths/keys/tokens before user display

#### 2. Build Health
- [x] `pnpm build` completes without errors
- [x] `pnpm audit` reports no vulnerabilities
- [x] All packages compile with TypeScript strict mode

#### 3. Documentation Synchronized
- [x] MEMORY.md reflects Phase A status
- [x] CAIRN_INVARIANTS.md exists and enforced
- [x] Phase A changes logged in ledger

#### 4. No Phase B Work Has Leaked
- [x] No RAG/vector database code exists
- [x] No web_locked node implementation exists
- [x] No Phase B abstractions in shared packages

#### 5. Stability Window
- [x] System runs for 24 hours without crashes
- [x] No critical bugs reported in Phase A hardening
- [x] Manual testing confirms security controls work

#### 6. Invariants Upheld
- [x] All changes pass CAIRN_INVARIANTS.md enforcement checklist
- [x] No new services added (still exactly 6)
- [x] Event bus remains sole inter-service communication

### How to Check
```bash
# Build health
pnpm build && pnpm audit

# Code search for Phase B leakage
rg -i "vector|embedding|rag|web_locked" packages/ apps/ --type ts

# Manual verification
1. Start gateway: pnpm dev
2. Start dashboard: pnpm dashboard
3. Send message triggering gatekeeper → planner → executor
4. Verify ledger hash chain: check logs for verification success
5. Test tool guardrails: try fetch_url with 127.0.0.1 (should block)
6. Test memory protection: try memory_write with key "config_" (should block)
```

### Status: ✅ **PASSED** (2026-02-08)

---

## Gate 2: Phase B → Phase C

**Question**: Is Phase B frozen and verified?

### Entry Requirements (Must Check Before Starting Phase B)
- [ ] All Phase A → B gates passed
- [ ] Phase A code frozen (no changes except critical bugs)
- [ ] PHASE_GATES.md updated with Phase B start date

### Exit Criteria (All Must Pass)

#### 1. Phase B Implementation Complete
- [ ] web_locked node implemented (§4 of truth.md)
  - Tools: browser + parser only
  - Outputs: structured findings
  - No state mutation
- [ ] Cold memory / RAG implemented (§1.4 of truth.md)
  - Vector embeddings for notes/documents
  - Retrieval interface (no raw DB access)
  - Curator process for warm → cold promotion
- [ ] All Phase B features tested end-to-end

#### 2. Build Health
- [ ] `pnpm build` completes without errors
- [ ] `pnpm audit` reports no vulnerabilities
- [ ] No regressions in Phase A security controls

#### 3. Documentation Synchronized
- [ ] MEMORY.md reflects Phase B status
- [ ] truth.md compliance verified (§11 Phase 2)
- [ ] Phase B changes logged in ledger

#### 4. No Phase C Work Has Leaked
- [ ] No Google API integration code exists
- [ ] No cost dashboard UI exists
- [ ] No security auditor node exists

#### 5. Stability Window
- [ ] System runs for 24 hours with Phase B features active
- [ ] No critical bugs in web_locked or cold memory
- [ ] RAG retrieval performance acceptable (<500ms p95)

#### 6. Invariants Upheld
- [ ] All changes pass CAIRN_INVARIANTS.md enforcement checklist
- [ ] No new services added (still exactly 6)
- [ ] web_locked node properly isolated (no state mutation)

### How to Check
```bash
# Phase C leakage check
rg -i "google.*api|googleapis|cost.*dashboard|security.*auditor" packages/ apps/ --type ts

# RAG functionality test
1. Add note via dashboard
2. Wait for warm → cold promotion
3. Query cold memory via planner
4. Verify retrieval works and is fast

# web_locked isolation test
1. Trigger web_locked node with malicious content
2. Verify no state mutation occurred
3. Check ledger for proper sandboxing
```

### Status: 🔒 **LOCKED** (Phase A must complete first)

---

## Gate 3: Phase C → Future

**Question**: Is Phase C frozen and verified?

### Entry Requirements (Must Check Before Starting Phase C)
- [ ] All Phase B → C gates passed
- [ ] Phase B code frozen (no changes except critical bugs)
- [ ] PHASE_GATES.md updated with Phase C start date

### Exit Criteria (All Must Pass)

#### 1. Phase C Implementation Complete
- [ ] Google read-only integration (truth.md §11 Phase 3)
- [ ] Cost dashboards (truth.md §11 Phase 3)
- [ ] Security auditor node (truth.md §11 Phase 3)

#### 2. Build Health
- [ ] `pnpm build` completes without errors
- [ ] `pnpm audit` reports no vulnerabilities
- [ ] No regressions in Phase A/B features

#### 3. Documentation Synchronized
- [ ] MEMORY.md reflects Phase C status
- [ ] truth.md Phase 3 compliance verified
- [ ] All major features documented

#### 4. System Maturity
- [ ] System runs for 7 days without intervention
- [ ] Ledger integrity maintained over time
- [ ] Memory promotion working correctly

#### 5. Invariants Upheld
- [ ] All changes pass CAIRN_INVARIANTS.md enforcement checklist
- [ ] No new services added (still exactly 6)
- [ ] Single-user architecture preserved

### Status: 🔒 **LOCKED** (Phase B must complete first)

---

## Enforcement Rules

### Rule 1: No Premature Work
**Any PR/commit containing Phase N+1 code while in Phase N is auto-rejected.**

Check with:
```bash
# If in Phase A, reject any Phase B/C keywords
git diff main...HEAD | rg -i "vector|embedding|rag|web_locked|google.*api|cost.*dashboard"
```

### Rule 2: No Backporting Without Justification
Once a phase is frozen, changes require explicit justification:
- Critical security bug: ✅ Allowed
- Performance optimization: ❌ Rejected (wait for next phase)
- Feature enhancement: ❌ Rejected (goes to next phase)
- Bug fix (non-critical): ⚠️ Allowed if trivial, otherwise next phase

### Rule 3: Gate Passage Is Explicit
Moving to the next phase requires:
1. All checkboxes checked in this document
2. Git commit with message: `chore: pass Phase X → Y gate`
3. Update to PHASE_GATES.md showing new phase status
4. Update to MEMORY.md reflecting current phase

### Rule 4: Stability Windows Are Mandatory
You cannot pass a gate until the stability window completes:
- Phase A → B: 24 hours
- Phase B → C: 24 hours
- Phase C → Future: 7 days

This prevents rushing and catches integration bugs.

---

## Current Status Summary

| Phase | Status | Start Date | Frozen Date | Gate Pass |
|-------|--------|------------|-------------|-----------|
| A     | ✅ Complete | 2026-02-05 | TBD | ⏳ Pending |
| B     | 🔒 Locked | - | - | 🔒 Blocked |
| C     | 🔒 Locked | - | - | 🔒 Blocked |

---

## Quick Reference: "Can I Add This?"

**Decision tree:**

1. What phase am I in? → **Phase A** (security hardening)
2. Does this belong to Phase A scope?
   - Yes → Proceed if it passes CAIRN_INVARIANTS.md
   - No → What phase does it belong to?
3. Does it belong to Phase B or C?
   - Yes → Add to PARKING_LOT.md, implement later
   - No → Reject (not in truth.md scope)

---

*Last updated: 2026-02-05 (Phase A completion)*
*Next review: After 24-hour stability window*
