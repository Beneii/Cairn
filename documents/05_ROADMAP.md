# 05 — Roadmap (Intent, Not Runtime)

This file tracks direction without claiming implementation.

## Completed / Landed

- Core monorepo split into apps/packages.
- Gatekeeper → planner → executor orchestration path.
- Task and goal package integration in executor tools.

## Active Priorities

1. Continue hardening capability contracts across planner/executor/runtime.
2. Expand fail-fast semantics and observability for blocked states.
3. Keep docs synchronized with implemented behavior.
4. Implement Local Branch Builder from `documents/06_LOCAL_BRANCH_BUILDER_SPEC.md`.

## Deferred

- Browser automation agent until a dedicated service contract is implemented.
- Expanded autonomous multistep execution beyond current single-pass executor flow.

## Rejected (For Now)

- Implicitly available tools not declared in registry.
- Silent retries/refinement loops without surfaced terminal failure.
