# Deployment Guide

## Quick Deploy (VPS or Raspberry Pi)

### Prerequisites
- Node.js 18+
- pnpm

### Steps

```bash
# 1. Clone and install
git clone <repo> cairn
cd cairn
pnpm install

# 2. Configure
cp .env.example .env
# Edit .env with your OPENAI_API_KEY

# 3. Build
pnpm build

# 4. Run
pnpm start:prod
```

---

## Production Setup

### Option A: PM2 (recommended for Pi)
```bash
npm install -g pm2
pm2 start "pnpm start:prod" --name cairn
pm2 save
pm2 startup
```

### Option B: Systemd (VPS)
```ini
# /etc/systemd/system/cairn.service
[Unit]
Description=Cairn AI Agent
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/cairn
ExecStart=/usr/bin/node apps/gateway/dist/index.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable cairn
sudo systemctl start cairn
```

---

## Dashboard (Static Build)

The dashboard is a static site. Build and serve:

```bash
cd apps/dashboard
pnpm build
# Serve dist/ with nginx, caddy, or any static host
```

### Nginx Example
```nginx
server {
    listen 80;
    server_name cairn.yourdomain.com;

    # Dashboard static files
    location / {
        root /path/to/cairn/apps/dashboard/dist;
        try_files $uri /index.html;
    }

    # Proxy API and WebSocket to gateway
    location /ws {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /health {
        proxy_pass http://127.0.0.1:3100;
    }
}
```

---

## Data Backup

All state is in `data/`:
```bash
tar -czvf cairn-backup.tar.gz data/
```

To restore, extract to new server's `data/` directory.
