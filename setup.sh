#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

CAIRN_DIR="$(cd "$(dirname "$0")" && pwd)"
CAIRN_USER="$(whoami)"

echo -e "${GREEN}=============================${NC}"
echo -e "${GREEN}  Cairn Setup               ${NC}"
echo -e "${GREEN}=============================${NC}"
echo ""

# ===== 1. OS Check =====
if [[ ! -f /etc/debian_version ]]; then
  echo -e "${RED}This script targets Ubuntu/Debian. Detected a different OS.${NC}"
  echo "You can still install manually — see the project README."
  exit 1
fi

echo -e "${GREEN}[1/8]${NC} Checking system..."
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential python3 git > /dev/null

# ===== 2. Node.js 20 =====
echo -e "${YELLOW}[2/8]${NC} Checking Node.js..."
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VER" -ge 20 ]]; then
    echo -e "  ${GREEN}Node.js $(node -v) found${NC}"
  else
    echo -e "  ${YELLOW}Node.js $(node -v) is too old, installing v20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
  fi
else
  echo -e "  Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# ===== 3. pnpm =====
echo -e "${YELLOW}[3/8]${NC} Checking pnpm..."
if command -v pnpm &>/dev/null; then
  echo -e "  ${GREEN}pnpm $(pnpm -v) found${NC}"
else
  echo -e "  Installing pnpm..."
  sudo npm install -g pnpm
fi

# ===== 4. Ollama =====
echo -e "${YELLOW}[4/8]${NC} Checking Ollama..."
if command -v ollama &>/dev/null; then
  echo -e "  ${GREEN}Ollama found$(ollama -v 2>/dev/null && true)${NC}"
else
  echo -e "  ${YELLOW}Ollama not found.${NC}"
  echo ""
  echo -e "  For AMD GPU (ROCm):"
  echo -e "    ${CYAN}curl -fsSL https://ollama.com/install.sh | OLLAMA_ROCM=1 sh${NC}"
  echo ""
  echo -e "  For NVIDIA GPU or CPU-only:"
  echo -e "    ${CYAN}curl -fsSL https://ollama.com/install.sh | sh${NC}"
  echo ""
  echo -e "  Cairn works without Ollama (cloud API only), but local models need it."
  echo -e "  Install Ollama later and restart Cairn whenever you're ready."
  echo ""
fi

# ===== 5. Install + Build =====
echo -e "${YELLOW}[5/8]${NC} Installing dependencies..."
cd "$CAIRN_DIR"
pnpm install

echo -e "${YELLOW}[6/8]${NC} Building..."
pnpm build
echo -e "  ${GREEN}Build complete${NC}"

# ===== 7. Environment =====
echo -e "${YELLOW}[7/8]${NC} Setting up environment..."
if [[ -f "$CAIRN_DIR/.env" ]]; then
  echo -e "  ${GREEN}.env already exists, skipping${NC}"
else
  cp "$CAIRN_DIR/.env.example" "$CAIRN_DIR/.env"
  chmod 600 "$CAIRN_DIR/.env"

  echo ""
  echo -e "  ${CYAN}Configure your .env (press Enter to skip any):${NC}"
  echo ""

  read -rp "  OpenAI API key (blank = local-only mode): " OPENAI_KEY
  if [[ -n "$OPENAI_KEY" ]]; then
    sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$OPENAI_KEY|" "$CAIRN_DIR/.env"
  fi

  read -rp "  Telegram bot token (optional): " TG_TOKEN
  if [[ -n "$TG_TOKEN" ]]; then
    sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TG_TOKEN|" "$CAIRN_DIR/.env"
  fi

  read -rp "  Telegram admin chat ID (optional): " TG_CHAT
  if [[ -n "$TG_CHAT" ]]; then
    sed -i "s|^TELEGRAM_ADMIN_CHAT_ID=.*|TELEGRAM_ADMIN_CHAT_ID=$TG_CHAT|" "$CAIRN_DIR/.env"
  fi

  # Set production defaults
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$CAIRN_DIR/.env"

  echo ""
  echo -e "  ${GREEN}.env created${NC} — edit ${CYAN}$CAIRN_DIR/.env${NC} to change settings later."
fi

# ===== 8. Systemd =====
echo -e "${YELLOW}[8/8]${NC} Creating systemd service..."

PNPM_PATH="$(command -v pnpm)"

sudo tee /etc/systemd/system/cairn.service > /dev/null <<EOF
[Unit]
Description=Cairn AI Assistant
After=network.target
Wants=ollama.service

[Service]
Type=simple
User=$CAIRN_USER
WorkingDirectory=$CAIRN_DIR
Environment="NODE_ENV=production"
ExecStart=$PNPM_PATH start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cairn

[Install]
WantedBy=multi-user.target
EOF

# Allow passwordless restart for auto-updates
sudo tee /etc/sudoers.d/cairn > /dev/null <<EOF
$CAIRN_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart cairn, /usr/bin/systemctl daemon-reload
EOF
sudo chmod 440 /etc/sudoers.d/cairn

sudo systemctl daemon-reload
sudo systemctl enable cairn
sudo systemctl start cairn

# Verify
sleep 3
if systemctl is-active --quiet cairn; then
  echo -e "  ${GREEN}Cairn is running${NC}"
else
  echo -e "  ${RED}Cairn failed to start. Check: sudo journalctl -u cairn -n 50${NC}"
  exit 1
fi

# ===== Done =====
echo ""
echo -e "${GREEN}=============================${NC}"
echo -e "${GREEN}  Setup Complete            ${NC}"
echo -e "${GREEN}=============================${NC}"
echo ""
echo -e "  Cairn:    ${CYAN}http://localhost:3100${NC}"
echo ""
echo -e "  Commands:"
echo -e "    Logs:     ${CYAN}sudo journalctl -u cairn -f${NC}"
echo -e "    Restart:  ${CYAN}sudo systemctl restart cairn${NC}"
echo -e "    Stop:     ${CYAN}sudo systemctl stop cairn${NC}"
echo -e "    Update:   ${CYAN}./update.sh${NC}"
echo -e "    Auto-update: ${CYAN}./update.sh --install-timer${NC}"
echo -e "    Config:   ${CYAN}nano $CAIRN_DIR/.env${NC}"
echo ""
