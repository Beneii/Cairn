# CAIRN

**UI-First Agentic AI Personal Assistant**

> A living instrument. The system lives; agents merely work.

## What is CAIRN?

Cairn is a personal AI assistant built on three core principles:

1. **UI is truth** — If it can't be seen in the UI (logs, animations, state, costs), it doesn't exist
2. **System > Agent** — Agents are constrained workers; the system owns state, memory, permissions
3. **No invisible work** — Every action produces visible evidence: logs, state changes, or animations

## Quick Start

```bash
# Install dependencies
pnpm install

# Start gateway (port 3100)
pnpm dev

# In another terminal, start dashboard (port 5173)
pnpm dashboard
```

Visit `http://localhost:5173` to see the dashboard.

## Architecture

Six services, no more:

1. **Gateway** — Express + WebSocket + Telegram bot. First point of contact.
2. **Orchestrator** — Graph-based node execution (gatekeeper → planner → executor).
3. **Executor** — Safe tool execution with policy enforcement.
4. **Memory** — Hot (volatile TTL), Warm (persistent JSON), Cold (RAG/SQLite vectors).
5. **Ledger** — Hash-chained append-only audit trail with cost tracking.
6. **Scheduler** — Heartbeat, stall detection, integrity checks.

### Data Flow

```
User (Dashboard/Telegram)
  → Gateway (WebSocket/HTTP/Bot)
  → Orchestrator (gatekeeper → planner → executor-node)
  → Executor (runs tools with policy checks)
  → Memory/Ledger
  → Event bus → back to UI
```

## UI

### Home Panels

- **Nucleus** — Physics-based animation showing system state (idle/thinking/tooling/error)
- **Chat** — Natural language conversation with collapsible tool outputs
- **Notes** — Inbox for captured items (replaces prompt-stuffing)
- **Kanban** — Task cards (backlog/active/blocked/done)
- **Logs** — Real-time activity stream

### Pages

- **Goals** — Active goals board (max 3), creation, timeline tracking
- **Tasks** — Todo list with today/upcoming/recurring sections
- **Settings** — System config, integrations, diagnostics
- **Archive** — Archived kanban cards

## Project Structure

```
cairn/
├── truth.md                   # Authoritative architecture spec
├── CAIRN_INVARIANTS.md        # Non-negotiable design constraints
├── PHASE_GATES.md             # Phase transition criteria
├── SOUL.md / IDENTITY.md      # System values and identity
├── POLICY.md / CAPABILITIES.md
├── apps/
│   ├── gateway/               # Express + WebSocket + Telegram
│   └── dashboard/             # React UI (Vite + Tailwind)
├── packages/
│   ├── shared/                # Types, event bus, protocol, utils
│   ├── policy/                # Node configs, permission checks
│   ├── orchestrator/          # Graph execution, LLM calls
│   ├── executor/              # Tool runner with guardrails
│   ├── memory/                # Hot/Warm/Cold memory tiers
│   ├── ledger/                # Audit trail
│   ├── scheduler/             # Heartbeat and jobs
│   ├── goals/                 # Goal tracking, briefings, proactive nudges
│   ├── tasks/                 # Task management (one-off + recurring)
│   └── integrations/          # Google OAuth + Calendar API
├── data/                      # Runtime data (SQLite DBs, JSON, ledger)
└── configs/                   # Environment configs
```

## Tech Stack

**Frontend**: React 18, Vite 7, Tailwind CSS 4, Framer Motion, Lucide, ReactFlow
**Backend**: Node.js + TypeScript, pnpm monorepo, OpenAI API, better-sqlite3, Grammy (Telegram)

## Implementation Status

### Phase A: Security ✅
Zod validation, tool guardrails, ledger hash chains, error redaction.

### Phase B: Core Expansion ✅
Cold memory (RAG), Google Calendar, Telegram, Kanban, Notes, Proactive intelligence, Memory curator.

### Phase C: Goals as First-Class Objects 🔧
Goal CRUD, Goals Board UI, Tasks system, Planner goal-awareness, Timeline tracking, Drift detection.

### Phase D: Autonomy & Tools 🔒
web_locked research, approval gates, cost dashboards, security auditor node.

## Development

```bash
pnpm install            # Install all dependencies
pnpm build              # Build all packages
pnpm dev                # Start gateway on :3100
pnpm dashboard          # Start dashboard on :5173
```

After editing `@cairn/shared`, run `pnpm build` before other packages see changes.

## Documentation

- **[truth.md](truth.md)** — Authoritative architecture spec
- **[CAIRN_INVARIANTS.md](CAIRN_INVARIANTS.md)** — Non-negotiable design rules
- **[PHASE_GATES.md](PHASE_GATES.md)** — Phase boundaries and status
- **[CAPABILITIES.md](CAPABILITIES.md)** — Tools, tiers, and interfaces

---

**Cairn is a living instrument. The system lives; agents merely work.**
