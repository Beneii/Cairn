#!/usr/bin/env bash
set -euo pipefail

TARGET_FILE="${1:-}"
FROM_TEXT="${2:-}"
TO_TEXT="${3:-}"

if [[ -z "$TARGET_FILE" || -z "$FROM_TEXT" || -z "$TO_TEXT" ]]; then
  echo "Usage: $0 <target-file> <from-text> <to-text>"
  exit 1
fi

if [[ ! -f "$TARGET_FILE" ]]; then
  echo "Error: target file not found: $TARGET_FILE"
  exit 1
fi

python3 - "$TARGET_FILE" "$FROM_TEXT" "$TO_TEXT" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
from_text = sys.argv[2]
to_text = sys.argv[3]

content = path.read_text()
if from_text not in content:
    print(f"Pattern not found in {path}")
    sys.exit(1)

updated = content.replace(from_text, to_text)
path.write_text(updated)
print(f"Updated {path}")
PY

echo "Refactor complete for ${TARGET_FILE}."
