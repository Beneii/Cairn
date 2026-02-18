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
