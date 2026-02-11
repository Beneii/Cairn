#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

CAIRN_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CAIRN_DIR"

# ===== --install-timer: set up auto-update and exit =====
if [[ "${1:-}" == "--install-timer" ]]; then
  echo -e "${YELLOW}Installing auto-update timer...${NC}"

  CAIRN_USER="$(whoami)"

  sudo tee /etc/systemd/system/cairn-update.service > /dev/null <<EOF
[Unit]
Description=Cairn Auto-Update

[Service]
Type=oneshot
User=$CAIRN_USER
WorkingDirectory=$CAIRN_DIR
ExecStart=$CAIRN_DIR/update.sh
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cairn-update
EOF

  sudo tee /etc/systemd/system/cairn-update.timer > /dev/null <<EOF
[Unit]
Description=Daily Cairn update check

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true
RandomizedDelaySec=1800

[Install]
WantedBy=timers.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable --now cairn-update.timer

  echo -e "${GREEN}Auto-update timer installed (daily ~4am).${NC}"
  echo -e "Check: ${CYAN}systemctl list-timers cairn-update*${NC}"
  exit 0
fi

# ===== Normal update =====
echo -e "${GREEN}Cairn Update${NC}"
echo ""

# 1. Pull
echo -e "${YELLOW}[1/4]${NC} Pulling latest changes..."
BEFORE=$(git rev-parse HEAD)
if ! git pull --ff-only; then
  echo -e "${RED}Pull failed. Local changes or diverged branch.${NC}"
  echo -e "Try: ${CYAN}git stash && ./update.sh${NC}"
  exit 1
fi
AFTER=$(git rev-parse HEAD)

if [[ "$BEFORE" == "$AFTER" ]]; then
  echo -e "  ${GREEN}Already up to date.${NC}"
  exit 0
fi

echo -e "  ${GREEN}Updated: ${BEFORE:0:7} -> ${AFTER:0:7}${NC}"

# 2. Install deps if lockfile changed
echo -e "${YELLOW}[2/4]${NC} Checking dependencies..."
if git diff --name-only "$BEFORE" "$AFTER" | grep -q "pnpm-lock.yaml"; then
  echo -e "  Lockfile changed, installing..."
  pnpm install --frozen-lockfile
else
  echo -e "  ${GREEN}No dependency changes${NC}"
fi

# 3. Build
echo -e "${YELLOW}[3/4]${NC} Building..."
pnpm build

if [[ ! -f "$CAIRN_DIR/apps/gateway/dist/index.js" ]]; then
  echo -e "${RED}Build failed: apps/gateway/dist/index.js missing.${NC}"
  exit 1
fi

# 4. Restart
echo -e "${YELLOW}[4/4]${NC} Restarting Cairn..."
sudo systemctl restart cairn

sleep 3
if systemctl is-active --quiet cairn; then
  echo -e "${GREEN}Update complete. Cairn is running.${NC}"
else
  echo -e "${RED}Cairn failed to start after update.${NC}"
  echo -e "Check: ${CYAN}sudo journalctl -u cairn -n 50${NC}"
  exit 1
fi
