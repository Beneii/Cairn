# 09 — Tool Migration Matrix

This tracks migration from legacy executor tools (`packages/executor/src/tools.ts`) to manifest tools (`packages/executor/src/manifest.ts` + `packages/executor/src/tools/*`).

## Runtime Gate

`EXECUTOR_MANIFEST_MODE` controls behavior in `packages/executor/src/executor.ts`:

- `fallback` (default): legacy-first, manifest only when legacy tool is unavailable
- `prefer`: manifest-first for mapped tools, fallback to legacy if manifest fails
- `strict`: manifest-only for mapped tools (no legacy fallback)

## Current Mapping

| Legacy Tool | Manifest Tool | Status | Notes |
|---|---|---|---|
| `memory_read` | `memory.read` | mapped | Output adapted to legacy text contract |
| `memory_write` | `memory.write` | mapped | Output adapted to legacy text contract |
| `fetch_url` | `web.fetch` | mapped | Uses bounded `maxBytes` adapter |
| `vector_search` | `vector_search` | mapped | Normalized score/source output |
| `calendar_read` | `calendar.list_events` | mapped | Output adapted to `event_count/events` |

## Not Yet Migrated (Legacy Only)

- `web_search`
- `gmail_read`
- `ledger_write`
- `goals_read`
- `goals_update`
- `tasks_read`
- `tasks_create`
- `tasks_complete`
- `research_ingest`
- `note_create`
- browser tools (`browser_*`)

## Next Migration Steps

1. Add manifest tool implementations for unmapped legacy tools.
2. Expand alias map and output adapters in `packages/executor/src/executor.ts`.
3. Run with `EXECUTOR_MANIFEST_MODE=prefer` in staging.
4. Move to `strict` once parity is validated.
5. Remove legacy implementations from `packages/executor/src/tools.ts`.
