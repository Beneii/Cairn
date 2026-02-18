# Evolution Log

## 2026-02-18 Iteration 22

### Change summary
- Extended `orchestrator_recent_traces` compact entries to include `skillId` (previously only `{success, durationMs}`).
- Upgraded supervisor `collectSkillReliabilitySnapshot` to compute **per-skill** failure rates rather than a raw failure count: `lowReliabilitySkills` now reports the number of **distinct failing skill IDs** in the rolling 300-entry window, with graceful fallback for legacy traces that lack `skillId`.
- This closes a semantic gap: the `skill_reliability_drop` supervisor trigger previously detected any increase in total failure events (which could be caused by repeated invocations of one skill), but now triggers only when the count of *distinct* unreliable skills increases.

### Files modified
- `packages/orchestrator/src/orchestrator.ts`
- `packages/scheduler/src/scheduler.ts`
- `documents/evolution-log.md`

### Risk introduced
- Low: `lowReliabilitySkills` meaning changed (distinct failing skill IDs vs raw failure count) — existing warm-memory values are backward-compatible since both are non-negative integers.
- Low: `orchestrator_recent_traces` warm-memory schema gains an optional `skillId` field; old entries without `skillId` are handled by the legacy fallback path.

### Metrics before/after
- Before: `lowReliabilitySkills` = raw count of failures in window (e.g. 10 failures from one bad skill → 10).
- After: `lowReliabilitySkills` = distinct failing skill IDs (e.g. 10 failures from one bad skill → 1; 3 different failing skills → 3).
- Supervisor trigger accuracy: `skill_reliability_drop` now fires when a **new skill** becomes unreliable, not on every repeated failure of an already-failing skill.
- Validation status:
  - `pnpm lint` ✅ (17/17 tasks)
  - `pnpm test` ✅ (1/1 tasks)
  - `pnpm build` ✅ (17/17 tasks)

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert in `packages/orchestrator/src/orchestrator.ts`: remove `skillId: s.skillId,` from the `stepTraces` map.
3. And in `packages/scheduler/src/scheduler.ts`: restore the original `collectSkillReliabilitySnapshot` body using `traces.filter((t) => !t.success).length` for `lowReliabilitySkills`.
4. Re-run: `pnpm lint && pnpm test && pnpm build`


## 2026-02-18 Iteration 21

### Change summary
- Added memory/reflection pipeline scaffold in `orchestrator-v2` finish path with explicit hot/warm/cold tier hooks.
- Each completed pipeline now records a structured reflection artifact to hot working memory (`working:last_reflection`) and appends to warm episodic journal (`reflection_journal`, capped).
- Added compact execution-trace retention (`orchestrator_recent_traces`) for supervisor/perf awareness and queued high-signal reflections (failures/high latency/high cost) for curator promotion into cold memory.

### Files modified
- `packages/orchestrator/src/orchestrator.ts`
- `documents/evolution-log.md`

### Risk introduced
- Low: reflection journaling adds bounded warm-memory write pressure per message (caps in place).
- Low: promotion trigger thresholds (latency/cost/status) are heuristic and may need tuning for noisy workloads.

### Metrics before/after
- Reflection persistence tiers: `none` -> `hot + warm + cold-promotion-hook`.
- Supervisor-compatible trace availability: `none` -> `rolling warm trace window (300 step traces)`.
- High-signal archival path: `manual/implicit` -> `automatic queued promotion for failure/high-latency/high-cost runs`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert in `orchestrator.ts`:
   - remove `captureReflection(...)` helper and `finishPipeline` hook,
   - restore original memory imports.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 20

### Change summary
- Extended planner/executor governance to support hybrid worker classes (`light`, `heavy`, `default`) with explicit heavy cap enforcement (`maxParallelHeavyWorkers`, max 3).
- Added autonomy-confidence policy controls in plan governance (`minConfidenceForAutonomy`, `createHumanTicketOnFailure`) and propagated them into execution.
- Implemented human-decision ticketing in executor for low-confidence successes and retry/escalation failures, persisted in warm memory (`human_decision_tickets`).
- Updated shared plan types to carry heavy worker/cap + confidence/ticket governance fields.

### Files modified
- `packages/shared/src/types.ts`
- `packages/shared/src/types.d.ts`
- `packages/orchestrator/src/nodes/planner-v2.ts`
- `packages/orchestrator/src/nodes/executor-v2.ts`
- `documents/evolution-log.md`

### Risk introduced
- Medium: heavy worker parallelism introduces a second concurrency lane; incorrect classification of steps as `heavy` can increase contention.
- Low: human-ticket creation on low confidence may increase operator queue volume until confidence hints are tuned.

