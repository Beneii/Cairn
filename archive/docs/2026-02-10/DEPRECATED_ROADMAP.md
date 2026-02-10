# CAIRN Roadmap: Superior Capability Stack (Secure, Local-First, 24/7)

## Non-Negotiable Design Goals

* **Local-first, single-user**: everything optimized for you, not a marketplace.
* **Secure by default**: no arbitrary code execution, no "skills" that ship opaque scripts.
* **24/7 reliability**: crash-safe, self-healing, observable, low-cost inference compatible.
* **Auditable autonomy**: every action is attributable, replayable, reversible where possible.
* **Typed tools only**: the model never gets "run shell / run JS / eval" privileges.
* **Hostile input model**: every external page/email/PDF is treated as prompt-injection.

---

## The Cairn Skill Model (No Marketplace, Still Modular)

Cairn doesn't have "skills." It has:

1. **Capabilities** (typed tool interfaces + permission scopes)
2. **Playbooks** (declarative workflows; versioned, testable, replayable)
3. **Policies** (hard gates; approvals; rate limits; domain allowlists; data boundaries)
4. **Adapters** (first-party integrations; stable; signed; pinned versions)

A "Fiverr account creation" is **not** a skill. It's:

* Browser capability + Identity vault + Email capability + Approval policy + Playbook.

---

## Security Architecture

### Permission Tiers (hard enforcement)

* **Tier 0 (Read-only)**: search, fetch, parse, summarize, extract.
* **Tier 1 (Write local)**: create notes, update tasks, write files inside a sandbox folder.
* **Tier 2 (External write draft)**: draft emails/messages/posts/forms, never send/submit.
* **Tier 3 (External commit)**: send/submit/post/purchase/delete. Always requires explicit approval token unless pre-authorized with strict constraints.

### Hard Rules

* **No raw shell execution from the model**. Ever.
* **No raw browser JS injection from the model**. Ever.
* **No unscoped secrets**. Secrets are leased per action, time-limited, domain-limited.
* **No cross-domain navigation without allowlist**.
* **No clipboard scraping / browser password manager access**.
* **No "download & execute"**. All downloads land in quarantine with hashes and scanning hooks.

### Prompt Injection Defense

* External text is ingested into a **neutralized context** (stripped instructions, tool-call bait removed, suspicious patterns flagged).
* Browser extraction returns **data-only** (structured fields), never "instructions".
* Model outputs are validated by:

  * JSON schema validation
  * policy engine (permissions, domain, rate limit)
  * heuristic + allowlist checks
  * optional second-model verifier (cheap local model)

### Audit & Ledger

Every tool call records:

* request (structured)
* policy decision (allow/deny + reason)
* execution trace (timing, domain, selectors)
* outcome (structured result)
* artifacts (screenshots, HTML snapshot, diff)
* reversible action info (where possible)

---

## Core Capabilities (Build These First, Everything Else Rides On Them)

### C0 -- Identity & Secrets Vault (Week 1)

**Purpose:** make automation possible without turning into a credential-leaking clown show.

* Encrypted local vault (age/sops/OS keychain fallback)
* Secret leasing: `lease_secret(domain, purpose, ttl)`
* Account registry: accounts have roles, domains, cooldowns, and risk levels
* Redaction: secrets never appear in logs, prompts, screenshots (masking layer)
* Rotation playbooks: rotate passwords, revoke tokens, re-auth flows
* "Break glass" admin mode: manual unlock + timeboxed elevated privileges

Deliverables:

* `vault/` package + CLI: `cairn vault add/get/lease/revoke/rotate`
* Policy hooks: deny tools if secrets would be exposed.

### C1 -- Tool Runtime + Policy Engine (Week 1-2)

**Purpose:** guarantee typed tools, enforce scopes, stop chaos.

* Tool registry with JSON schema I/O
* Policy engine:

  * tier gates
  * allowlists (domains, file paths, APIs)
  * per-tool rate limiting
  * daily "interruption budget"
  * approval requirements (token-based)
* Deterministic execution wrappers (timeouts, retries, idempotency keys)
* Sandbox runner for any "code-like" action (container, no network by default)

Deliverables:

* `@cairn/policy`, `@cairn/tools`, `@cairn/runtime`
* Golden tests: tool call is rejected if schema mismatch or scope breach.

### C2 -- Observability & Self-Healing (Week 2)

**Purpose:** 24/7 means it must diagnose itself.

* Health endpoints per service
* Structured logs + trace IDs
* Metrics: success rate, latency, approvals pending, budget used
* Watchdog: restarts services, escalates on repeated failure
* Crash-safe queues: no "lost tasks"
* Snapshot backups for critical state (vault excluded or separately encrypted)

Deliverables:

* `@cairn/telemetry` + dashboard page: Diagnostics, Ledger, Queue, Alerts

---

