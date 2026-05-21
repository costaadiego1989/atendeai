#!/bin/sh
set -e

echo "=== Running prisma migrate deploy ==="

OUTPUT=$(npx prisma migrate deploy 2>&1) && echo "$OUTPUT" && echo "=== Migration complete ===" && exit 0

echo "$OUTPUT"

# P3009 = migration recorded as failed (process was killed before Prisma could mark it as applied).
# Use --rolled-back so Prisma re-runs the SQL on next deploy.
# Safe because all migrations use IF NOT EXISTS (idempotent).
if echo "$OUTPUT" | grep -q "P3009"; then
  echo ""
  echo "=== P3009 detected: rolling back failed migrations so they re-run ==="

  FAILED=$(echo "$OUTPUT" | grep -oP 'The `\K[^`]+')

  if [ -z "$FAILED" ]; then
    echo "Could not extract migration name from error. Aborting."
    exit 1
  fi

  for migration in $FAILED; do
    echo "  Rolling back: $migration"
    npx prisma migrate resolve --rolled-back "$migration"
  done

  echo "=== Retrying migrate deploy ==="
  npx prisma migrate deploy
  echo "=== Migration complete ==="
else
  exit 1
fi
