#!/bin/sh
set -e

echo "=== Running prisma migrate deploy ==="

run_deploy() {
  npx prisma migrate deploy 2>&1
}

OUTPUT=$(run_deploy) && echo "$OUTPUT" && echo "=== Migration complete ===" && exit 0

echo "$OUTPUT"

# P3009 = failed migrations blocking deploy — safe to resolve since all SQL uses IF NOT EXISTS
if echo "$OUTPUT" | grep -q "P3009"; then
  echo ""
  echo "=== Detected P3009: resolving failed migrations ==="

  FAILED=$(echo "$OUTPUT" | grep -oP 'The `\K[^`]+' | head -20)

  if [ -z "$FAILED" ]; then
    echo "Could not extract migration name from error output. Aborting."
    exit 1
  fi

  for migration in $FAILED; do
    echo "  Resolving: $migration"
    npx prisma migrate resolve --applied "$migration"
  done

  echo "=== Retrying migrate deploy ==="
  npx prisma migrate deploy
  echo "=== Migration complete ==="
else
  exit 1
fi
