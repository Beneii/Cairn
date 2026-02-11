#!/bin/bash
set -e

# Cairn VPS Deployment Script
# Usage: ./deploy.sh [VPS_HOST]

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Cairn VPS Deployment Script         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""

# Get VPS host
if [ -z "$1" ]; then
    read -p "Enter VPS hostname/IP: " VPS_HOST
else
    VPS_HOST=$1
fi

# Configuration
REMOTE_USER="cairn"
REMOTE_DIR="/home/cairn/Cairn"
LOCAL_DIR="$(pwd)"

echo -e "${YELLOW}→${NC} Deploying to: ${GREEN}${VPS_HOST}${NC}"
echo ""

# Check if we're running on VPS or local
if [ "$(hostname)" = "$VPS_HOST" ] || [ "$VPS_HOST" = "localhost" ]; then
    echo -e "${GREEN}✓${NC} Running on VPS - local deployment mode"
    ON_VPS=true
else
    echo -e "${GREEN}✓${NC} Running on local machine - remote deployment mode"
    ON_VPS=false

    # Test SSH connection (allows password prompt)
    echo -e "${YELLOW}→${NC} Testing SSH connection..."
    echo "(Enter your VPS password when prompted)"
    if ! ssh -o ConnectTimeout=10 "$VPS_HOST" exit; then
        echo -e "${RED}✗${NC} Cannot connect to $VPS_HOST"
        echo "Check your VPS hostname/IP and try again"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} SSH connection successful"
fi

# Function to run commands on VPS
run_remote() {
    if [ "$ON_VPS" = true ]; then
        bash -c "$1"
    else
        ssh "$VPS_HOST" "$1"
    fi
}

# Step 1: Install system dependencies
echo ""
echo -e "${YELLOW}[1/8]${NC} Installing system dependencies..."

run_remote "
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo '  Installing Node.js...'
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo '  Node.js already installed'
    fi

    # Check if pnpm is installed
    if ! command -v pnpm &> /dev/null; then
        echo '  Installing pnpm...'
        sudo npm install -g pnpm
    else
        echo '  pnpm already installed'
    fi
"
echo -e "${GREEN}✓${NC} Dependencies installed"

# Step 2: Create cairn user if not exists
echo ""
echo -e "${YELLOW}[2/8]${NC} Setting up cairn user..."

run_remote "
    if ! id -u $REMOTE_USER &> /dev/null; then
        echo '  Creating cairn user...'
        sudo useradd -m -s /bin/bash $REMOTE_USER
    else
        echo '  User cairn already exists'
    fi
"
echo -e "${GREEN}✓${NC} User configured"

# Step 3: Upload code
echo ""
echo -e "${YELLOW}[3/8]${NC} Uploading code..."

if [ "$ON_VPS" = false ]; then
    # Sync from local to VPS
    rsync -avz --delete \
        --exclude 'node_modules' \
        --exclude 'data' \
        --exclude '.git' \
        --exclude 'dist' \
        --exclude '*.log' \
        "$LOCAL_DIR/" "$VPS_HOST:$REMOTE_DIR/"

    # Fix ownership
    ssh "$VPS_HOST" "sudo chown -R $REMOTE_USER:$REMOTE_USER $REMOTE_DIR"
else
    echo -e "${GREEN}✓${NC} Already on VPS, skipping upload"
fi
echo -e "${GREEN}✓${NC} Code synced"

# Step 4: Install dependencies and build
echo ""
echo -e "${YELLOW}[4/8]${NC} Installing dependencies and building..."

run_remote "
    cd $REMOTE_DIR
    sudo -u $REMOTE_USER pnpm install
    sudo -u $REMOTE_USER pnpm build
"
echo -e "${GREEN}✓${NC} Build complete"

# Step 5: Configure environment
echo ""
echo -e "${YELLOW}[5/8]${NC} Configuring environment..."

run_remote "
    cd $REMOTE_DIR

    # Check if .env exists
    if [ ! -f .env ]; then
        echo '  Creating .env file...'
        sudo -u $REMOTE_USER cat > .env << 'ENVEOF'
# Required
OPENAI_API_KEY=

# Optional
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=
PORT=3100
ENVEOF
        sudo -u $REMOTE_USER chmod 600 .env
        echo '  ⚠️  IMPORTANT: Edit /home/cairn/Cairn/.env with your API keys!'
    else
        echo '  .env already exists, skipping'
    fi
