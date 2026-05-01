#!/bin/sh
set -e

echo "Running database migrations..."
node_modules/prisma/build/index.js migrate deploy

echo "Starting TicNexus..."
exec node server.js
