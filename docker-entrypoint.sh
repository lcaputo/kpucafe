#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required to run migrations and start the app." >&2
  exit 1
fi

if ! migrate_output="$(./node_modules/.bin/prisma migrate deploy 2>&1)"; then
  echo "$migrate_output" >&2

  if echo "$migrate_output" | grep -q "P3005"; then
    echo "Database is not empty and has no Prisma migration history. Baselining 0001_init..." >&2
    ./node_modules/.bin/prisma migrate resolve --applied 0001_init
    ./node_modules/.bin/prisma migrate deploy
  else
    exit 1
  fi
fi

exec node server.js