### Metrics before/after
- Worker model: `default + light` -> `default + light + heavy (capped)`.
- Governance surface: `parallel-light/retries/escalation` -> `+ heavy cap + min confidence + ticket-on-failure`.
- Failure handling: `retries + optional escalation` -> `retries/escalation + persistent human decision tickets`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert:
   - shared `PlanGovernance`/`PlanStep` additions,
   - planner schema/prompt/governance normalization fields,
   - executor heavy-group logic + ticket creation hooks.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 19

### Change summary
- Upgraded scheduler heartbeat into a lightweight persistent supervisor loop with trigger-based introspection.
- Added queue/failure/stall/config-drift/perf snapshot evaluation with cooldown-based periodic suppression to keep awareness compute-efficient.
- Persisted supervisor state and alert history to warm memory (`supervisor_state`, `supervisor_alerts`) and emitted structured log/ledger entries only on meaningful triggers.

### Files modified
- `packages/scheduler/src/scheduler.ts`
- `documents/evolution-log.md`

### Risk introduced
- Low: trigger heuristics (queue>=5, reliability/failure deltas) may need environment-specific calibration.
- Low: config fingerprint currently tracks selected env keys; additional drift dimensions may be added later.

### Metrics before/after
- Supervisor introspection mode: `none` -> `trigger-based (startup, stalls, failure growth, queue growth, reliability drop, config drift)`.
- Alert persistence: `none` -> `warm-memory ring buffer (50 alerts)`.
- Runtime overhead: `constant deep polling` -> `heartbeat piggyback + cooldown-gated summaries`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert in `scheduler.ts`:
   - remove supervisor interfaces/helpers and `runSupervisorIntrospection` call,
   - restore prior heartbeat-only scheduler flow.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 18

### Change summary
- Improved control-center chat responsiveness by extracting the transcript renderer into a memoized `MessageFeed` component, so composer keystrokes and activity timer ticks no longer re-render the full message history.
- Isolated elapsed-time updates into a dedicated `ChatActivityBanner` state loop; active-run second ticks now update only the banner instead of the entire chat transcript tree.
- Preserved existing chat UX (auto-scroll, tool output expansion, attachments, delivery states) while reducing render churn in the hottest interaction path.

### Files modified
- `apps/dashboard/src/app/components/cairn/Chat.tsx`
- `documents/evolution-log.md`

### Risk introduced
- Low: memoization benefits depend on parent passing stable `messages` references; if upstream starts cloning arrays each render, gains are reduced (behavior remains correct).
- Low: `MessageFeed` now owns its own scroll anchor/effect; future transcript layout changes should keep the feed mounted to preserve expected auto-scroll behavior.

### Metrics before/after
- Transcript re-render frequency while typing in composer (no new messages): `every keystroke re-mapped entire message list` -> `0 transcript re-renders (memoized feed short-circuits)`.
- Active-run elapsed timer impact (1 tick/sec during pending runs): `entire Chat component tree re-rendered each second` -> `banner-only re-render each second`.
- Render isolation structure: `single monolithic Chat render path` -> `separated hot paths (MessageFeed, ChatActivityBanner, composer)`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert in `Chat.tsx`:
   - inline `MessageFeed` back into `Chat`,
   - move activity timer state (`now` interval) back into `Chat`,
   - remove memoized feed boundary.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 17

### Change summary
- Improved orchestration planning consistency by introducing a normalized `getMaxParallelLightWorkers()` helper in `planner-v2` and reusing it in both planner prompt constraints and runtime governance clamping.
- Removed mismatch where environment-configured worker caps were reflected in prompt text but not always respected by governance defaults/clamps during plan normalization.
- Tightened parallel-light execution safety: planner governance now cannot exceed the configured `CAIRN_MAX_LIGHT_WORKERS` ceiling after parsing.

### Files modified
- `packages/orchestrator/src/nodes/planner-v2.ts`
- `documents/evolution-log.md`

### Risk introduced
- Low: deployments that intentionally expected planner governance to float above `CAIRN_MAX_LIGHT_WORKERS` via model output will now be hard-capped to the configured ceiling.
- Low: invalid `CAIRN_MAX_LIGHT_WORKERS` values now normalize to fallback default `4`.

### Metrics before/after
- Parallel worker cap source-of-truth in planner: `duplicated/inconsistent (prompt env cap, runtime clamp fixed to 10/default 4)` -> `single normalized helper used for both prompt + runtime enforcement`.
- Governance clamp behavior when env cap < 10 (e.g., `CAIRN_MAX_LIGHT_WORKERS=2`): `planner could still normalize to >2` -> `always <=2`.
- Configuration robustness for malformed env values: `implicit parse behavior` -> `explicit NaN fallback to 4 and clamp 1..10`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert in `planner-v2.ts`:
   - remove `getMaxParallelLightWorkers()` helper,
   - restore inline env parse in prompt builder,
   - restore governance normalization to fixed `1..10` clamp with default `4`.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 16

