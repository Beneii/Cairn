# CAIRN

**UI-First Agentic AI System Framework**

> A living instrument. The system lives; agents merely work.

## What is CAIRN?

CAIRN is an agentic AI system framework built on three core principles:

1. **UI is truth** — If it can't be seen in the UI (logs, animations, state, costs), it doesn't exist
2. **System > Agent** — Agents are constrained workers; the system owns state, memory, permissions
3. **No invisible work** — Every action produces visible evidence: logs, state changes, or animations

These principles ensure complete transparency and control over AI agent behavior.

## Current Status

- ✅ **Production-ready React UI** with physics-based animations and all core components
- ✅ **Complete architecture specification** in [truth.md](truth.md) (authoritative source)
- ✅ **Backend services** (Gateway, Orchestrator, Executor, Memory, Ledger, Scheduler) — implemented and functional

## Quick Start

### Running the Full Stack

```bash
# Install dependencies (from project root)
pnpm install

# Start gateway + scheduler
pnpm dev

# In another terminal, start dashboard
pnpm dashboard
```

Visit `http://localhost:5173` to see the dashboard connected to the live backend.

### Running Dashboard Only

```bash
cd apps/dashboard
pnpm install
pnpm dev
```

## Documentation

Start here based on your goal:

- **New to CAIRN?** → Read [Getting Started](docs/01-getting-started/installation.md)
- **Want to understand the architecture?** → See [Architecture Overview](docs/02-architecture/overview.md)
- **Building UI components?** → Check [UI Components](docs/03-ui-components/overview.md)
- **Exploring everything?** → Browse the [Documentation Index](docs/00-INDEX.md)
- **Understanding core principles?** → Read [Core Principles](docs/07-reference/core-principles.md)

## Core Concepts

CAIRN orchestrates agents through six services working together:

### The Six Services

1. **Gateway** — Fast path for user input, intent classification, immediate responses
2. **Orchestrator** — Graph-based execution engine with policy enforcement and permissions
3. **Executor** — Safe, sandboxed tool execution (APIs, files, code)
4. **Memory** — Three-tier system: Hot (volatile), Warm (curated), Cold (RAG-based)
5. **Ledger** — Append-only audit trail with cost tracking
6. **Scheduler** — Background heartbeat and job processing

### Core Components (UI)

The React frontend visualizes the entire system state:

- **Nucleus** — Physics-based animation showing system state (idle, thinking, tooling, waiting, error)
- **Chat** — Natural language conversation with collapsible tool outputs
- **Notes** — Agent-read inbox (replaces prompt-stuffing)
- **Kanban** — Task visualization (backlog, active, blocked, done)
- **Logs** — Real-time system activity with type-based filtering
- **Pages** — Agents, Integrations, Preferences, Archive, Diagnostics

## Tech Stack

### Frontend
- **React 18** + TypeScript
- **Vite 7** — Build tool
- **Tailwind CSS 4** — Styling
- **Framer Motion** — Animations
- **Lucide** — Icons

### Backend
- **Node.js** + TypeScript
- **pnpm** monorepo with workspaces
- **LangGraph-style** orchestration
- **OpenAI API** for LLM inference
- **Telegram** integration for messaging

## Project Structure

```
cairn/
├── README.md                  # You are here
├── truth.md                   # Authoritative architecture specification
├── SOUL.md                    # System values and tone
├── IDENTITY.md                # Ownership and access
├── POLICY.md                  # Hard safety rules
├── CAPABILITIES.md            # Tools and tiers
├── PHASE_GATES.md             # Development phase boundaries
├── CAIRN_INVARIANTS.md        # Non-negotiable design constraints
├── DEPLOYMENT.md              # VPS deployment guide
├── docs/                      # Documentation
│   ├── 00-INDEX.md
│   ├── 01-getting-started/
│   ├── 02-architecture/
│   ├── 03-ui-components/
│   ├── 06-contributing/
│   └── 07-reference/
├── apps/
│   ├── dashboard/             # React frontend
│   │   ├── src/app/
│   │   │   ├── components/cairn/  # Core components
│   │   │   └── App.tsx
│   │   └── package.json
│   └── gateway/               # WebSocket + HTTP server
│       └── src/
├── packages/
│   ├── orchestrator/          # Graph execution engine
│   ├── executor/              # Tool execution sandbox
│   ├── memory/                # Hot/Warm memory system
│   ├── ledger/                # Audit trail
│   ├── scheduler/             # Heartbeat and jobs
│   ├── policy/                # Permission enforcement
│   └── shared/                # Common types and utilities
├── data/                      # Runtime data (jobs, memory, ledger)
├── configs/                   # Environment configs
└── scripts/                   # Utility scripts
```

