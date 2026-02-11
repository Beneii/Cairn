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
  echo -e "${RED}This script targets Ubuntu/Debian.${NC}"
  exit 1
fi

echo -e "${YELLOW}[1/8]${NC} Installing system dependencies..."
sudo apt-get update -qq
sudo apt-get install -y -qq build-essential python3 git curl > /dev/null 2>&1

# ===== 2. Node.js 20 =====
echo -e "${YELLOW}[2/8]${NC} Checking Node.js..."
NEED_NODE=false
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [[ "$NODE_VER" -ge 20 ]]; then
    echo -e "  ${GREEN}Node.js $(node -v)${NC}"
  else
    NEED_NODE=true
  fi
else
  NEED_NODE=true
fi

if [[ "$NEED_NODE" == "true" ]]; then
  echo -e "  Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
  sudo apt-get install -y nodejs > /dev/null 2>&1
  echo -e "  ${GREEN}Node.js $(node -v)${NC}"
fi

# ===== 3. pnpm via corepack =====
echo -e "${YELLOW}[3/8]${NC} Enabling pnpm..."
sudo corepack enable
corepack prepare pnpm@latest --activate > /dev/null 2>&1
echo -e "  ${GREEN}pnpm $(pnpm -v)${NC}"

# ===== 4. Ollama =====
echo -e "${YELLOW}[4/8]${NC} Checking Ollama..."
if command -v ollama &>/dev/null; then
  echo -e "  ${GREEN}Ollama found${NC}"
else
  echo ""
  echo -e "  ${YELLOW}Ollama not installed.${NC} Cairn works without it (cloud API only)."
  echo -e "  AMD GPU (ROCm): ${CYAN}curl -fsSL https://ollama.com/install.sh | OLLAMA_ROCM=1 sh${NC}"
  echo -e "  NVIDIA / CPU:   ${CYAN}curl -fsSL https://ollama.com/install.sh | sh${NC}"
  echo ""
fi

# ===== 5. Install dependencies =====
echo -e "${YELLOW}[5/8]${NC} Installing dependencies..."
cd "$CAIRN_DIR"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

# ===== 6. Build =====
echo -e "${YELLOW}[6/8]${NC} Building..."
pnpm build

# Verify the build produced what systemd needs
if [[ ! -f "$CAIRN_DIR/apps/gateway/dist/index.js" ]]; then
  echo -e "${RED}Build failed: apps/gateway/dist/index.js not found.${NC}"
  exit 1
fi
echo -e "  ${GREEN}apps/gateway/dist/index.js exists${NC}"

# ===== 7. Environment =====
echo -e "${YELLOW}[7/8]${NC} Setting up .env..."
if [[ -f "$CAIRN_DIR/.env" ]]; then
  echo -e "  ${GREEN}.env exists, keeping it${NC}"
else
  cp "$CAIRN_DIR/.env.example" "$CAIRN_DIR/.env"
  chmod 600 "$CAIRN_DIR/.env"

  # Set production mode
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|" "$CAIRN_DIR/.env"

  echo ""
  echo -e "  ${CYAN}Press Enter to skip any prompt.${NC}"
  echo ""

  read -rp "  OpenAI API key: " OPENAI_KEY
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

  echo ""
  echo -e "  ${GREEN}.env created.${NC} Edit later: ${CYAN}nano $CAIRN_DIR/.env${NC}"
fi

# ===== 8. Systemd =====
echo -e "${YELLOW}[8/8]${NC} Installing systemd service..."

# Generate service from repo template, substituting paths
sed \
  -e "s|User=cairn|User=$CAIRN_USER|" \
  -e "s|WorkingDirectory=/home/cairn/Cairn|WorkingDirectory=$CAIRN_DIR|" \
  -e "s|EnvironmentFile=-/home/cairn/Cairn/.env|EnvironmentFile=-$CAIRN_DIR/.env|" \
  "$CAIRN_DIR/scripts/cairn.service" \
  | sudo tee /etc/systemd/system/cairn.service > /dev/null

# Allow passwordless restart (needed by update.sh)
sudo tee /etc/sudoers.d/cairn > /dev/null <<EOF
$CAIRN_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart cairn, /usr/bin/systemctl daemon-reload
EOF
sudo chmod 440 /etc/sudoers.d/cairn

sudo systemctl daemon-reload
sudo systemctl enable cairn
sudo systemctl start cairn

sleep 3

if systemctl is-active --quiet cairn; then
  echo -e "  ${GREEN}Cairn is running${NC}"
else
  echo -e "  ${RED}Failed to start. Check: sudo journalctl -u cairn -n 50${NC}"
  exit 1
fi

# Verify health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/health 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "  ${GREEN}/health returns 200${NC}"
else
  echo -e "  ${YELLOW}/health returned $HTTP_CODE (may still be starting)${NC}"
fi

echo ""
echo -e "${GREEN}=============================${NC}"
echo -e "${GREEN}  Setup Complete            ${NC}"
echo -e "${GREEN}=============================${NC}"
echo ""
echo -e "  Cairn: ${CYAN}http://localhost:3100${NC}"
echo ""
echo -e "  Logs:    ${CYAN}sudo journalctl -u cairn -f${NC}"
echo -e "  Restart: ${CYAN}sudo systemctl restart cairn${NC}"
echo -e "  Update:  ${CYAN}./update.sh${NC}"
echo -e "  Config:  ${CYAN}nano $CAIRN_DIR/.env${NC}"
echo ""
