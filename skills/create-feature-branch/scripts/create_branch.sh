#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
if [[ -z "$TASK_ID" ]]; then
  echo "Usage: $0 <task-id>"
  exit 1
fi

# normalize task id for branch safety
NORMALIZED_TASK_ID="$(echo "$TASK_ID" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+|-+$//g')"
if [[ -z "$NORMALIZED_TASK_ID" ]]; then
  echo "Error: task-id normalized to empty string"
  exit 1
fi

BRANCH_NAME="feat/${NORMALIZED_TASK_ID}"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository"
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Warning: repository has uncommitted changes. Proceeding anyway."
fi

if git show-ref --verify --quiet "refs/heads/${BRANCH_NAME}"; then
  echo "Branch ${BRANCH_NAME} already exists. Checking it out."
  git checkout "${BRANCH_NAME}"
else
  git checkout -b "${BRANCH_NAME}"
fi

echo "Created/checked out branch: ${BRANCH_NAME}"
