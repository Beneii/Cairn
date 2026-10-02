# Cairn

Single-user, local-first personal AI orchestration system. Explicit service boundaries, registered capabilities only, and fail-loud behaviour over silent fallbacks.

Companion supervisor: **[Menhir](https://github.com/Beneii/Menhir)** (private) watches Cairn processes/logs and can propose repairs. Menhir is not required to run the core gateway demo.

## What runs today

From the monorepo apps, packages, and `documents/` identity docs (implemented vs roadmap is split on purpose):

- **Gateway** (`apps/gateway`): TypeScript Node service; production entry `apps/gateway/dist/index.js` after `pnpm build`
- **Dashboard** (`apps/dashboard`): Vite UI for operator control, local/remote mode, WebSocket to gateway
- **Mobile companion** (`apps/mobile`): React Native / Expo client with pairing hooks
- **Orchestration packages:** planner/executor paths, skill registry, policy gates, ledger/observability streams
- **Integrations (optional, env-gated):** Google Calendar/Gmail OAuth helpers, Telegram bot tokens, vision attachments via LLM
- **Local LLM option:** Ollama support toggled from dashboard (`LOCAL_MODE_ENABLED` style flags; see `.env.example`)
- **Setup path:** `./setup.sh` on Debian/Ubuntu (Node 20+, pnpm, optional Ollama), then `pnpm build` / `pnpm start`

Deep architecture and capability contracts live under `documents/` (start at `documents/01_CORE_IDENTITY.md`). Prefer those files over assumptions in this README.

## Stack

- Monorepo: pnpm + Turborepo
- Gateway / packages: TypeScript, Node >= 20
- Dashboard: Vite + React
- Mobile: React Native (Expo-style layout under `apps/mobile`)
- Optional Python helper scripts under `scripts/` (provider checks, failover simulations)
- SQLite / local data dirs for runtime state (gitignored `data/`)

## Quick start

```bash
git clone https://github.com/Beneii/Cairn.git
cd Cairn
cp .env.example .env
# set OPENAI_API_KEY (or enable local/Ollama mode per docs)
pnpm install
pnpm build
pnpm start
# gateway default: http://localhost:3100
```

Dev (all packages in parallel):

```bash
pnpm dev
```

Debian/Ubuntu bootstrap:

```bash
./setup.sh
```

## Screenshots

Add operator UI captures under `docs/screenshots/` when available.

```
docs/screenshots/dashboard.png
docs/screenshots/gateway-health.png
```

*(Placeholders until screenshots are added.)*

## What Cairn is not

- Not multi-tenant SaaS
- Not an unbounded autonomous agent
- Not a claim that every roadmap item in `documents/05_ROADMAP.md` is shipped

## Security / secrets

- Copy `.env.example` to `.env`. Never commit real keys.
- Runtime browser profiles, cookies, and local data dirs are gitignored (`debug_profile/`, `data/`).
- If you forked an older private history, scrub browser profile blobs before publishing (see ops scrub notes).

## Menhir companion

Menhir is a separate Python supervisor (pytest-covered watchdog, circuit breaker, repair providers). Keep it private until its own scrub (local absolute paths in `config.toml`, auth under `~/.menhir/`). Link it here once public.

## Suggested topics

`typescript`, `agents`, `turborepo`, `local-first`, `fastapi-adjacent`, `orchestration`, `react`

## License

Personal portfolio project.