## The "Useful" Layer (What You Actually Want It Doing)

### C3 -- Task / Goals / Schedules (Week 2-3)

**Purpose:** the always-on assistant backbone.

* Goals: long-term, measurable, with review cadence
* Plans: daily/weekly planning blocks
* Task store: status, deadlines, dependencies
* Scheduler: cron + event-driven triggers
* Review loops:

  * morning briefing
  * evening wrap
  * weekly review
  * "stale goal" nudges

Security:

* Tier 0/1 only by default.
* No external actions triggered from goals without approval policy.

Deliverables:

* `@cairn/goals`, `@cairn/scheduler`, `@cairn/tasks`

### C4 -- Comms (Email/Calendar/Messaging) as Draft-First (Week 3-4)

**Purpose:** automate your life without accidentally sending garbage.

* Gmail: read, label, summarize, draft replies
* Calendar: propose schedules, detect conflicts, draft events
* Messaging adapters: Telegram/Discord/iOS app endpoints

Security:

* External sends are Tier 3 + approval token.
* Drafts are Tier 2: always visible before commit.

Deliverables:

* `@cairn/integrations/gmail`, `gcal`, `discord/telegram`, `approval inbox UI`

### C5 -- Research + Ingestion (Week 4)

**Purpose:** turn the web into structured knowledge without injection.

* Web fetcher (read-only)
* PDF/doc parser (read-only)
* Summarize -> extract entities -> store in memory
* Source attribution stored alongside facts
* Dedup + confidence scoring
* "What changed?" diffs for watched pages

Security:

* Fetcher has strict network allowlist.
* All retrieved content is untrusted.

Deliverables:

* `@cairn/research` + "Watchlist" + "Briefings"

---

## Browser Operator (The Hard Part -- Build it Like a Weapon With a Safety On)

### C6 -- Browser Operator v1 (Week 5-6)

**Purpose:** safe web usage that doesn't devolve into raw clickbot spam.

#### Browser as a typed action API

No freeform "click around." Model submits intents like:

* `navigate(url)`
* `wait_for(selector|text)`
* `extract(fields: {name: selector...})`
* `fill_form(fields)`
* `click(selector)`
* `submit()`
* `screenshot()`
* `download()` (goes to quarantine)
* `set_cookie()` (only from vault lease + domain-bound)
* `use_session(profile_id)`

#### Constraints (enforced, not suggested)

* Domain allowlist per playbook
* Max actions/minute + randomized pacing
* Mandatory screenshot+HTML snapshot before Tier 3 actions
* Selector allowlist per domain/playbook (prevents injection via arbitrary selectors)
* No typing secrets unless tool leases secret for that domain + current URL matches
* No clipboard, no password manager hooks, no reading autofill values

Deliverables:

* `@cairn/browser` built on Playwright (headful by default)
* Browser profiles stored encrypted, session cookies isolated per account
* "Human-in-the-loop checkpoints" step type

### C7 -- Browser Operator v2: Semi-Autonomous Account Flows (Week 6-8)

**Purpose:** account creation / onboarding without pretending CAPTCHAs don't exist.

Playbook pattern:

1. propose identity + username + email alias
2. generate credentials in vault
3. run signup steps until verification/captcha/MFA
4. pause and request human action
5. resume after confirmation

Key feature: **resume tokens** (state machine persists across restarts)

Deliverables:

* Flow runner with `PAUSE_REQUIRED` states
* UI: "Pending Human Step" with screenshot + exact instruction
* Email verification handler (read-only until approved)

---

## "Money Work" Without Becoming a Fraud Machine

### C8 -- Client Work Pipeline (Week 8-10)

**Purpose:** let Cairn operate as a production assistant for real deliverables.

* Lead intake (forms, email parsing)
* Requirement extraction + clarification drafts
* Proposal drafting (structured templates)
* Asset generation (docs, invoices, project plans)
* Work tracking + time logs + cost tracking
* Packaging outputs (zip, docx, pdf) locally

Security:

* No sending proposals/messages without approval.
* All "client data" goes into a separate encrypted workspace with strict boundaries.

Deliverables:

* "Workspaces": `workspace_id` partitions memory/files/tools
* "Client templates" library (local)

### C9 -- Safe Posting / Messaging (Week 10-12)

**Purpose:** social/content automation without accidental reputational self-harm.

* Draft generator + style rules
* Policy: banned topics, tone constraints, link safety
* Staging queue: draft -> review -> schedule -> publish

Security:

* Publishing is Tier 3 always.
* Rate limits + cooldowns + per-platform caps.

Deliverables:

* "Outbox" UI with approvals, schedules, and audit trail.

---

## Hardening Phases

### H1 -- Verification Model / Rules Engine (Parallel, Week 2+)

**Purpose:** the model lies; your system shouldn't.

