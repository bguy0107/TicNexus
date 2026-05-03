#!/bin/sh
set -e

echo "Running database migrations..."
node_modules/prisma/build/index.js migrate deploy

echo "Initialising admin user..."
node_modules/.bin/tsx prisma/init-admin.ts

echo "Starting TicNexus..."
exec node server.js
