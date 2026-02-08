# CAIRN Documentation Index

Complete documentation for the CAIRN agentic AI system framework.

## Quick Navigation

**First time here?** Start with [Getting Started](01-getting-started/installation.md)

**Want to understand the architecture?** Jump to [Architecture Overview](02-architecture/overview.md)

**Building UI components?** See [UI Components](03-ui-components/overview.md)

---

## Documentation Structure

### 1. Getting Started

For developers setting up CAIRN for the first time.

- [Installation](01-getting-started/installation.md) — Setup requirements and installation
- [Running the UI](01-getting-started/running-ui.md) — Current: UI development with mock data
- [Configuration](01-getting-started/configuration.md) — Environment variables and settings
- [Development Workflow](01-getting-started/development-workflow.md) — Daily development practices

### 2. Architecture

Understanding the six-service system design.

- [Overview](02-architecture/overview.md) — High-level architecture and principles
- [Execution Graph](02-architecture/execution-graph.md) — Graph-based orchestration model
- [Memory Tiers](02-architecture/memory-tiers.md) — Hot/Warm/Cold memory system
- **Individual Services:**
  - [Gateway](02-architecture/gateway.md) — Fast path and intent classification
  - [Orchestrator](02-architecture/orchestrator.md) — Graph execution engine
  - [Executor](02-architecture/executor.md) — Sandboxed tool execution
  - [Memory](02-architecture/memory.md) — Memory service details
  - [Ledger](02-architecture/ledger.md) — Audit trail and cost tracking
  - [Scheduler](02-architecture/scheduler.md) — Heartbeat and background jobs
- [Data Models](02-architecture/data-models.md) — Jobs, Artifacts, core types

### 3. UI Components

Complete guide to the React component library.

- [Overview](03-ui-components/overview.md) — UI architecture and design philosophy
- [Nucleus](03-ui-components/nucleus.md) — Physics-based state visualization
- [Chat](03-ui-components/chat.md) — Conversation interface
- [Notes](03-ui-components/notes.md) — Agent-read inbox system
- [Kanban](03-ui-components/kanban.md) — Task state visualization
- [Logs](03-ui-components/logs.md) — System activity monitoring
- [Pages](03-ui-components/pages.md) — Agents, Integrations, Preferences
- [Types](03-ui-components/types.md) — TypeScript interfaces
- [Styling](03-ui-components/styling.md) — Tailwind conventions and animations

### 4. Contributing

Guidelines for contributors.

- [Code Style](06-contributing/code-style.md) — TypeScript/React conventions
- [Git Workflow](06-contributing/git-workflow.md) — Branching and commits
- [Review Process](06-contributing/review-process.md) — PR guidelines
- [Roadmap](06-contributing/roadmap.md) — Future features and phases

### 5. Reference

Quick reference materials.

- [Core Principles](07-reference/core-principles.md) — Deep dive on foundational concepts
- [Glossary](07-reference/glossary.md) — Term definitions
- [FAQ](07-reference/faq.md) — Common questions
- [Troubleshooting](07-reference/troubleshooting.md) — Common issues and solutions

---

## By Use Case

### I'm New to CAIRN

1. Read [README.md](../README.md)
2. Follow [Installation](01-getting-started/installation.md)
3. Run [Running the UI](01-getting-started/running-ui.md)
4. Explore [Core Principles](07-reference/core-principles.md)
5. Browse [Architecture Overview](02-architecture/overview.md)

### I Want to Build UI Components

1. Start with [UI Components Overview](03-ui-components/overview.md)
2. Study component examples (Nucleus, Chat, Notes, etc.)
3. Check [Code Style](06-contributing/code-style.md)
5. Reference [Types](03-ui-components/types.md) for interfaces

### I Want to Understand the Architecture

1. Read [Architecture Overview](02-architecture/overview.md)
2. Deep dive: [Core Principles](07-reference/core-principles.md)
3. Study [Execution Graph](02-architecture/execution-graph.md)
4. Learn [Memory Tiers](02-architecture/memory-tiers.md)
5. Review individual services (Gateway, Orchestrator, etc.)

### I Want to Contribute Code

1. Read [Code Style](06-contributing/code-style.md)
2. Follow [Git Workflow](06-contributing/git-workflow.md)
3. Understand [Review Process](06-contributing/review-process.md)
4. Check [Roadmap](06-contributing/roadmap.md) for priorities
5. Refer to [Testing](05-guides/testing.md) for test strategy

