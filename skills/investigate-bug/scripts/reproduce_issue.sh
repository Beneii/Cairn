#!/usr/bin/env bash
set -euo pipefail

DESCRIPTION="${1:-No description supplied}"
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/bug-repro-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$LOG_DIR"

echo "[investigate-bug] Description: ${DESCRIPTION}" | tee "$LOG_FILE"

echo "[investigate-bug] Git status:" | tee -a "$LOG_FILE"
git status --short | tee -a "$LOG_FILE"

REPRO_CMD="${REPRO_CMD:-}"
if [[ -n "$REPRO_CMD" ]]; then
  echo "[investigate-bug] Running REPRO_CMD: $REPRO_CMD" | tee -a "$LOG_FILE"
  set +e
  bash -lc "$REPRO_CMD" 2>&1 | tee -a "$LOG_FILE"
  CMD_EXIT=${PIPESTATUS[0]}
  set -e
  if [[ $CMD_EXIT -ne 0 ]]; then
    echo "[investigate-bug] Reproduced (command failed as expected)." | tee -a "$LOG_FILE"
    exit 0
  fi
  echo "[investigate-bug] Command succeeded; issue may not reproduce." | tee -a "$LOG_FILE"
  exit 0
fi

echo "[investigate-bug] No REPRO_CMD provided; cannot automatically reproduce." | tee -a "$LOG_FILE"
