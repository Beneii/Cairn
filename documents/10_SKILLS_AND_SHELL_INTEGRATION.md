# 10 — Skills and Shell Integration

This document codifies Cairn workflows as explicit skills that can be invoked by
planner output and executed through shell scripts.

## Purpose

- Prevent planner-side procedural improvisation.
- Keep workflows reusable, versioned, and independently testable.
- Run concrete commands in an execution sandbox.
- Support context compaction by persisting semantic summaries, not full logs.

## Directory Layout

```text
/skills/
  /create-feature-branch/
    SKILL.md
    scripts/
      create_branch.sh
      setup_dev_env.sh
  /investigate-bug/
    SKILL.md
    scripts/
      reproduce_issue.sh
  /run-tests/
    SKILL.md
    scripts/
      execute_tests.sh
  /refactor-file/
    SKILL.md
    scripts/
      apply_refactor.sh
  /generate-design-doc/
    SKILL.md
    scripts/
      generate_doc.sh
    templates/
      design_template.md
  manifest-registry.json
```


## Manifest Registry Fields

`skills/manifest-registry.json` now supports runtime-control metadata per entry:

- `enabled` (boolean): If `false`, runtime skips this skill mapping.
- `runtime_skill_id` (string): Optional mapping to a runtime skill ID (e.g. `task.create`).
- `version` (number): Numeric registry revision incremented on each promotion.
- `semantic_version` (string): Human-readable lifecycle version (`major.minor.patch`) used for merge and deprecation workflows.
- `lifecycle_state` (`experimental|active|merged|deprecated`): Current lifecycle state enforced by governance tooling.
- `merge_lineage` (object): Merge ancestry (`parent_skill`, `merged_from[]`, `merged_into`) for skill genealogy.
- `evolved_from_request_id` (string): SkillRequest ID that triggered this promotion, when available.
- `last_promoted_at` (ISO string): Last registry promotion timestamp.
- `hash_sha256` (string): Optional folder hash used for tamper verification in RUN mode.
- `tier` (number): Trust tier hint for promotion/audit.
- `required_tools` (string[]): Required backing tools for runtime validation.

If no runtime-enabled entries are present, runtime falls back to built-in `DEFAULT_SKILLS` for compatibility.

## Planner Contract

Planner output must explicitly target a skill:

```json
{
  "invoke_skill": "<skill-name>",
  "skill_args": {}
}
```

## Executor Contract

Executor runs scripts through shell:

```json
{
  "tool": "shell",
  "command": "bash ./skills/<skill-name>/scripts/<script>.sh"
}
```

## Compaction Contract

After each skill run, persist:

- Trigger summary
- Scripts executed
- Success/fail result
- Condensed output summary

## Security Rules

- Run in sandboxed/isolated shells.
- Avoid leaking credentials in logs.
- Block destructive actions without explicit approval.
- Keep command-level execution logs for audit.

## Deployment Checklist

1. Add/verify skill directories and scripts.
2. Register skills in `skills/manifest-registry.json`.
3. Update planner to emit explicit `invoke_skill` payloads.
4. Ensure executor executes shell scripts via policy-allowed path.
5. Run integration tests and capture outputs.
6. Promote workshop skill into production registry with `pnpm promote-skill <skill-name>`.
