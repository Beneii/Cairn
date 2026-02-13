#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f package.json ]]; then
  echo "No package.json found; skipping Node dependency setup."
  exit 0
fi

if command -v pnpm >/dev/null 2>&1; then
  echo "Running pnpm install --frozen-lockfile"
  pnpm install --frozen-lockfile
elif command -v npm >/dev/null 2>&1; then
  echo "pnpm not found; running npm ci"
  npm ci
else
  echo "Error: neither pnpm nor npm is available"
  exit 1
fi

echo "Development environment setup complete."