## Key Features

### Physics-Based Nucleus

The central UI component visualizes system state through organic motion:

| State | Animation | Meaning |
|-------|-----------|---------|
| **Idle** | Gentle drift | Ready, no active work |
| **Thinking** | Fast orbital spin | Planning/reasoning |
| **Tooling** | Expansion + budding | Tool execution in progress |
| **Waiting** | Nearly frozen | Waiting for external input |
| **Error** | Rapid jitter | System error state |

### No Prompt-Stuffing

The **Notes** system replaces traditional prompt-stuffing:
- Agents read messages from an inbox
- Messages have read/unread states
- Can be resurfaced if needed
- Cleaner separation of concerns

### Complete Transparency

Everything is visible:
- All tool calls logged with inputs/outputs
- Cost tracking per job and model
- Policy violations recorded
- Security events audited
- Sub-agent activity shown in real-time

## Development

### Local Development

```bash
# From project root
pnpm install            # Install all dependencies
pnpm dev                # Start gateway + scheduler
pnpm dashboard          # Start dashboard (separate terminal)
pnpm build              # Build all packages
```

### Project Guidelines

See [apps/dashboard/guidelines/Guidelines.md](apps/dashboard/guidelines/Guidelines.md) for development standards.

## Architecture

For detailed architecture information, see [truth.md](truth.md) — the authoritative specification for the entire system.

Key topics:
- [Six Services Architecture](docs/02-architecture/overview.md)
- [Execution Graph & Nodes](docs/02-architecture/execution-graph.md)
- [Memory Tiers](docs/02-architecture/memory-tiers.md)

## Contributing

See [Contributing Guidelines](docs/06-contributing/code-style.md) for development standards, git workflow, and PR process.

### Creating New Components

1. Place in `apps/dashboard/src/app/components/cairn/`
2. Export from component file
3. Document in [docs/03-ui-components/](docs/03-ui-components/)
4. Add TypeScript interfaces to [types.ts](apps/dashboard/src/app/components/cairn/types.ts)

## Implementation Status

### Phase A: Security Hardening ✅
- Zod schema validation on all LLM outputs
- Tool guardrails (SSRF protection, memory namespace)
- Ledger hash chain verification
- Error redaction

### Phase B: Core Expansion (Planned)
- web_locked research node
- Cold memory (RAG system)

### Phase C: Integrations (Planned)
- Google read-only integration
- Cost dashboards
- Security auditor node

## Learn More

- **[Complete Documentation](docs/00-INDEX.md)** — Browse all docs
- **[Architecture Specification](truth.md)** — Authoritative system design
- **[Core Principles](docs/07-reference/core-principles.md)** — Understanding the philosophy
- **[FAQ](docs/07-reference/faq.md)** — Common questions

## Questions?

- Check the [FAQ](docs/07-reference/faq.md)
- Read [Troubleshooting](docs/07-reference/troubleshooting.md)
- Review [Glossary](docs/07-reference/glossary.md) for terminology

## License

[To be determined]

## Attribution

- UI components built with [shadcn/ui](https://ui.shadcn.com/) (MIT)
- Icons by [Lucide](https://lucide.dev/) (MIT)
- See [ATTRIBUTIONS.md](apps/dashboard/ATTRIBUTIONS.md) for full credits

---

**Cairn is a living instrument. The system lives; agents merely work.**
