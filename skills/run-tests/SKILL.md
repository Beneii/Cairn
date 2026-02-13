---
name: run-tests
description: |
  Use when the user asks to validate changes, run CI-like checks, or execute the
  project test suite.
use_when:
  - "run tests"
  - "validate changes"
  - "execute CI checks"
dont_use_when:
  - "pure planning requests without code changes"
success_criteria:
  - "test command executed"
  - "results logged with pass/fail status"
---

# Run Tests

Runs project tests in the shell environment with simple command discovery.

# Steps

1) Ensure dependencies are available.
2) Run the selected test command.
3) Emit pass/fail summary and write log output.

# Scripts

- scripts/execute_tests.sh
