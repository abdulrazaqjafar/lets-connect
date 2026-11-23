#!/bin/sh
set -e

echo "[web] Applying Prisma schema..."
npx prisma db push --skip-generate

echo "[web] Starting Next.js on :3000..."
exec node server.js
