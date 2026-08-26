#!/usr/bin/env bash
# Dev-only helper: starts a throwaway PostgreSQL in /tmp for sandbox previews.
# Production databases are NOT managed by this script — use your host's Postgres.
set -e
PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | head -1)
if [ -z "$PGBIN" ]; then
  echo "Installing PostgreSQL..."
  apt-get install -y postgresql >/dev/null 2>&1 || sudo apt-get install -y postgresql >/dev/null 2>&1
  PGBIN=$(ls -d /usr/lib/postgresql/*/bin | head -1)
fi
if ! pg_isready -h 127.0.0.1 -p 5433 >/dev/null 2>&1; then
  [ -d /tmp/pgdata ] || $PGBIN/initdb -D /tmp/pgdata -U postgres --auth=trust >/dev/null 2>&1
  mkdir -p /tmp/pgrun
  $PGBIN/pg_ctl -D /tmp/pgdata -o "-c listen_addresses=127.0.0.1 -p 5433 -c unix_socket_directories=/tmp/pgrun" -l /tmp/pg.log start >/dev/null
  sleep 2
fi
psql -h 127.0.0.1 -p 5433 -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='sellwave'" | grep -q 1 \
  || psql -h 127.0.0.1 -p 5433 -U postgres -c "CREATE DATABASE sellwave" >/dev/null
cd "$(dirname "$0")/../server"
npx prisma migrate deploy
npx tsx prisma/seed.ts
echo "Dev database ready on 127.0.0.1:5433"
