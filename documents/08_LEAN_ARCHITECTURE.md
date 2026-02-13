# 08 — Lean Agent Infrastructure (Local / Home Lab)

> [!IMPORTANT]
> **This is a TARGET ARCHITECTURE, not current implementation.**
> The team-based multi-agent model, memory proposals, and verifier gate described below are design goals.
> Current reality: Cairn uses a single-agent model with V1/V2 pipelines (see `02_ARCHITECTURE.md`).
> Local mode (Ollama) is partially implemented with a dashboard toggle (see `07_HOME_LAB_PORTABILITY.md`).

This document defines the architecture for the **Local / Home Lab** configuration of Cairn. It is optimized for 16GB VRAM / 32GB RAM systems using specific quantized models via Ollama.

## Core Principles

1.  **Teams > Individuals**: Work is assigned to teams, not just single agents.
2.  **One Model Per Agent**: Each agent has a specific model optimized for its role.
3.  **Planner Does Thinking**: Only the Planner (and specific Workers) do heavy reasoning. Others follow schemas.

## 1. Kernel Agents (System Roles)

| Role | Model | Reason |
| :--- | :--- | :--- |
| **Gatekeeper** | `phi-3.5-mini` | Fast, deterministic classification. |
| **Planner** | `gemma3:12b` | Strong reasoning, long context. The "brain". |
| **Orchestrator** | `phi-3.5-mini` | Dispatching and bookkeeping only. |
| **Executor** | `phi-3-mini` | Tool running, strict schema adherence. |
| **Verifier** | `gemma3:4b` | Truth enforcement, diff validation. |
| **Responder** | `mistral:7b-instruct` | Clean, concise human-facing tone. |

## 2. Agent Teams

### **Build Team** (Code & Repo)
*   **Captain**: Planner
*   **Worker**: `BuildWorker`
*   **Model**: `deepseek-coder-v2:6.7b`
*   **Job**: Code edits, refactors, tests, docs.

### **Ops Team** (Health & Infra)
*   **Captain**: Planner
*   **Worker**: `OpsWorker`
*   **Model**: `mistral:7b-instruct`
*   **Job**: Log analysis, health checks, safe config changes.

### **Knowledge Team** (Memory & Research)
*   **Captain**: Planner
*   **Worker**: `KnowledgeWorker`
*   **Model**: `qwen2.5:7b`
*   **Job**: Research, summaries, memory structuring.

### **Product Team** (UX & Copy)
*   **Captain**: Planner
*   **Worker**: `ProductWorker`
*   **Model**: `mistral:7b-instruct`
*   **Job**: UX structure, microcopy, feature framing.

### **Personal Team** (Life & Schedules)
*   **Captain**: Planner
*   **Worker**: `PersonalWorker`
*   **Model**: `gemma3:4b`
*   **Job**: Calendar, goals, daily planning.

## 3. Memory Policy

**Agents cannot write memory directly.**
They emit a `MemoryProposal` which must be approved by the **Verifier**.

```typescript
interface MemoryProposal {
  target: "cold" | "goals" | "tasks" | "prefs";
  content: any;
  confidence: number;
  reason: string;
}
```

## 4. Hardware Requirements

*   **VRAM**: ~12-16GB (running quantized versions of the above).
*   **RAM**: 32GB system RAM recommended (for swapping/offloading).
*   **Runtime**: Ollama (local API).
