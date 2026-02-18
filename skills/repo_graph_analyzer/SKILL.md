# repo_graph_analyzer

## Purpose
Builds a dependency-aware graph of the Cairn repository so architectural refactors can be planned with deterministic package ordering.

## Inputs
- `rootPath` (string, optional): repository root. Defaults to current working directory.
- `outputPath` (string, optional): where to write graph JSON. Defaults to `documents/repo-graph.json`.

## Outputs
- JSON graph with:
  - package nodes
  - dependency edges (workspace-local)
  - topological build order
  - orphan package detection
  - cycle detection flag

## Trace + Metrics
Writes trace and counters:
- `documents/metrics/repo-graph-analyzer.metrics.json`
- includes `nodeCount`, `edgeCount`, `orphans`, `entrypoints`, `durationMs`, `hasCycle`, `topologicalViolations`

## Schema
See `skills/repo_graph_analyzer/schema.json`.

## Entry
`node skills/repo_graph_analyzer/scripts/analyze_repo_graph.mjs`