### Change summary
- Improved control-center home-view responsiveness by decoupling `NucleusSection` from the full `useCairn()` object and passing only the state it actually renders (`connected`, `nucleusState`, `subAgents`, and `chatActivity`).
- Wrapped `NucleusSection` in `React.memo` so high-frequency dashboard updates (logs, archive data, settings payload churn) no longer force unnecessary re-render work in the nucleus/header region when its inputs are unchanged.
- Preserved existing UX and control behavior while reducing prop-churn in the hottest home-layout branch.

### Files modified
- `apps/dashboard/src/app/App.tsx`
- `documents/evolution-log.md`

### Risk introduced
- Low: memoization relies on stable prop identity for arrays like `subAgents`; if backend emits semantically-identical arrays with new references each tick, rerender reduction is partially reduced (behavior remains correct).
- Low: stricter prop typing in `NucleusSection` increases coupling to `SubAgent`/`NucleusState` type exports.

### Metrics before/after
- `NucleusSection` prop surface: `1 broad object (entire useCairn return)` -> `4 targeted data props + existing UI callbacks/style props`.
- Home-view unnecessary rerender trigger paths for nucleus/header: `any change in useCairn object identity` -> `only when nucleus-relevant props actually change`.
- Expected effect under noisy log stream + unchanged nucleus state: `nucleus/header rerenders on each parent update` -> `memo short-circuits most updates` (qualitative responsiveness gain, lower paint/churn in top panel).
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert in `App.tsx`:
   - restore `NucleusSection` to accept `cairn: ReturnType<typeof useCairn>` and remove `memo(...)` wrapper,
   - restore both call sites to pass `cairn={cairn}`.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 15

### Change summary
- Hardened System Control Center action responsiveness by introducing explicit "awaiting acknowledgement" state for Update Pipeline and Branch Builder triggers.
- Added optimistic request-locking on update/builder actions so repeated clicks cannot enqueue duplicate runs while waiting for first backend acknowledgement.
- Added 8s acknowledgement timeout handling that downgrades stuck pending state to a clear delayed-ack message and re-enables retry instead of leaving controls ambiguous.

### Files modified
- `apps/dashboard/src/app/components/cairn/pages/SystemPage.tsx`
- `documents/evolution-log.md`

### Risk introduced
- Low: a slow-but-valid acknowledgement arriving after the 8s timeout can race with user retry and create duplicated backend requests in rare high-latency conditions.
- Low: timeout duration is static (8s) and may need tuning for slower remote environments.

### Metrics before/after
- Duplicate trigger guard while waiting for first ack: `none (unbounded repeat clicks)` -> `single in-flight request per action until ack/timeout`.
- Action feedback granularity (update/builder): `2 states (ready/in progress)` -> `3 states (ready/sending/in progress)`.
- Stuck pending recovery path: `indefinite waiting copy` -> `auto-timeout at 8s + explicit delayed-ack notice + retry re-enabled`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert in `SystemPage.tsx`:
   - remove `ackTimeoutAction` state + timeout `useEffect`,
   - restore update/builder button disabled + label logic to busy-only behavior,
   - remove delayed-ack status copy in the aria-live message block.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 14

### Change summary
- Reduced control-center log-stream UI churn by introducing buffered websocket ingestion in `useCairn`: `log:entry` events now enqueue and flush in short batches instead of forcing one React state update per message.
- Added bounded log flush cadence (`LOG_FLUSH_INTERVAL_MS = 120`) to preserve near-live operator visibility while preventing high-frequency render storms during noisy runtime/tool output.
- Preserved existing memory safety semantics (`MAX_LOG_BUFFER = 1000` and dropped-log diagnostics) while making the hot path cheaper under sustained throughput.

### Files modified
- `apps/dashboard/src/app/hooks/useCairn.ts`
- `documents/evolution-log.md`

### Risk introduced
- Low: logs are now rendered in micro-batches (up to ~120ms delay) rather than instantly per-event; this trades tiny latency for smoother responsiveness.
- Low: queued log entries are intentionally discarded on dashboard unmount to avoid post-unmount state updates.

### Metrics before/after
- Log-driven state updates: `1 React state update per websocket log event` -> `<= ~8-9 updates/sec max flush cadence` under heavy streams.
- Worst-case UI update amplification (example 100 log events/sec): `~100 state updates/sec` -> `~8-9 batched updates/sec` (~91% reduction in update frequency).
- Log retention + diagnostics: `unchanged` (`MAX_LOG_BUFFER=1000`, dropped counter still tracked).
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert:
   - remove `LOG_FLUSH_INTERVAL_MS`, pending queue refs, and enqueue/flush helpers in `useCairn.ts`,
   - restore direct `setState` handling in `case "log:entry"`.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 13

