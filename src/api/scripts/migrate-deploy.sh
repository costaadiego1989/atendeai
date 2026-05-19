#!/bin/sh
set -e

echo "=== Checking migration status ==="
STATUS=$(npx prisma migrate status 2>&1) || true
echo "$STATUS"

# Auto-resolve failed migrations before deploying (guards against P3009)
if echo "$STATUS" | grep -q " failed"; then
  echo "=== Found failed migrations — resolving as rolled-back ==="
  echo "$STATUS" | grep " failed" | sed "s/.*The \`//;s/\` migration.*//" | while read -r mig; do
    if [ -n "$mig" ]; then
      echo "Resolving: $mig"
      npx prisma migrate resolve --rolled-back "$mig"
    fi
  done
fi

echo "=== Running prisma migrate deploy ==="
npx prisma migrate deploy
echo "=== Migration complete ==="
