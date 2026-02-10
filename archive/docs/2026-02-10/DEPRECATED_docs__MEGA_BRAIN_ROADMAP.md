# 🧠 Mega Brain Roadmap

> Transforming Cairn from a capable assistant into a truly intelligent, proactive, long-memory companion.

**Created**: 2026-02-08
**Status**: 🚀 Active Development

---

## Phase B: Core Expansion

### 1. Cold Memory / RAG System
**Status**: ✅ Core Implementation Complete
**Priority**: 🔴 Critical

| Task | Status | Notes |
|------|--------|-------|
| Add sqlite-vec or vector extension for embeddings | ✅ Done | Using SQLite with Float32 blob storage + cosine similarity |
| Create embedding service (OpenAI text-embedding-3-small) | ✅ Done | Batch embeddings, 1536 dimensions |
| Define cold memory schema (documents, chunks, embeddings) | ✅ Done | Two tables: cold_documents, cold_chunks |
| Implement vector_search tool | ✅ Done | Top-k retrieval with min score filter |
| Create warm → cold curator process | ✅ Done | Auto-promotion with rules, runs every 30min |
| Add cold memory retrieval to planner node | ✅ Done | Auto-retrieves relevant context for every request |
| Test end-to-end: add note → promote → retrieve | ✅ Done | Verified semantic search working with 0.3-0.6 scores |

### 2. web_locked Research Node
**Status**: ✅ Core Implementation Complete
**Priority**: 🟡 High

| Task | Status | Notes |
|------|--------|
-------|
| Create web_locked node with isolated execution | ✅ Done | No memory access, no tools, read-only |
| Add prompt injection detection | ✅ Done | 15+ injection patterns detected |
| Add content sanitization | ✅ Done | Script removal, data URL stripping, truncation |
| Update policy with web_locked node | ✅ Done | Zero memory_write, zero allowed_tools |
| Add browser tool (headless Chromium) | ⬜ Todo | Future: Playwright integration |
| Test with malicious content | ⬜ Todo | Manual testing needed |

---

## Phase C: Integrations & Observability

### 3. Google Read-Only Integration
**Status**: ⬜ Not Started
**Priority**: 🟡 High

| Task | Status | Notes |
|------|--------|-------|
| Wire up Google Calendar read tools | ⬜ Todo | Tools exist in integrations package |
| Add Google Drive read integration | ⬜ Todo | |
| Add Gmail read integration | ⬜ Todo | |
| Dashboard UI for OAuth connection | ⬜ Todo | |

### 4. Cost Dashboards
**Status**: ⬜ Not Started
**Priority**: 🟢 Medium

| Task | Status | Notes |
|------|--------|-------|
| Aggregate costs from ledger by day/week/month | ⬜ Todo | |
| Add cost visualization to dashboard | ⬜ Todo | |
| Per-job cost breakdown view | ⬜ Todo | |
| Budget alerts and warnings | ⬜ Todo | |

### 5. Security Auditor Node
**Status**: ⬜ Not Started
**Priority**: 🟢 Medium

| Task | Status | Notes |
|------|--------|-------|
| Create security_auditor node | ⬜ Todo | |
| Implement secret exposure detection | ⬜ Todo | |
| Implement forbidden file access detection | ⬜ Todo | |
| Schedule periodic security scans | ⬜ Todo | |

---

## Beyond Phases: Mega Brain Features

### 6. Proactive Intelligence
**Status**: ✅ Core Implementation Complete
**Priority**: 🟡 High

| Task | Status | Notes |
|------|--------|-------|
| Connect goals system to check-in prompts | ✅ Done | Goal-driven nudges via proactive engine |
| Pattern recognition for user habits | ✅ Done | Productivity peak detection |
| Calendar-aware proactive suggestions | ✅ Done | Deep work suggestions when calendar clear |
| Anomaly detection and alerts | ✅ Done | Detects goals with no activity in 3+ days |
| Configurable quiet hours and daily limits | ✅ Done | Via proactive_config in warm memory |

### 7. Persistent Long-Term Memory
**Status**: ⬜ Not Started (depends on #1)
**Priority**: 🟡 High

| Task | Status | Notes |
|------|--------|-------|
| Semantic memory organization | ⬜ Todo | |
| Episodic recall (conversation history) | ⬜ Todo | |
| Preference learning system | ⬜ Todo | |
| Nightly memory consolidation job | ⬜ Todo | |

### 8. Multi-Modal Understanding
**Status**: ⬜ Not Started
**Priority**: 🟢 Medium

| Task | Status | Notes |
|------|--------|-------|
| Add GPT-4o Vision support | ⬜ Todo | |
| Image/screenshot analysis tool | ⬜ Todo | |
| Document ingestion (PDF → cold memory) | ⬜ Todo | |
| Voice input via Whisper | ⬜ Todo | |

### 9. Tool Expansion
**Status**: ⬜ Not Started
**Priority**: 🟢 Medium

| Task | Status | Notes |
|------|--------|-------|
| email.send (approval tier) | ⬜ Todo | |
| file.read/write (sandboxed) | ⬜ Todo | |
| code.execute (sandboxed) | ⬜ Todo | |
| browser.screenshot | ⬜ Todo | |
| calendar.create (approval tier) | ⬜ Todo | |

### 10. Sub-Agent Orchestration
**Status**: ⬜ Not Started
**Priority**: 🟢 Medium

| Task | Status | Notes |
|------|--------|-------|
| Research agent (deep web research) | ⬜ Todo | |
| Writing agent (long-form content) | ⬜ Todo | |
| Analysis agent (data processing) | ⬜ Todo | |
| Sub-agent visualization in Nucleus UI | ⬜ Todo | |

---

## Progress Log

| Date | Milestone | Notes |
|------|-----------|-------|
| 2026-02-08 | Roadmap created | Starting with Cold Memory/RAG |
| 2026-02-08 | Cold Memory core complete | SQLite storage, embeddings, vector_search tool |
| 2026-02-08 | Curator process added | Auto warm→cold promotion every 30min |
| 2026-02-08 | Planner integration complete | Auto-retrieves relevant cold memory context |
| 2026-02-08 | **Warm memory tested!** | User profile stored and recalled successfully |
| 2026-02-08 | **Cold memory tested!** | Semantic search working, scores 0.3-0.6 |
| 2026-02-08 | **web_locked node created** | Prompt injection detection, content sanitization |
| 2026-02-08 | **Proactive intelligence added** | Goal nudges, pattern detection, anomaly alerts |

---

## Architecture Decisions

### Cold Memory Stack
- **Embeddings**: OpenAI `text-embedding-3-small` (1536 dimensions, cheap, fast)
- **Storage**: `better-sqlite3` with `sqlite-vec` extension OR dedicated `@anthropic-ai/sdk` compatible store
- **Chunking**: 512 tokens per chunk with 50-token overlap
- **Retrieval**: Top-k semantic search with optional metadata filtering

### Proactivity Model
- Check-ins are **gentle nudges**, not interruptions
- User can configure frequency and topics
- All proactive messages are logged for audit

---

*Last updated: 2026-02-08*