### Change summary
- Hardened control-center responsiveness under long-running sessions by enforcing bounded in-memory buffers in the dashboard websocket state layer.
- Capped chat history retained in live React state to the latest 300 messages, preventing gradual render cost/memory creep during extended operator sessions.
- Capped log buffer retained in live state to the latest 1000 entries and surfaced cumulative trim count in the Logs panel (`trimmed N`) so operators understand why very old events are absent.
- Added no-op guards for duplicate `builder:status` / `builder:progress` websocket events to avoid needless re-renders during noisy status streaming.

### Files modified
- `apps/dashboard/src/app/hooks/useCairn.ts`
- `apps/dashboard/src/app/components/cairn/Logs.tsx`
- `apps/dashboard/src/app/App.tsx`
- `documents/evolution-log.md`

### Risk introduced
- Low: intentionally trimmed client-side history means extremely old chat/log context is no longer kept in hot UI memory (backend/archive sources remain authoritative).
- Low: duplicate-event suppression for builder progress assumes identical payloads are semantically redundant.

### Metrics before/after
- Live dashboard log state growth: `unbounded` -> `hard-capped at 1000 entries` (worst-case list churn/memory now bounded).
- Live dashboard chat state growth: `unbounded` -> `hard-capped at 300 messages`.
- Builder event rerender pressure: `every repeated status/progress payload triggered state update` -> `identical payloads short-circuit (0 UI update for duplicates)`.
- Operator clarity on retention: `no visibility into dropped logs` -> `explicit trimmed counter in Logs header`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert:
   - remove `MAX_CHAT_HISTORY` / `MAX_LOG_BUFFER` capping and dropped-log diagnostics in `useCairn.ts`,
   - remove `droppedCount` prop/UI from `Logs.tsx`,
   - remove `droppedCount` wiring from `App.tsx`.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 12

### Change summary
- Added optimistic chat send in the Home control-center Chat panel: outgoing user messages now render instantly with delivery state (`queued` -> `sent`) instead of waiting for websocket round-trip echo.
- Added explicit in-flight response tracking (`chatActivity`) shared across Chat + Home header so users always see whether Cairn is sending, thinking, or failed, including pending-count and elapsed wait time.
- Added explicit send affordance + offline guardrail: visible Send button with connected-state disable and disconnected warning to reduce uncertainty when actions cannot execute.

### Files modified
- `apps/dashboard/src/app/hooks/useCairn.ts`
- `apps/dashboard/src/app/components/cairn/Chat.tsx`
- `apps/dashboard/src/app/components/cairn/types.ts`
- `apps/dashboard/src/app/App.tsx`
- `documents/evolution-log.md`

### Risk introduced
- Medium: optimistic-message reconciliation currently matches by text + attachment count; duplicate rapid sends with identical payloads could reconcile to the wrong local placeholder.
- Low: global chat activity clears on first assistant response event; in rare multi-reply/tool-stream flows, activity may resolve slightly early.

### Metrics before/after
- Time-to-visible user feedback after Enter: `network-dependent echo` -> `immediate local render (~0ms UI delay)`.
- Progress-state visibility during long model/tool runs: `implicit/none` -> `explicit phase + pending count + elapsed seconds` in both Chat and Home header.
- Failed-send clarity while disconnected: `silent/console-only` -> `inline failed status + composer warning + disabled Send`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert:
   - remove optimistic + `chatActivity` handling in `useCairn.ts`,
   - restore prior passive Chat composer/UI in `Chat.tsx`,
   - remove `ChatActivity`/delivery metadata in `types.ts`,
   - remove Home header chat-activity wiring in `App.tsx`.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 11

### Change summary
- Added a global command palette (`Ctrl/Cmd + K`) with high-frequency control-center actions (view jumps, direct System tab jump, local mode toggle, builder run, update/restart) so operators can execute top workflows without menu traversal.
- Added persistent Settings tab memory (`cairn_settings_tab`) and wired deep-linking into Settings so the UI reopens where the user last worked and quick actions can land directly on target controls.
- Reworked System tab into a consolidated Control Center strip that surfaces gateway health + update + builder status/actions in a single above-the-fold section, removing duplicated action blocks lower on the page.

### Files modified
- `apps/dashboard/src/app/App.tsx`
- `apps/dashboard/src/app/components/cairn/CommandPalette.tsx` (new)
- `apps/dashboard/src/app/components/cairn/NavBar.tsx`
- `apps/dashboard/src/app/components/cairn/pages/SettingsPage.tsx`
- `apps/dashboard/src/app/components/cairn/pages/SystemPage.tsx`
- `documents/evolution-log.md`

