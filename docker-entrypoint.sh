#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL is required to run migrations and start the app." >&2
  exit 1
fi

./node_modules/.bin/prisma migrate deploy

exec node server.js