* Second-pass verifier for risky actions:

  * checks policy compliance
  * checks hallucination risk (e.g., "did we actually see that element?")
  * checks domain correctness
* Rule engine for deterministic constraints:

  * "never submit payment forms"
  * "never message more than N/day"
  * "only operate on domains X/Y/Z"

Deliverables:

* `@cairn/verifier` with pluggable validators
* "why denied" explanations in UI

### H2 -- Secure Execution Sandbox (Week 6+)

**Purpose:** run scripts/tools without turning your server into a malware zoo.

* Containerized execution with:

  * read-only mounts
  * limited CPU/mem
  * no network by default
  * explicit egress allowlist
* Artifact capture
* Deterministic outputs

Deliverables:

* `@cairn/executor` hardened profiles: `read-only`, `net-read`, `build`, `browser`

### H3 -- Backups + Reproducibility (Week 8+)

**Purpose:** 24/7 systems rot. You need rollback.

* Snapshot of state stores (tasks/goals/ledger/config)
* Versioned playbooks
* Migration tooling for schema upgrades
* Disaster recovery doc + automated restore test

Deliverables:

* `cairn backup create/restore/verify`

### H4 -- Cost Control + Model Routing (Week 1+)

**Purpose:** "very little cost" means aggressive routing.

* Router: cheap local model for drafting + extraction, stronger model for complex planning
* Per-task budget caps
* Token accounting in ledger
* "Stop loss" mode: if cost spikes, degrade gracefully

Deliverables:

* `@cairn/router` + ledger cost pages

---

## Concrete Capability Backlog (What To Implement as Playbooks)

### Tier 0/1 Playbooks (Safe, High ROI)

* Morning briefing: calendar + tasks + deadlines + weather (read-only)
* Evening wrap: capture notes, roll tasks, tag wins/issues
* Weekly review: goals progress, stale tasks, next week plan
* Research digest: watched sources summary + changes
* File organizer: sort downloads into projects with review queue
* Invoice/receipt extraction: parse PDFs -> structured records (no sending)

### Tier 2 Playbooks (Draft-First)

* Draft replies to common email types (work/admin)
* Draft Fiverr/Upwork gig descriptions and profile text (no posting)
* Draft proposals and SOWs from templates
* Draft social content batches with constraints

### Tier 3 Playbooks (Commit With Approval)

* Send approved email replies
* Schedule approved calendar events
* Submit approved web forms (non-payment)
* Publish approved posts
* Create accounts (semi-autonomous with pause points)

---

## Implementation Order

### Phase A -- Foundations (Weeks 1-2)

* Vault + secret leasing
* Tool runtime + policy engine
* Ledger + telemetry + watchdog
* Minimal UI for approvals + diagnostics

### Phase B -- Personal Assistant Core (Weeks 2-4)

* Tasks/goals/scheduler
* Gmail/Calendar draft-first adapters
* Research ingestion + watchlists

### Phase C -- Browser Operator (Weeks 5-8)

* Browser v1 typed actions + audit artifacts
* Browser v2 state-machine flows + pause/resume
* Domain/selector allowlists + throttling

### Phase D -- Work Pipeline (Weeks 8-12)

* Workspaces (client partitioning)
* Proposal/content drafting systems
* Outbox approvals + scheduling

### Phase E -- Hardening & Scale (Ongoing)

* Verifier model + deterministic rules
* Sandboxed executor profiles
* Backups/restore/migrations
* Cost router + degradation modes

---

## Acceptance Tests

### Security Tests

* Attempt prompt-injection in fetched webpage -> tool calls must be denied.
* Attempt cross-domain navigation during a playbook -> denied with reason.
* Attempt to log secrets -> redacted, blocked, or both.
* Attempt to submit a payment form -> hard deny.
* Attempt to execute arbitrary shell/js -> impossible (no tool exists).

### Reliability Tests

* Kill service mid-playbook -> state resumes safely.
* Network outage -> retries with backoff, no spam loops.
* Browser crash -> session recovers, playbook pauses safely.

### Usefulness Tests

* Can produce a daily plan from calendar + tasks automatically.
* Can draft and queue communications with minimal edits.
* Can run web flows to a pause point reliably with audit artifacts.

---

## Minimal Typed Tool Set (Core)

* `vault.lease_secret(domain, purpose, ttl)`
* `policy.request_approval(action_id, summary, artifacts)`
* `ledger.record(event)`
* `tasks.create/update/query`
* `goals.create/update/review`
* `schedule.set_trigger(playbook_id, cron/event)`
* `gmail.search/read/draft_reply`
* `calendar.query/propose_event/draft_event`
* `web.fetch(url) -> sanitized_text + metadata`
* `docs.parse_pdf(file) -> structured`
* `browser.navigate/wait/extract/fill/click/submit/screenshot/download`
* `executor.run(profile, inputs) -> artifacts`

Everything else is built from these, not by adding "skills."