### Risk introduced
- Low: command palette introduces a global keyboard handler (`Ctrl/Cmd+K`); mitigated by explicit close behavior (Escape/click-outside) and no destructive defaults.
- Low: Settings tab persistence can restore users into non-general tabs; mitigated by allowing explicit quick-action tab overrides.
- Low: consolidating update/builder controls changes spatial muscle memory; mitigated by keeping labels and action semantics unchanged.

### Metrics before/after
- Navigation to System controls: `Home -> Settings -> System tab` (3 interactions) -> `Ctrl/Cmd+K + Enter` (2 interactions) or one-click "Quick Actions" button + select.
- Triggering update/builder from non-Settings views: `4-5 interactions` (navigate + tab + action) -> `2 interactions` via command palette.
- System control scan path: `3 separate sections (Connection + Updates + Builder)` -> `1 consolidated Control Center strip` for core run-state + actions.
- Settings context persistence: `always reset to General tab` -> `restores last active tab across sessions + supports deep-link tab targeting`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert:
   - remove `CommandPalette.tsx` and `App.tsx` palette wiring,
   - remove `NavBar.tsx` quick-actions trigger button,
   - restore non-persistent tab state in `SettingsPage.tsx`,
   - restore previous standalone Updates/Builder sections in `SystemPage.tsx`.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 10

### Change summary
- Added immediate action acknowledgement in System settings (`pendingAction` live status) for local mode toggles, update requests, and builder triggers so users see instant confirmation before backend status events arrive.
- Reduced control-center Settings churn by replacing per-keystroke numeric websocket writes with commit-based fields (Enter/blur) plus explicit "Saved / Press Enter or blur" state hints.
- Optimized logs panel rendering by memoizing filtered data, capping visible rows to latest 200 entries, and only autoscrolling when user is already near bottom.
- Improved keyboard/focus responsiveness for primary dashboard navigation with ArrowLeft/ArrowRight/Home/End support and deterministic focus movement.

### Files modified
- `apps/dashboard/src/app/components/cairn/pages/SystemPage.tsx`
- `apps/dashboard/src/app/components/cairn/pages/SettingsPage.tsx`
- `apps/dashboard/src/app/components/cairn/Logs.tsx`
- `apps/dashboard/src/app/components/cairn/NavBar.tsx`
- `documents/evolution-log.md`

### Risk introduced
- Low: commit-on-blur/Enter numeric fields delay persistence compared with instant write; mitigated by visible commit hints and blur fallback.
- Low: logs now intentionally hide older entries beyond 200 in active view; full history remains in archive/back-end.
- Low: keyboard nav overrides arrow/home/end inside nav list context by design.

### Metrics before/after
- Settings websocket update pressure (numeric fields): `~1 send per keypress` -> `1 send per committed value` (typically 3-6x fewer sends while editing multi-digit values).
- Logs render ceiling: `unbounded list` -> `max 200 rendered rows` (worst-case DOM/log animation work bounded regardless of backlog size).
- Logs auto-scroll behavior: `always force-scroll on new log` -> `conditional stick-to-bottom only when within 80px of bottom` (avoids disruptive jump while reviewing historical logs).
- Action confirmation latency in System tab: `no explicit immediate acknowledgement` -> `instant aria-live status message on click/toggle before server echo`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually restore prior behavior by reverting:
   - `SystemPage.tsx` pending action acknowledgement state/UX,
   - `SettingsPage.tsx` `NumericCommitField` usage,
   - `Logs.tsx` capped/memoized feed logic,
   - `NavBar.tsx` keyboard roving logic.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 9

### Change summary
- Upgraded planner/executor orchestration contracts with parallel-light worker governance (`maxParallelLightWorkers` cap up to 10), per-step retry controls, escalation hooks, and confidence scoring propagation.
- Extended `executor-v2` to execute `workerClass=light` steps in bounded parallel groups, apply retry ladder logic, and emit confidence-aware step traces.
- Strengthened skill lifecycle intelligence with constitution validation helpers, recoverable archived state transitions, and evolution quality-gate checks wired into promotion flow.
- Added uni/admin actionable digest scaffolding (`buildActionableDigest`, `universityAdminExtractor`) with task/deadline extraction interfaces and digest contract types in shared models.

### Files modified
- `packages/shared/src/types.ts`
- `packages/shared/src/types.d.ts`
- `packages/orchestrator/src/nodes/planner-v2.ts`
- `packages/orchestrator/src/nodes/executor-v2.ts`
- `packages/orchestrator/src/nodes/executor-v2.test.ts`
- `packages/orchestrator/src/orchestrator.ts`
- `packages/orchestrator/src/index.ts`
- `packages/orchestrator/src/digest/actionable-digest.ts`
- `packages/skills/src/manifest-registry-manager.ts`
- `scripts/promote-skill.ts`
- `documents/evolution-log.md`

