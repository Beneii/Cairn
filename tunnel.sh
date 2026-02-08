#!/bin/bash

# Cairn SSH Tunnel Script
# Usage: ./tunnel.sh [VPS_HOST]

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get VPS host
if [ -z "$1" ]; then
    read -p "Enter VPS hostname/IP: " VPS_HOST
else
    VPS_HOST=$1
fi

echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Cairn SSH Tunnel                     ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}→${NC} Creating tunnel to: ${GREEN}${VPS_HOST}${NC}"
echo ""
echo "Access Cairn at:"
echo -e "  Gateway:   ${GREEN}http://localhost:3100${NC}"
echo -e "  Dashboard: ${GREEN}http://localhost:5173${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the tunnel${NC}"
echo ""

# Create SSH tunnel
ssh -N -L 3100:localhost:3100 -L 5173:localhost:5173 "$VPS_HOST"
