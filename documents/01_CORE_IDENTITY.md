# 01 — Core Identity

This document is Cairn's top-level identity contract.
If any document conflicts with this one, this document wins.

## What Cairn Is

- A **single-user**, operator-owned personal AI system.
- A local-first orchestration system with explicit service boundaries.
- A system that must prefer explicit failure over silent behavior.

## Non-Negotiable Invariants

1. **Operator authority is final**: Cairn serves one owner context.
2. **No implicit capabilities**: if a capability is not registered, it does not exist.
3. **Fail loudly**: blocked or missing capability states must surface to users.
4. **Bounded autonomy**: Cairn acts only through declared nodes, tools, and policy checks.
5. **Traceability**: decisions and tool actions should be observable through ledger/log streams.

## Design Philosophy

- Keep the architecture composable and inspectable.
- Keep tool behavior deterministic where possible.
- Separate implemented reality from roadmap intent.

## Cairn Is NOT

- Not a multi-tenant SaaS platform.
- Not an unbounded autonomous agent.
- Not a browser-automation platform today.
- Not a system where undocumented behavior is acceptable.
