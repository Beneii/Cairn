# Cairn Deployment Guide

## Quick Deploy to VPS

### 1. Deploy
```bash
./deploy.sh your-vps-hostname
```

This automated script will:
- Install Node.js and pnpm
- Create cairn user
- Upload code
- Build all packages
- Configure systemd services
- Set up daily backups
- Start services

### 2. Configure API Keys
```bash
ssh your-vps
sudo nano /home/cairn/Cairn/.env
```

Add your keys:
```env
OPENAI_API_KEY=sk-your-key-here
TELEGRAM_BOT_TOKEN=your-token
TELEGRAM_ADMIN_CHAT_ID=your-chat-id
```

Then restart:
```bash
sudo systemctl restart cairn-gateway cairn-dashboard
```

### 3. Connect via Tunnel
```bash
./tunnel.sh your-vps-hostname
```

Leave this terminal open. Access:
- Gateway: http://localhost:3100
- Dashboard: http://localhost:5173

## Management Commands

### View Logs
```bash
ssh your-vps 'sudo journalctl -u cairn-gateway -f'
ssh your-vps 'sudo journalctl -u cairn-dashboard -f'
```

### Restart Services
```bash
ssh your-vps 'sudo systemctl restart cairn-gateway cairn-dashboard'
```

### Update Deployment
```bash
./deploy.sh your-vps-hostname
```

### Manual Backup
```bash
ssh your-vps '/home/cairn/backup-cairn.sh'
```

### Download Backup
```bash
scp your-vps:/home/cairn/backups/cairn-data-*.tar.gz ./
```

## Troubleshooting

### Services Not Starting
```bash
ssh your-vps 'sudo systemctl status cairn-gateway'
ssh your-vps 'sudo journalctl -u cairn-gateway -n 50'
```

### Rebuild After Code Changes
```bash
ssh your-vps 'cd /home/cairn/Cairn && sudo -u cairn pnpm build'
ssh your-vps 'sudo systemctl restart cairn-gateway cairn-dashboard'
```

### Check VPS Resources
```bash
ssh your-vps 'htop'
ssh your-vps 'df -h'
```
