# Evolution Log

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
