# Cairn

> **Start Here:** [01 - Core Identity](documents/01_CORE_IDENTITY.md)

Cairn is a single-user, operator-owned personal AI system. It is a local-first orchestration system with explicit service boundaries, designed to prefer explicit failure over silent behavior.

## Documentation

The project's documentation is located in the `documents/` directory and serves as the source of truth for all architectural and capability claims.

- **[01 — Core Identity](documents/01_CORE_IDENTITY.md)**: What Cairn is (and is not).
- **[02 — Architecture](documents/02_ARCHITECTURE.md)**: Implemented runtime reality.
- **[03 — Capability Registry](documents/03_CAPABILITY_REGISTRY.md)**: Contract between planning, execution, and reality.
- **[04 — Policies and Gates](documents/04_POLICIES_AND_GATES.md)**: Security and capability gates.
- **[05 — Roadmap](documents/05_ROADMAP.md)**: Intent vs. implemented reality.
- **[06 — Local Branch Builder Spec](documents/06_LOCAL_BRANCH_BUILDER_SPEC.md)**: Specification for the developer worker capability.
- **[09 — Tool Migration Matrix](documents/09_TOOL_MIGRATION_MATRIX.md)**: Legacy-to-manifest tool migration status and runtime gates.
- **[10 — Skills and Shell Integration](documents/10_SKILLS_AND_SHELL_INTEGRATION.md)**: Skill manifests, scripts, and planner/executor shell integration contracts.

## Project Structure

- `apps/`: Application entry points (Gateway, Dashboard).
- `packages/`: Shared libraries and core logic (Orchestrator, Executor, Memory, Ledger).
- `documents/`: Project documentation and specifications.
