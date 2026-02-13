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
