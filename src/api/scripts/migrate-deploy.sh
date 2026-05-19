#!/bin/sh
set -e

echo "=== Running prisma migrate deploy ==="
npx prisma migrate deploy
echo "=== Migration complete ==="