### I'm Implementing Backend Services

1. Review [Architecture Overview](02-architecture/overview.md)
2. Study [Execution Graph](02-architecture/execution-graph.md)
3. Read individual service docs (Gateway, Orchestrator, etc.)
4. Check [API Reference](04-api-reference/overview.md) for endpoint specs
5. Review [Data Models](02-architecture/data-models.md)

### I Need to Troubleshoot Something

1. Check [FAQ](07-reference/faq.md)
2. Search [Troubleshooting](07-reference/troubleshooting.md)
3. Review [Glossary](07-reference/glossary.md) for terminology
4. Look at relevant component documentation

---

## Documentation Status

Legend:
- ✅ Complete and accurate for current state
- 🚧 Stub/outline for future implementation
- ⚠️ Needs update

| Category | Document | Status | Notes |
|----------|----------|--------|-------|
| **Getting Started** | Installation | ✅ | UI setup documented |
| | Running UI | ✅ | Development workflow |
| | Configuration | 🚧 | Placeholder |
| | Dev Workflow | 🚧 | Placeholder |
| **Architecture** | Overview | ✅ | Six services explained |
| | Execution Graph | ✅ | Graph orchestration |
| | Memory Tiers | ✅ | Hot/Warm/Cold system |
| | Individual Services | 🚧 | Service stubs |
| | Data Models | 🚧 | Type documentation |
| **UI Components** | Overview | ✅ | UI architecture |
| | Nucleus | ✅ | Physics engine documented |
| | Chat | 🚧 | Component docs |
| | Notes | 🚧 | Component docs |
| | Kanban | 🚧 | Component docs |
| | Logs | 🚧 | Component docs |
| | Pages | 🚧 | Navigation docs |
| | Types | ✅ | Interface definitions |
| | Styling | 🚧 | Design system docs |
| **API Reference** | Overview | 🚧 | Planned APIs only |
| | Individual APIs | 🚧 | Endpoint specs |
| | WebSocket Protocol | 🚧 | Real-time protocol |
| **Guides** | Adding Components | 🚧 | Component guide |
| | Creating Nodes | 🚧 | Future feature |
| | Tools | 🚧 | Future feature |
| | Memory Patterns | 🚧 | Best practices |
| | Security Model | ✅ | Security overview |
| | Testing | 🚧 | Testing strategy |
| **Contributing** | Code Style | ✅ | Conventions |
| | Git Workflow | ✅ | Git guidelines |
| | Review Process | 🚧 | PR process |
| | Roadmap | 🚧 | Future features |
| **Reference** | Core Principles | ✅ | Deep dive |
| | Glossary | 🚧 | Terminology |
| | FAQ | ✅ | Common questions |
| | Troubleshooting | 🚧 | Common issues |

---

## Key Principles

Everything in CAIRN documentation follows these principles:

### 1. UI is Truth
- Documentation describes what's visible in the UI
- What cannot be seen is not described as implemented
- Clear distinction between current state and planned features

### 2. Authority Hierarchy
1. [truth.md](../truth.md) — Source of truth for architecture
2. Component code files — Source of truth for implementation
3. This documentation — Explains the above two

### 3. Clarity Over Completeness
- Clear, scannable sections
- Concrete examples over abstract descriptions
- Explicit status markers (✅ 🚧 ⚠️)

### 4. Link Everything
- Cross-references between related docs
- Links to source code files with line numbers
- Navigation between sections

---

## Contributing to Documentation

Documentation is part of the codebase. When you:

- **Add a component** → Add corresponding doc in `docs/03-ui-components/`
- **Change architecture** → Update relevant docs and [truth.md](../truth.md)
- **Fix a bug** → Update [FAQ](07-reference/faq.md) or [Troubleshooting](07-reference/troubleshooting.md)
- **Add a guide** → Update this index and relevant section

See [Contributing Guidelines](06-contributing/code-style.md) for documentation standards.

---

## External Resources

- [React Documentation](https://react.dev) — UI framework
- [Framer Motion](https://www.framer.com/motion/) — Animation library
- [Tailwind CSS](https://tailwindcss.com/) — Styling framework
- [Radix UI](https://www.radix-ui.com/) — Component primitives
- [LangGraph](https://langchain-ai.github.io/langgraph/) — Orchestration reference

---

**Last updated:** Documentation is evergreen. Last significant update tracked in git history.
