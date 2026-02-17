# Cairn Repo Architecture Audit

This document captures a factual architecture/security audit of the current Cairn monorepo implementation, with emphasis on runtime wiring and constraints for safe self-growth.

## 1. Repo Map
- Root-level structure includes `apps/`, `packages/`, `skills/`, `documents/`, and `configs/`.
- `apps/gateway`: Express + WebSocket runtime gateway.
- `apps/dashboard`: Vite React dashboard.
- `apps/mobile`: Expo mobile client.
- `packages/orchestrator`: V2 pipeline (pre-router/classifier/contract/planner/executor).
- `packages/executor`: Tool execution, policy checks, legacy+manifest tool registries.
- `packages/policy`: Node configs, graph edges, enforcement helpers.
- `packages/memory`: hot/warm/cold memory and embedding curator.
- `packages/ledger`: append-only hash-linked ledger.
- `packages/builder`: issue/spec/worker automation that can edit code + git commit.
- `skills/manifest-registry.json` exists, but runtime skill execution is currently code-registered from `packages/orchestrator/src/skill-registry.ts`.

## 2. Entrypoints & Boot Flow
- Primary production start: root `package.json` script `start` launches `apps/gateway/dist/index.js`.
- Gateway `main()` initializes ledger/memory/jobs/notes/kanban/tasks/LLM/integrations, then starts HTTP+WS server and schedulers.
- Dashboard and mobile are separate frontends (`vite` and `expo`) connecting to gateway.

## 3. Orchestrator Flow
- V2 flow in `processMessage`: ensure skill registry -> pre-route -> (direct or classify) -> contract build -> execute single skill OR create+execute plan -> compose response -> append chat history/recent tasks -> finish trace.
- Classifier and planner are LLM-backed, contract builder and executor are deterministic.
- Trace metadata + status is appended to ledger and bus logs.

## 4. Skills System
- Runtime skills are a Map-based in-memory registry loaded from `DEFAULT_SKILLS` in `skill-registry.ts` and mapped to executor tools.
- `skills/manifest-registry.json` appears documentation-facing currently; no direct runtime loader found in apps/packages code.
- Execution mode: in-process handler invocation (no child process shell skill runner path in runtime orchestrator).

## 5. Tools System
- Two layers exist:
  1) Legacy `toolRegistry` in `packages/executor/src/tools.ts` (string->async function).
  2) Manifest-based registry in `packages/executor/src/manifest.ts` using zod schemas, safety tiers, and `executeTool` with approval gate.
- Executor policy gate runs before tool execution via `checkTool(...)`.

## 6. Policy & Vault Security
- Policy model is node-centric allowlists (`NODES`) + transition graph (`GRAPH_EDGES`) + checks (`checkTool`, `checkTransition`, etc.).
- Vault stores encrypted secrets in `~/.cairn/vault.db` with AES-256-GCM using local key file `~/.cairn/vault.key`.
- Some secrets are still written to `.env` by gateway config paths before/alongside vault writes.

## 7. Model Layer
- Model interface in orchestrator `callLLM` supports:
  - Cloud OpenAI chat completions
  - Local mode via Ollama, selected per-node from policy `local_model`.
- Ollama model list/pull/chat client is in `orchestrator/src/ollama.ts`.
- Cost tracking exists for OpenAI and embeddings.

## 8. Memory & Ledger
- Hot memory: in-process TTL map.
- Warm memory: Automerge doc persisted to `data/memory/warm.automerge`.
- Cold memory: SQLite vector store `data/cold_memory.db` + embedding-based search.
- Ledger: append-only JSON with hash-chain verification in `data/ledger/ledger.json`.

## 9. Builder & Self-Modification
- Builder worker can create branch, modify files from spec, run task test commands, run `pnpm build`, and perform `git add` + `git commit`.
- Worker writes directly to repo files via `writeFile(join(projectRoot, task.targetFile), ...)`.
- Push is currently commented out.

## 10. Gateway–Dashboard Interface
- Dashboard talks to gateway over WebSocket `/ws` using message protocol (`chat:send`, `config:set_*`, `builder:trigger`, etc.).
- Gateway also exposes REST endpoints (`/health`, `/models`, `/models/status`, `/models/pull`, OAuth routes).

## 11. Top Risks (with evidence)
- Skill manifest ambiguity (filesystem manifest not runtime-authoritative).
- Builder has repo write+git commit capabilities from LLM-generated specs.
- No explicit builder scope enforcement against `scopeAllowlist/scopeDenylist` during write step.
- Config API writes plaintext `.env` for sensitive keys.
- Gateway remote `system:update` executes `git pull` and `pnpm build`.
- Mixed legacy+manifest tool systems increase policy drift risk.
- Tool tiering uses `toolTier` parameter but executor passes fixed `0`.
- Some policy allowlists include powerful actions (`model_pull`, browser automation) without extra approval path.
- Local trusted socket sessions get full capabilities by IP heuristic.
- Skills from filesystem (`skills/`) are not cryptographically signed/version-verified in runtime path.

## 12. Self-Growth Readiness Score
- Preliminary score: **4/10**.
- Strong foundations: deterministic contract/execution phases, policy scaffold, ledger integrity checks.
- Readiness blockers: self-modifying builder guardrails are not strict enough for safe autonomous growth.
