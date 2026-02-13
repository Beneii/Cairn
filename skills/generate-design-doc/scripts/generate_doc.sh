#!/usr/bin/env bash
set -euo pipefail

TITLE="${1:-Untitled Design}"
OUT_PATH="${2:-docs/design-$(date +%Y%m%d-%H%M%S).md}"
TEMPLATE="skills/generate-design-doc/templates/design_template.md"

mkdir -p "$(dirname "$OUT_PATH")"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE"
  exit 1
fi

sed \
  -e "s/{{TITLE}}/${TITLE//\//-}/g" \
  -e "s/{{OVERVIEW}}/TBD/g" \
  -e "s/{{PROBLEM_STATEMENT}}/TBD/g" \
  -e "s/{{GOALS}}/- TBD/g" \
  -e "s/{{NON_GOALS}}/- TBD/g" \
  -e "s/{{PROPOSED_DESIGN}}/TBD/g" \
  -e "s/{{RISKS}}/- TBD/g" \
  -e "s/{{TESTING}}/- TBD/g" \
  -e "s/{{ROLLOUT}}/- TBD/g" \
  "$TEMPLATE" > "$OUT_PATH"

echo "Generated design doc at: $OUT_PATH"
