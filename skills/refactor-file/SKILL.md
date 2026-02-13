---
name: refactor-file
description: |
  Use when the user explicitly asks for code cleanup, simplification, or
  structure-preserving refactoring of a target file.
use_when:
  - "refactor this file"
  - "clean up this function"
  - "simplify code structure"
dont_use_when:
  - "new feature implementation without refactor intent"
  - "non-code content"
success_criteria:
  - "target file modified"
  - "post-change tests/checks executed"
---

# Refactor File

Applies a textual refactor pattern to a target file and then runs validations.

# Steps

1) Resolve target file path.
2) Apply scripted refactor transformation.
3) Run tests/checks to detect regressions.

# Scripts

- scripts/apply_refactor.sh
