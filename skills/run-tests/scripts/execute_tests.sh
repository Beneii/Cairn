#!/usr/bin/env bash
set -euo pipefail

LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/tests-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$LOG_DIR"

TEST_CMD="${TEST_CMD:-}"
if [[ -z "$TEST_CMD" ]]; then
  if [[ -f pnpm-lock.yaml ]] && command -v pnpm >/dev/null 2>&1; then
    TEST_CMD="pnpm test"
  elif [[ -f package.json ]]; then
    TEST_CMD="npm test"
  else
    echo "No recognizable test command found." | tee "$LOG_FILE"
    exit 1
  fi
fi

echo "[run-tests] Running: ${TEST_CMD}" | tee "$LOG_FILE"
set +e
bash -lc "$TEST_CMD" 2>&1 | tee -a "$LOG_FILE"
CMD_EXIT=${PIPESTATUS[0]}
set -e

if [[ $CMD_EXIT -eq 0 ]]; then
  echo "[run-tests] All tests passed." | tee -a "$LOG_FILE"
else
  echo "[run-tests] Tests failed with exit code $CMD_EXIT." | tee -a "$LOG_FILE"
fi

exit $CMD_EXIT
