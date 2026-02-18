# architectural_diff_analyzer

## Purpose
Compares two repository graph snapshots and reports structural deltas (nodes, edges, orphans, cycles, ordering changes).

## Inputs
- `beforePath` (string): baseline graph JSON path.
- `afterPath` (string): current graph JSON path.
- `outputPath` (string, optional): defaults to `documents/metrics/architectural-diff.json`.

## Outputs
- Delta report JSON with:
  - node delta
  - edge delta
  - orphan delta
  - cycle status change
  - order change count

## Trace + Metrics
Writes `documents/metrics/architectural-diff.metrics.json`.

## Schema
See `skills/architectural_diff_analyzer/schema.json`.

## Entry
`node skills/architectural_diff_analyzer/scripts/architectural_diff.mjs`