### Risk introduced
- Medium: parallel light-worker fanout may increase concurrent tool pressure if plans overuse `parallelGroup`; cap enforcement mitigates but does not remove saturation risk.
- Low: retry/escalation ladders can increase execution cost/latency on flaky steps.
- Low: constitution gates in promotion path are stricter and can fail previously tolerated malformed entries.
- Low: digest extractor uses regex heuristics and may over/under-extract tasks from ambiguous text.

### Metrics before/after
- Planner/executor governance metadata: `none -> plan.governance + step-level worker/retry/confidence fields`.
- Parallel orchestration: `sequential-only -> bounded light parallel groups (1..10 cap)`.
- Reliability controls: `single-attempt -> retry ladder (0..3) + optional escalation hook`.
- Trace observability: execution trace now includes per-step `confidence`.
- Skill lifecycle controls: `basic normalization -> constitution validation + archive/recover transition support + quality gate API`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. If manual rollback is preferred:
   - revert planner/executor/orchestrator/shared type changes,
   - remove `packages/orchestrator/src/digest/actionable-digest.ts` + export,
   - restore prior `manifest-registry-manager.ts` and `scripts/promote-skill.ts` behavior.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 8

### Change summary
- Extended `skills/manifest-registry.json` to lifecycle-aware v2 metadata (`lifecycle_state`, `semantic_version`, `merge_lineage`, `evolved_from_request_id`, `last_promoted_at`).
- Added `packages/skills/src/manifest-registry-manager.ts` for typed registry parsing/upsert/semver progression and wired `scripts/promote-skill.ts` to use it.
- Added automated evolution logging from promotion flow (`appendEvolutionLogEntry`) so each promotion writes a structured audit block into this document.
- Hardened orchestration governance in `executeSkill` with per-job invocation budget + duplicate in-flight skill guard to reduce runaway background loops.
- Added UI polish infrastructure via reusable `SkillLifecyclePill` and updated Skills page to render normalized lifecycle badges (`failed|rejected` grouped in backlog view).

### Files modified
- `skills/manifest-registry.json`
- `packages/skills/src/manifest-registry-manager.ts`
- `packages/skills/src/index.ts`
- `packages/skills/src/types.ts`
- `scripts/promote-skill.ts`
- `packages/orchestrator/src/skill-registry.ts`
- `apps/dashboard/src/app/components/cairn/SkillLifecyclePill.tsx`
- `apps/dashboard/src/app/components/cairn/pages/SkillsPage.tsx`
- `apps/dashboard/src/app/components/cairn/types.ts`
- `documents/10_SKILLS_AND_SHELL_INTEGRATION.md`
- `documents/evolution-log.md`

### Risk introduced
- Medium: registry schema bumped to v2; external tooling expecting v1-only keys may require tolerant parsing.
- Low: per-job skill budget (default 12) can block unusually long but valid automations unless max is raised in context.
- Low: dashboard status pill now includes `rejected`; upstream APIs that still emit only `failed` remain supported.

### Metrics before/after
- Before: registry lifecycle fields absent, promotion script did not auto-write evolution log entries, and skill execution had no duplicate in-flight guard.
- After:
  - Registry schema version: `1 -> 2`.
  - Lifecycle metadata coverage: `0/7 -> 7/7` entries include state/version/merge lineage.
  - Promotion audit automation: `manual-only -> automated append` in `scripts/promote-skill.ts`.
  - Governance controls: `0` per-job in-flight dedupe checks -> `1` enforced gate in `executeSkill`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or manually revert:
   - restore `skills/manifest-registry.json` to v1 structure,
   - remove `packages/skills/src/manifest-registry-manager.ts` and script wiring,
   - remove governance budget/in-flight checks from `packages/orchestrator/src/skill-registry.ts`,
   - restore inline status badge in `SkillsPage.tsx`.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 1

### Change summary
- Added `repo_graph_analyzer` skill as Tier-0 structural awareness primitive.
- Added graph extraction script producing workspace dependency graph + topological order + orphan detection + cycle flag.
- Added skill schema and executable test.
- Registered skill in `skills/manifest-registry.json`.
- Stabilized lint by removing stale `@ts-expect-error` in mobile ExternalLink.

### Files modified
- `apps/mobile/components/ExternalLink.tsx`
- `skills/manifest-registry.json`
- `skills/repo_graph_analyzer/SKILL.md`
- `skills/repo_graph_analyzer/schema.json`
- `skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs`
- `skills/repo_graph_analyzer/tests/repo_graph_analyzer.test.mjs`
- `documents/evolution-log.md`

### Risk introduced
- Low: custom workspace parser currently supports `pnpm-workspace.yaml` glob format using `/*` patterns only.
- Medium: graph quality depends on package naming consistency and package.json parseability.

