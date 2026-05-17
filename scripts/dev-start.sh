#!/usr/bin/env bash
set -e

# ── 1. Ensure .env exists ────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "📋  No .env found — copying from .env.local.example"
  cp .env.local.example .env
  echo "    Edit .env if you need custom values, then re-run."
fi

# ── 2. Kill anything holding port 3000 ──────────────────────────────────────
if lsof -ti:3000 > /dev/null 2>&1; then
  echo "🔪  Killing existing process on port 3000"
  kill $(lsof -ti:3000)
  sleep 1
fi

# ── 3. Start the database container ─────────────────────────────────────────
echo "🐘  Starting database..."
docker compose up -d db

# Wait until healthy (up to 30 s)
echo "⏳  Waiting for DB to be healthy..."
for i in $(seq 1 30); do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' ticnexus-db-1 2>/dev/null || echo "missing")
  if [ "$STATUS" = "healthy" ]; then
    break
  fi
  sleep 1
done

if [ "$STATUS" != "healthy" ]; then
  echo "❌  Database did not become healthy in time. Check: docker compose logs db"
  exit 1
fi

# ── 4. Apply migrations ──────────────────────────────────────────────────────
echo "🗄️   Running migrations..."
npx prisma migrate deploy

# ── 5. Seed admin account if missing ─────────────────────────────────────────
echo "👤  Ensuring admin account exists..."
npx tsx prisma/init-admin.ts

# ── 6. Start the dev server ──────────────────────────────────────────────────
echo "🚀  Starting dev server..."
npm run dev
