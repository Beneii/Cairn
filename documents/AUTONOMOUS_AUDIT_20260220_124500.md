# AUTONOMOUS AUDIT - 2026-02-20T12:45:00Z

## Project Overview
- **Project Name:** cairn-monorepo
- **Package Manager:** pnpm (v10.28.2)
- **Node Version:** v24.9.0
- **Structure:** Monorepo with `apps/` and `packages/`

## Health Check Results
- **Install:** SUCCESS
- **Lint:** FAILED
  - Significant type errors in `@cairn/orchestrator`.
  - Errors relate to missing exports in `@cairn/shared` and property access on `Plan` types.
- **Build:** SUCCESS
  - Note: `turbo run build` succeeded despite lint errors, likely due to separate task execution or non-strict tsc in some configurations, though `tsc` was seen running.
- **Test:** SUCCESS (Partial)
  - `mobile` tests passed. Most other packages seem to have no tests or skipped them.
- **Audit:** SKIPPED (Network issues with npm registry)

## Repo Health Score: 75/100
- **Deductions:**
  - (-20) Significant lint/type errors in core package (`orchestrator`).
  - (-5) Incomplete test coverage across many packages.

## Open Issues
- `ActionableDigest` missing from `@cairn/shared`.
- `Plan` type mismatch in `executor-v2.ts` and `planner-v2.ts`.

## Recommendations
1. Sync `@cairn/shared` types with `orchestrator` requirements.
2. Update `Plan` and `PlanStep` interfaces to include `governance`, `workerClass`, etc.