### Metrics before/after
- Before: no dedicated repo graph artifact or graph metrics file.
- After:
  - `documents/repo-graph.json` generated.
  - `documents/metrics/repo-graph-analyzer.metrics.json` generated with:
    - nodeCount
    - edgeCount
    - orphans
    - hasCycle
    - durationMs
- Pipeline status after changes:
  - install ✅
  - lint ✅
  - test ✅
  - build ✅

### Screenshot diffs
- No UI impact this iteration.

### Rollback instructions
1. `git revert <commit_sha>`
2. Or remove added skill directory and manifest entry:
   - delete `skills/repo_graph_analyzer/`
   - remove `repo_graph_analyzer` object in `skills/manifest-registry.json`
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 2

### Change summary
- Added `architectural_diff_analyzer` skill to compute graph deltas between iterations.
- Introduced structural delta metrics to support measurable mutation decisions.
- Baseline capture now supports before/after graph comparison.

### Files modified
- `skills/manifest-registry.json`
- `skills/architectural_diff_analyzer/SKILL.md`
- `skills/architectural_diff_analyzer/schema.json`
- `skills/architectural_diff_analyzer/scripts/architectural_diff.mjs`
- `skills/architectural_diff_analyzer/tests/architectural_diff_analyzer.test.mjs`
- `documents/repo-graph.before.json`
- `documents/metrics/architectural-diff.json`
- `documents/metrics/architectural-diff.metrics.json`
- `documents/evolution-log.md`

### Risk introduced
- Low: diff engine assumes `topologicalOrder` exists in both snapshots.
- Low: current order-change metric is positional only, not semantic dependency impact.

### Metrics before/after
- Before: no explicit structural diff artifact.
- After: `architectural-diff.json` + `architectural-diff.metrics.json` persisted each iteration.
- Current observed deltas: stable graph (node/edge deltas near zero), cycle status unchanged.
- Pipeline status:
  - install ✅
  - lint ✅
  - test ✅
  - build ✅

### Screenshot diffs
- No UI impact this iteration.

### Rollback instructions
1. `git revert <commit_sha>`
2. Or remove `skills/architectural_diff_analyzer/` and its manifest entry.
3. Delete generated artifacts:
   - `documents/repo-graph.before.json`
   - `documents/metrics/architectural-diff.json`
   - `documents/metrics/architectural-diff.metrics.json`
4. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 3

### Change summary
- Corrected `repo_graph_analyzer` topological sorting logic to output dependency-first build order instead of depender-first order.
- Added `topologicalViolations` metric (count of dependency-order violations) to graph and metrics outputs.
- Strengthened skill test to assert full topological coverage and zero ordering violations.

### Files modified
- `skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs`
- `skills/repo_graph_analyzer/tests/repo_graph_analyzer.test.mjs`
- `skills/repo_graph_analyzer/SKILL.md`
- `documents/repo-graph.json`
- `documents/metrics/repo-graph-analyzer.metrics.json`
- `documents/evolution-log.md`

### Risk introduced
- Low: queue ordering among independent nodes remains input-order dependent (deterministic for current filesystem traversal, but not semantically significant).
- Low: new violation metric assumes edges model `package -> dependency`; metric semantics depend on that convention.

### Metrics before/after
- Before: `topologicalOrder` violated dependency precedence across graph (effectively every edge in current snapshot), and no explicit violation counter existed.
- After:
  - `topologicalViolations`: `54 -> 0`
  - `nodeCount`: `18` (unchanged)
  - `edgeCount`: `54` (unchanged)
  - `orphans`: `2` (unchanged)
  - `hasCycle`: `false` (unchanged)
- Validation status:
  - `node skills/repo_graph_analyzer/tests/repo_graph_analyzer.test.mjs` ✅
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or restore previous analyzer/test docs:
   - `skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs`
   - `skills/repo_graph_analyzer/tests/repo_graph_analyzer.test.mjs`
   - `skills/repo_graph_analyzer/SKILL.md`
