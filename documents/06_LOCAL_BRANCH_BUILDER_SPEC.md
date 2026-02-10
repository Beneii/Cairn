# 06 — Local Branch Builder Feature Specification

## 1. Purpose

The Local Branch Builder is a **scheduled, permissioned developer worker** within Cairn that:

- Takes a clear approved feature specification
- Creates a dedicated local git branch
- Edits code autonomously via a trusted coder interface (CLI)
- Runs tests and build tooling
- Commits valid changes
- Pushes the branch to GitHub
- Stops when complete, interrupted, or budget-limited

### Explicit Non-Goals

- It does **not** merge to `main`
- It does **not** expand scope without explicit approval
- It does **not** bypass policy/permission boundaries

---

## 2. Trigger & Invocation

### 2.1 User-Initiated Trigger

The builder starts only after explicit user approval of a feature proposal and all required run controls:

- Start time (for scheduled execution)
- Maximum duration and/or step budget
- Scope allowlist and/or denylist

### 2.2 CLI/UI Invocation (Example)

```bash
cairn branch-build --feature "..." --start "..." --scope "..." --budget 1000
```

---

## 3. Guards & Constraints

### 3.1 Authority & Permissions

- Runs only after explicit user approval
- Runs only in an isolated git branch
- Must not merge to protected branches
- Must only edit and commit within approved scope

### 3.2 Stop Conditions (First Match Wins)

The builder must stop at the first condition reached:

- Budget exhausted (steps/time/tokens)
- Repeated test/build failure threshold reached
- Explicit user interrupt
- Task completion

### 3.3 Safety & Quarantine

- All edits remain local until push to named branch
- On repeated failure, rollback to last known-good state
- Persist failure context and logs for user review

---

## 4. Environment & Local Working Copy

The builder operates on a checked-out local git repository:

1. Clone remote locally (if needed)
2. Create a dedicated branch

   ```bash
   git checkout -b cairn/<branch-name>
   ```

3. Pull latest as required
4. Work only on that local branch during execution

No cloud-only editing mode is assumed for this capability.

---

## 5. Core Loop & Execution Model

Deterministic bounded loop:

1. Select next approved task
2. Invoke coder CLI with spec/task/file context
3. Apply patch
4. Run toolchain (e.g., `pnpm build`, `pnpm test`)
5. Evaluate result
   - On failure: one automated revision attempt
   - If failure persists: rollback and log
   - On success: `git add` + `git commit`
6. Push branch periodically or on completion

Loop terminates only on defined stop conditions.

---

## 6. Approved Feature Spec Input Requirements

Before execution, the Approved Feature Spec must include:

### 6.1 Goals & Scope

- What feature is being built
- Which files/directories may be edited
- Explicit denylist (must not touch)

### 6.2 Success Criteria

Machine-verifiable outcomes:

- Required tests pass
- Build succeeds
- Lint/style checks pass (if defined)

### 6.3 Task Breakdown

Ordered discrete subtasks, each testable:

- Add CLI flag X
- Implement endpoint Y
- Update docs Z

### 6.4 Budget

Explicit run budget:

- Step count
- Time limit
- Token limit (if applicable)

---

## 7. Interfaces

### 7.1 User Interface

Representative commands:

```bash
cairn branch-build propose "New Feature"
cairn branch-build approve
cairn branch-build status
```

The surface must expose state transitions and logs.

### 7.2 Coder Interface

Code edits are performed only via a local coder CLI adapter that:

- Receives task/spec and file context
- Produces a patch
- Returns structured errors

No direct out-of-band code mutation path is allowed.

---

## 8. Logging & Observability

Every run must log:

- Spec reference ID
- Timestamped step sequence
- Patch previews
- Build/test outcomes
- Commit hashes and branch name

Default log location:

```text
/cairn/logs/branch-builder/YYYY-MM-DD/
```

---

## 9. Post-Run Report

At completion/stop, generate a report containing:

- Branch name
- Commit list
- Build/test pass-fail summary
- Unresolved edge cases
- Human next-step recommendations

---

## 10. Acceptance Criteria

Implementation is complete when all are true:

1. Runs locally against checked-out repo
2. Creates and pushes a feature branch
3. Edits code through coder CLI adapter
4. Tests and commits only valid changes
5. Stops on budget or completion
6. Produces a human-readable report

---

## 11. Current Implementation Status

As of this spec revision, Local Branch Builder is a **specified capability target**, not an implemented runtime capability.
Until implementation lands and is registered in the capability registry, execution requests must return a blocked/not-implemented response.
