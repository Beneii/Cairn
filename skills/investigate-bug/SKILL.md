---
name: investigate-bug
description: |
  Use when a user asks to reproduce an issue, find root cause, or understand why
  a behavior is failing.
use_when:
  - "find root cause"
  - "reproduce issue"
  - "why does this fail"
dont_use_when:
  - "feature requests"
  - "non-bug documentation work"
success_criteria:
  - "reproduction attempt output captured"
  - "logs saved with repro status"
---

# Investigate Bug

Automates a best-effort reproduction attempt and captures logs for diagnosis.

# Steps

1) Run reproduction script with context from the task.
2) Capture command output and error logs.
3) Report whether issue reproduced or not.

# Scripts

- scripts/reproduce_issue.sh