3. Re-run analyzer and pipeline:
   - `node skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs`
   - `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 7

### Change summary
- Hardened vault lease identifier generation by replacing `Math.random()` lease IDs with `crypto.randomUUID()`.
- Removed predictable low-entropy lease key path for secret lease records.

### Files modified
- `packages/vault/src/vault.ts`
- `documents/evolution-log.md`

### Risk introduced
- Low: lease ID format changed from short base36 token to UUID v4 string; any downstream code assuming legacy ID length/pattern should be updated.

### Metrics before/after
- Before: lease IDs created with `Math.random().toString(36).substring(2,15)` (~13 chars, non-cryptographic RNG).
- After: lease IDs created with `randomUUID()` (122 bits UUID v4 randomness, CSPRNG-backed).
- Collision/predictability profile: materially improved for concurrent lease creation.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or restore previous lease ID expression in `packages/vault/src/vault.ts`.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 6

### Change summary
- Improved dashboard `NavBar` accessibility by introducing a semantic `<nav>` landmark and list structure for primary navigation controls.
- Added explicit `aria-label` copy and `aria-current="page"` on active destination for better screen-reader orientation.
- Increased discoverability and focus clarity with visible text labels on `sm+`, larger hit targets (`min-h/min-w`), hover affordances, and keyboard focus rings.

### Files modified
- `apps/dashboard/src/app/components/cairn/NavBar.tsx`
- `documents/evolution-log.md`

### Risk introduced
- Low: nav buttons now include short text labels on larger breakpoints, which slightly changes horizontal density.
- Low: updated visual states may need minor tuning against future theme token adjustments.

### Metrics before/after
- Before: icon-only buttons, no navigation landmark label, no `aria-current`, weaker keyboard focus discoverability.
- After:
  - Landmark/semantics: `div` wrapper → `nav[aria-label="Primary dashboard navigation"]` + `ul/li` structure.
  - Active-state accessibility: `aria-current` coverage `0/4` → `1/4` (current view only, expected).
  - Discoverability: visible text labels on `sm+` breakpoints `0` → `4` destinations.
  - Touch/keyboard target floor: unconstrained icon button footprint → `min 36x36` via `min-h-9 min-w-9`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or restore previous `NavBar` button loop in `apps/dashboard/src/app/components/cairn/NavBar.tsx`.
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 5

### Change summary
- Replaced gateway mobile pairing secret generation in config flow from `Math.random()` to Node `crypto.randomBytes(32)`.
- Added a dedicated `generatePairingSecret()` helper to centralize secure token generation semantics.
- Preserved existing persistence flow (`updateEnvVar`) while hardening randomness source.

### Files modified
- `apps/gateway/src/config.ts`
- `documents/evolution-log.md`

### Risk introduced
- Low: pairing secret format changed from base36-like variable charset to fixed-length hex string; downstream consumers that validate charset/length should tolerate 64-char token values.

### Metrics before/after
- Before: `MOBILE_PAIRING_SECRET` generated via two `Math.random().toString(36)` segments (~26 chars total, non-cryptographic RNG).
- After: `MOBILE_PAIRING_SECRET` generated via `randomBytes(32).toString("hex")` (64 chars, CSPRNG-backed).
- Effective entropy target: ~`<=~134 bits (Math.random path, implementation-dependent)` → `256 bits (CSPRNG bytes)`.
- Validation status:
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or restore prior generator in `apps/gateway/src/config.ts` (Math.random-based expression).
3. Re-run: `pnpm lint && pnpm test && pnpm build`

## 2026-02-18 Iteration 4

### Change summary
- Extended `repo_graph_analyzer` to emit `entrypoints` (packages with zero dependers) so architecture reports distinguish isolated modules from runtime roots.
- Added `entrypoints` count to analyzer metrics for trend tracking.
- Expanded analyzer test coverage to verify `entrypoints` output shape and non-empty detection.

### Files modified
- `skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs`
- `skills/repo_graph_analyzer/tests/repo_graph_analyzer.test.mjs`
- `skills/repo_graph_analyzer/SKILL.md`
- `documents/repo-graph.json`
- `documents/metrics/repo-graph-analyzer.metrics.json`
- `documents/evolution-log.md`

### Risk introduced
- Low: `entrypoints` semantics are graph-structural (no incoming edges) and may include intentionally isolated apps/services.
- Low: downstream consumers expecting old metrics schema must tolerate the new `entrypoints` field.

### Metrics before/after
- Before: no explicit entrypoint metric.
- After:
  - `entrypoints`: `3` (`@cairn/dashboard`, `@cairn/gateway`, `mobile`)
  - `orphans`: `2` (unchanged)
  - `topologicalViolations`: `0` (unchanged)
  - `nodeCount`: `18` (unchanged)
  - `edgeCount`: `54` (unchanged)
- Validation status:
  - `node skills/repo_graph_analyzer/tests/repo_graph_analyzer.test.mjs` ✅
  - `pnpm lint` ✅
  - `pnpm test` ✅
  - `pnpm build` ✅

### Rollback instructions
1. `git revert <commit_sha>`
2. Or remove `entrypoints` additions from:
   - `skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs`
   - `skills/repo_graph_analyzer/tests/repo_graph_analyzer.test.mjs`
   - `skills/repo_graph_analyzer/SKILL.md`
3. Regenerate graph artifacts and re-run pipeline:
   - `node skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs`
   - `pnpm lint && pnpm test && pnpm build`
