# Frequently Asked Questions

Common questions about CAIRN and how to use it.

## General Questions

### What is CAIRN?

CAIRN is a UI-first agentic AI system framework designed for complete transparency and control over AI agent behavior.

Three core principles:
1. **UI is truth** — Everything is visible
2. **System > Agent** — Agents are constrained workers
3. **No invisible work** — Every action produces evidence

See [README.md](../../README.md) or [Architecture Overview](../02-architecture/overview.md).

### How is CAIRN different from other AI frameworks?

Most AI frameworks hide what's happening. CAIRN makes everything visible:

| Aspect | Typical Frameworks | CAIRN |
|--------|-------------------|-------|
| System state | Hidden in logs | Animated in Nucleus |
| Agent actions | Silent execution | Logged in real-time |
| Costs | Unknown | Tracked and visible |
| Permissions | Implicit | Explicit graphs |
| Audit trail | Optional | Append-only hash chain |

### Is this production-ready?

The **UI is production-ready**. The backend services are planned but not yet implemented. Current status:

- ✅ React UI with all components
- ✅ Architecture specification
- 🚧 Backend services
- 🚧 API implementation

See [Implementation Status](../02-architecture/overview.md#current-state).

---

## Installation & Setup

### Do I need special hardware?

No. Requirements are minimal:

- Node.js 18+
- npm/pnpm
- 2GB RAM (development)
- Any modern browser

See [Installation Guide](../01-getting-started/installation.md).

### How do I install CAIRN?

```bash
git clone <repo> cairn
cd cairn/UI
npm install
npm run dev
```

Open http://localhost:5173

Full instructions: [Installation Guide](../01-getting-started/installation.md)

### Which package manager should I use?

Recommended: **pnpm** (faster, smaller node_modules)

Also works: **npm** or **yarn**

```bash
npm install -g pnpm
pnpm install
```

### I'm getting dependency errors

Try clearing cache:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

Or with pnpm:
```bash
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

See [Troubleshooting](../07-reference/troubleshooting.md).

---

## Development

### How do I develop components?

1. Create file in `UI/src/app/components/cairn/`
2. Define types in `types.ts`
3. Import in `App.tsx`
4. Save — dev server auto-reloads
5. Document in `docs/03-ui-components/`

Detailed: [Adding UI Components Guide](../05-guides/adding-components.md)

### How do I run the UI?

```bash
cd UI
npm run dev
```

Starts dev server on http://localhost:5173 with hot reload.

See [Running the UI](../01-getting-started/running-ui.md).

### How do I build for production?

```bash
npm run build
```

Creates optimized bundle in `dist/` directory.

### The UI shows mock data. How do I connect to a backend?

Backend services are not yet implemented. When they are, the UI will:

1. Connect via WebSocket for real-time updates
2. Make REST API calls via HTTP
3. Replace hardcoded mock data with live data

Current code is in [App.tsx](../../UI/src/app/App.tsx) where all data is mocked.

### How do I debug the UI?

1. Open browser DevTools (F12)
2. Use React DevTools extension
3. Check Console for errors
4. Use Network tab for API calls

See [Running the UI](../01-getting-started/running-ui.md#debugging).

---

## Architecture

### Why six services?

Six services provide complete separation of concerns without over-complexity:

1. **Gateway** — Input handling
2. **Orchestrator** — Execution control
3. **Executor** — Tool running
4. **Memory** — State storage
5. **Ledger** — Audit trail
6. **Scheduler** — Background jobs

Any fewer and responsibilities overlap. Any more and we lose simplicity.

See [Architecture Overview](../02-architecture/overview.md).

### How does the Orchestrator work?

The Orchestrator executes a directed graph of nodes, enforcing:

- **Permissions** — Which nodes can call which
- **Tool allowlists** — What tools each node can use
- **Memory tiers** — What data each node can access
- **Resource limits** — Timeouts, token limits

It's like a compiler for agent workflows.

See [Execution Graph](../02-architecture/execution-graph.md).

### What's the difference between the three memory tiers?

| Memory | Purpose | Persistence | Access |
|--------|---------|--------------|--------|
| **Hot** | Current context | Volatile (expires) | All agents read |
| **Warm** | Important summaries | Persistent | All agents read, curator writes |
| **Cold** | Long-term storage | Indefinite | RAG search only |

See [Memory Tiers](../02-architecture/memory-tiers.md).

### Can agents modify their own policies?

**No.** Agents can read their policies but cannot modify them.

This is a core principle: "No self-modifying policy"

Ensures:
- Policies are guaranteed not to change at runtime
- Agents cannot escalate themselves
- Security through immutability

See [Core Principles](../07-reference/core-principles.md#principle-5-no-self-modifying-policy).

---

## Components

### What's the Nucleus?

The Nucleus is a physics-based animation showing system state:

| State | Animation | Meaning |
|-------|-----------|---------|
| Idle | Gentle drift | Ready |
| Thinking | Fast spin | Planning |
| Tooling | Expansion | Executing tools |
| Waiting | Frozen | Blocked |
| Error | Jitter | Error state |

It embodies "UI is truth" — the system state IS the animation.

See [Nucleus Component](../03-ui-components/nucleus.md).

### How do components get data?

Currently (MVP):
- All data is hardcoded mock data in [App.tsx](../../UI/src/app/App.tsx)

Future (with backend):
- Data flows from backend services via API
- Real-time updates via WebSocket
- Components connected to Redux/Context stores

### Can I customize component colors?

Yes. Modify [tailwind.config.ts](../../UI/tailwind.config.ts):

```typescript
colors: {
  primary: '#your-color',
  secondary: '#your-color',
}
```

Or use Tailwind utility classes in components.

---

## Security

### Is CAIRN secure?

CAIRN has security built in:

- **Policy enforcement** — Orchestrator enforces permissions
- **Audit trail** — Ledger records everything (hash-chained)
- **Sandboxing** — Executor runs tools safely
- **Secret redaction** — API keys not logged
- **Web safety** — Prompt injection prevention

See [Security Model](../05-guides/security-model.md).

### What happens if an agent tries to escalate permissions?

The Orchestrator hard-fails and logs the violation:

1. Agent attempts forbidden action
2. Orchestrator denies (hard fail)
3. Violation logged in Ledger
4. Nucleus shows error state
5. Error logged in UI Logs

Escalation is impossible because policies are immutable.

### Can agents read each other's permissions?

Agents can read their own permissions (for debugging) but cannot read other agents' permissions.

This follows the principle: agents can READ policy, not MODIFY it.

---

## Troubleshooting

### The UI won't start

Check requirements and see [Troubleshooting](../07-reference/troubleshooting.md).

Common issues:
- Port 5173 already in use → Use different port: `npm run dev -- --port 3000`
- Node version too old → Install Node 18+
- Dependencies not installed → Run `npm install`

### TypeScript errors in my editor

Try:
1. Restart your editor
2. Check TypeScript version: `npm ls typescript`
3. Run `npm run lint` to see real errors

### The Nucleus animation is choppy

This might be:
- GPU not accelerated → Check DevTools Performance
- Too many other animations → Reduce complexity
- Browser hardware issue → Try different browser

See [Performance](../03-ui-components/overview.md#performance).

### Components don't update when I save

Your dev server might not be running. Check:

```bash
cd UI
npm run dev
```

Should show:
```
  ➜  Local:   http://localhost:5173/
```

### More issues?

See [Troubleshooting Guide](../07-reference/troubleshooting.md) or check [Glossary](glossary.md) for terminology.

---

## Contributing

### How do I contribute code?

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Write tests (if applicable)
5. Submit a PR

See [Contributing Guidelines](../06-contributing/code-style.md).

### What's the code style?

- **TypeScript** — Strict mode, no `any`
- **React** — Hooks, functional components
- **CSS** — Tailwind utilities (no inline styles)
- **Formatting** — Follow existing patterns

See [Code Style Guide](../06-contributing/code-style.md).

### How do I run tests?

Currently limited testing. Future:

```bash
npm run test        # Run tests
npm run test:watch  # Watch mode
```

See [Testing](../05-guides/testing.md) (not yet complete).

### How do I document code?

- TypeScript interfaces should have comments
- Components should have JSDoc comments
- Add user-facing docs in `docs/`
- Update README if behavior changes

### How do I report bugs?

Create a GitHub issue with:
1. Description of bug
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots if applicable

---

## Performance & Scaling

### How does CAIRN scale?

The six-service architecture scales horizontally:

- Multiple Gateway instances (load balanced)
- Multiple Orchestrator instances (state synchronized)
- Multiple Executor instances (stateless)
- Ledger can be distributed (append-only log)
- Memory tiers can use external storage

Each service is independently scalable.

### What are the performance targets?

- **Gateway** — <100ms response time
- **Orchestrator** — <1s graph execution
- **Executor** — Depends on tool (typically seconds)
- **Nucleus animation** — 60fps
- **UI responsiveness** — <100ms interaction latency

### Can I run CAIRN on the cloud?

Yes. The architecture is cloud-native:

- Stateless services (scale horizontally)
- Containerizable (Docker)
- Extensible (add new tools/nodes)
- API-first (integrate with anything)

---

## Roadmap

### What's coming next?

**Phase 1 (MVP):**
- ✅ UI prototype
- ✅ Architecture spec
- 🚧 Backend services
- 🚧 Documentation

**Phase 2:**
- Web research (web_locked node)
- Kanban integration
- Cold memory (RAG)

**Phase 3:**
- Google integrations
- Cost dashboards
- Security auditor

See [Architecture](../02-architecture/overview.md#implementation-phases).

### Can I use CAIRN today?

Yes! The UI is production-ready:

```bash
cd UI && npm run dev
```

The backend is planned but not yet implemented. For backend work, wait for Phase 1 completion or contribute.

---

## Getting Help

### Where can I find more information?

- **[Documentation Index](../00-INDEX.md)** — All docs
- **[Architecture Overview](../02-architecture/overview.md)** — System design
- **[Core Principles](../07-reference/core-principles.md)** — Foundational concepts
- **[Glossary](glossary.md)** — Term definitions
- **[truth.md](../../truth.md)** — Authoritative spec

### How do I ask a question?

1. Check [FAQ](./faq.md) (you're reading it!)
2. Check [Troubleshooting](troubleshooting.md)
3. Check [Glossary](glossary.md)
4. Search existing GitHub issues
5. Open a new GitHub issue or discussion

### How do I report security issues?

Create a **confidential** GitHub security advisory (don't post publicly).

Or email: [To be determined]

---

## Technical Questions

### What's the tech stack?

**Frontend:**
- React 18.3.1
- TypeScript
- Vite
- Tailwind CSS 4.1.12
- Framer Motion

**Backend (planned):**
- Node.js
- TypeScript
- LangGraph
- Vector DB (for RAG)

### How do I extend CAIRN?

- **New UI components** — See [Adding UI Components](../05-guides/adding-components.md)
- **New Orchestrator nodes** — See [Creating Nodes](../05-guides/creating-nodes.md) (planned)
- **New tools** — See [Implementing Tools](../05-guides/implementing-tools.md) (planned)

### Is CAIRN open source?

Yes! [License to be determined]

### Can I use CAIRN in production?

The UI is production-ready. The backend is planned but not yet implemented.

For production use, wait for Phase 1 completion or build the backend yourself following [truth.md](../../truth.md).

---

Still have questions? See [Glossary](glossary.md) for terminology or open a GitHub issue.
