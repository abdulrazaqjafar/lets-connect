#!/bin/bash
# Run on EC2: bash deploy/ec2-migrate.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Ensuring schema (prisma db push via migrate profile)"
sudo docker compose --profile migrate run --rm migrate

echo "==> Seeding plans + demo owner (optional)"
sudo docker compose --profile migrate run --rm \
  -e DATABASE_URL=postgresql://postgres:postgres@postgres:5432/lets_connect?schema=public \
  migrate bash -lc 'npx tsx prisma/seed.ts' 2>/dev/null || \
sudo docker run --rm --network lets-connect_default \
  -e DATABASE_URL=postgresql://postgres:postgres@lets-connect-db:5432/lets_connect?schema=public \
  -v "$PWD":/app -w /app node:22-bookworm-slim \
  bash -lc 'apt-get update -qq && apt-get install -y -qq openssl >/dev/null && npm ci --ignore-scripts && npx prisma db push --skip-generate && npx tsx prisma/seed.ts'

echo "==> Tables:"
sudo docker exec lets-connect-db psql -U postgres -d lets_connect -c '\dt'

echo "Done. Try register again at http://18.199.177.29/register"
