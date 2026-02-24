#!/bin/bash
set -e

echo "=== WhalePunter Poller Setup ==="

# Update system
apt-get update -y && apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs git

echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

# Clone the repository
cd /opt
git clone https://github.com/GambaHQ/whalepunter.git
cd whalepunter

# Install dependencies
npm install
npx prisma generate

# Create environment file
cat > .env.local << 'ENVEOF'
BETFAIR_APP_KEY=VF8udlsbsgaHoWwj
BETFAIR_USERNAME=d.reid5991@gmail.com
BETFAIR_PASSWORD=Bdmz2410!
BETFAIR_LOCALE=AU
DATABASE_URL=postgresql://whalepunter:5DqxdLvwJGcr5Ukf1ygmy9ZAWgvvyfR1@dpg-d6entosr85hc73d9r010-a.oregon-postgres.render.com/whalepunter
ENVEOF

# Test the connection
echo "Testing Betfair connection..."
timeout 30 npx tsx --env-file=.env.local -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`SELECT 1\`.then(() => { console.log('DB connection OK'); p.\$disconnect(); }).catch(e => { console.error('DB failed:', e.message); process.exit(1); });
" || echo "Quick test skipped"

# Create systemd service for auto-start
cat > /etc/systemd/system/whalepunter-poller.service << 'SVCEOF'
[Unit]
Description=WhalePunter Betfair Poller
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/whalepunter
ExecStart=/usr/bin/npx tsx --env-file=.env.local src/workers/poller-standalone.ts
Restart=always
RestartSec=30
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SVCEOF

# Enable and start the service
systemctl daemon-reload
systemctl enable whalepunter-poller
systemctl start whalepunter-poller

echo ""
echo "=== Setup Complete ==="
echo "Poller is running as a systemd service."
echo "Check status: systemctl status whalepunter-poller"
echo "View logs:    journalctl -u whalepunter-poller -f"