"
echo -e "${GREEN}✓${NC} Environment configured"

# Step 6: Create systemd services
echo ""
echo -e "${YELLOW}[6/8]${NC} Creating systemd services..."

run_remote "
    # Gateway service
    sudo tee /etc/systemd/system/cairn-gateway.service > /dev/null << 'EOF'
[Unit]
Description=Cairn Gateway
After=network.target

[Service]
Type=simple
User=$REMOTE_USER
WorkingDirectory=$REMOTE_DIR
Environment=\"NODE_ENV=production\"
ExecStart=/usr/bin/pnpm --filter @cairn/gateway start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Dashboard service
    sudo tee /etc/systemd/system/cairn-dashboard.service > /dev/null << 'EOF'
[Unit]
Description=Cairn Dashboard
After=network.target

[Service]
Type=simple
User=$REMOTE_USER
WorkingDirectory=$REMOTE_DIR
Environment=\"NODE_ENV=production\"
ExecStart=/usr/bin/pnpm --filter @cairn/dashboard start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd
    sudo systemctl daemon-reload
"
echo -e "${GREEN}✓${NC} Services created"

# Step 7: Set up backup script
echo ""
echo -e "${YELLOW}[7/8]${NC} Setting up automated backups..."

run_remote "
    sudo -u $REMOTE_USER tee /home/$REMOTE_USER/backup-cairn.sh > /dev/null << 'EOF'
#!/bin/bash
BACKUP_DIR=\"/home/$REMOTE_USER/backups\"
DATE=\$(date +%Y%m%d_%H%M%S)

mkdir -p \$BACKUP_DIR
tar -czf \$BACKUP_DIR/cairn-data-\$DATE.tar.gz -C $REMOTE_DIR data/

# Keep only last 7 backups
ls -t \$BACKUP_DIR/cairn-data-*.tar.gz | tail -n +8 | xargs rm -f

echo \"Backup complete: cairn-data-\$DATE.tar.gz\"
EOF

    sudo chmod +x /home/$REMOTE_USER/backup-cairn.sh

    # Add to crontab if not exists
    (sudo -u $REMOTE_USER crontab -l 2>/dev/null | grep -q backup-cairn.sh) || \
    (sudo -u $REMOTE_USER crontab -l 2>/dev/null; echo \"0 3 * * * /home/$REMOTE_USER/backup-cairn.sh\") | sudo -u $REMOTE_USER crontab -
"
echo -e "${GREEN}✓${NC} Backups configured (daily at 3am)"

# Step 8: Start services
echo ""
echo -e "${YELLOW}[8/8]${NC} Starting services..."

run_remote "
    sudo systemctl enable cairn-gateway cairn-dashboard
    sudo systemctl restart cairn-gateway cairn-dashboard
    sleep 2

    # Check status
    if systemctl is-active --quiet cairn-gateway && systemctl is-active --quiet cairn-dashboard; then
        echo '  ✓ Services started successfully'
    else
        echo '  ⚠️  Warning: Some services may not have started'
        echo '  Check status with: sudo systemctl status cairn-gateway cairn-dashboard'
    fi
"

# Final instructions
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Deployment Complete! 🎉            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Configure API keys:"
echo -e "   ${GREEN}ssh $VPS_HOST${NC}"
echo -e "   ${GREEN}sudo nano /home/cairn/Cairn/.env${NC}"
echo ""
echo "2. Restart services:"
echo -e "   ${GREEN}sudo systemctl restart cairn-gateway cairn-dashboard${NC}"
echo ""
echo "3. Create SSH tunnel:"
echo -e "   ${GREEN}./tunnel.sh $VPS_HOST${NC}"
echo ""
echo "4. Access Cairn:"
echo -e "   Gateway:   ${GREEN}http://localhost:3100${NC}"
echo -e "   Dashboard: ${GREEN}http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo -e "   View logs:      ${GREEN}ssh $VPS_HOST 'sudo journalctl -u cairn-gateway -f'${NC}"
echo -e "   Restart:        ${GREEN}ssh $VPS_HOST 'sudo systemctl restart cairn-gateway cairn-dashboard'${NC}"
echo -e "   Update deploy:  ${GREEN}./deploy.sh $VPS_HOST${NC}"
echo ""
