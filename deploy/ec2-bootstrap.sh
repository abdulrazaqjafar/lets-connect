#!/bin/bash
# Run on EC2 after project files are in ~/lets-connect
set -euo pipefail
cd ~/lets-connect

echo "==> Opening compose stack (Postgres + FreeRADIUS + Web)"
sudo docker compose down --remove-orphans || true
sudo docker compose up -d --build

echo "==> Waiting for web..."
sleep 8
sudo docker compose ps
sudo docker logs lets-connect-web --tail 40 || true

echo "==> Done. Open http://18.199.177.29/  and http://18.199.177.29/portal"
echo "==> Point DNS A record tech-spherewifi.xyz -> 18.199.177.29"
