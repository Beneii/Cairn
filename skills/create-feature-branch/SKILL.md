---
name: create-feature-branch
description: |
  Use when a user asks to start implementation work for a new feature and
  needs a dedicated feature branch plus local development setup.
use_when:
  - "start a feature"
  - "create a new branch"
  - "begin feature work"
dont_use_when:
  - "documentation-only changes"
  - "small typo-only edits"
success_criteria:
  - "feature branch exists locally"
  - "dev environment setup script completed"
---

# Create Feature Branch

Creates a feature branch using the `feat/<task-id>` convention and prepares the
local environment for coding.

# Steps

1) Validate repository is clean enough for branch creation.
2) Create a feature branch with convention `feat/<task-id>`.
3) Run development setup checks.
4) Report branch name and setup status.

# Scripts

- scripts/create_branch.sh
- scripts/setup_dev_env.sh
