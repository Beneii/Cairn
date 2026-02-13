# 05 — Roadmap (Intent, Not Runtime)

This file tracks direction without claiming implementation.

## Completed / Landed

- Core monorepo split into apps/packages.
- V1 pipeline: Gatekeeper → Planner → Executor orchestration path.
- V2 pipeline: Pre-Router → Classifier → Contract Builder → Skill Executor → Response Composer.
- Skill registry bridging 14 skills to legacy executor tools.
- Web agent for browser automation and web search routing.
- Dashboard self-update system (`system:update` → git pull + build + restart).
- Local mode toggle (Ollama support via dashboard, `LOCAL_MODE_ENABLED`).
- Task, goal, and note management via skills and dashboard UI.
- Mobile companion app (React Native) with pairing and push notifications.
- Google Calendar and Gmail integration.
- Vision processing (image attachments via LLM).
- Timezone-aware classifier (AEST default, resolves relative dates).
- Cairn identity enforcement across all system prompts.
- **Local Branch Builder**: Autonomous nightly coding agent (`packages/builder`).

## Active Priorities

1. **Tool migration** — Move remaining legacy tools to manifest system (`09_TOOL_MIGRATION_MATRIX.md`).
2. **Shell skills** — Implement skill-as-shell-script execution model (`10_SKILLS_AND_SHELL_INTEGRATION.md`).
3. **Lean multi-agent architecture** — Implement team-based agent model from `08_LEAN_ARCHITECTURE.md`.
4. **Lean multi-agent architecture** — Implement team-based agent model from `08_LEAN_ARCHITECTURE.md`.
5. **Memory compaction** — Context compaction via semantic summaries per doc 10.
6. Keep docs synchronized with implemented behavior.

## Deferred

- Full multi-agent team structure (Build, Ops, Knowledge, Product, Personal teams).
- Memory proposals with verifier approval gate.
- Expanded autonomous multistep execution beyond current planner-driven flow.

## Rejected (For Now)

- Implicitly available tools not declared in registry.
- Silent retries/refinement loops without surfaced terminal failure.
- Multi-tenant / SaaS deployment model.
