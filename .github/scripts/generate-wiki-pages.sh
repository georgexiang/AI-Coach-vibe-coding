#!/usr/bin/env bash
# Generate dynamic wiki page stats from codebase
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WIKI_DIR="$REPO_ROOT/wiki"

# Count backend items
API_COUNT=$(find "$REPO_ROOT/backend/app/api" -name "*.py" ! -name "__init__*" ! -name "router*" 2>/dev/null | wc -l | tr -d ' ')
MODEL_COUNT=$(find "$REPO_ROOT/backend/app/models" -name "*.py" ! -name "__init__*" ! -name "base*" 2>/dev/null | wc -l | tr -d ' ')
BACKEND_TEST_COUNT=$(find "$REPO_ROOT/backend/tests" -name "test_*.py" 2>/dev/null | wc -l | tr -d ' ')

# Count frontend items
PAGE_COUNT=$(find "$REPO_ROOT/frontend/src/pages" -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
COMPONENT_COUNT=$(find "$REPO_ROOT/frontend/src/components/shared" -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
E2E_COUNT=$(find "$REPO_ROOT/frontend/e2e" -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ')

# Count docs
SPEC_COUNT=$(find "$REPO_ROOT/docs/specs" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
PLAN_COUNT=$(find "$REPO_ROOT/docs/plans" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')

echo "=== Project Stats ==="
echo "API Routers:     $API_COUNT"
echo "ORM Models:      $MODEL_COUNT"
echo "Backend Tests:   $BACKEND_TEST_COUNT"
echo "Pages:           $PAGE_COUNT"
echo "Components:      $COMPONENT_COUNT"
echo "E2E Tests:       $E2E_COUNT"
echo "Specifications:  $SPEC_COUNT"
echo "Plans:           $PLAN_COUNT"

# Update Home.md stats section
if [ -f "$WIKI_DIR/Home.md" ]; then
  # Replace the stats block between markers
  sed -i.bak '/<!-- STATS_START -->/,/<!-- STATS_END -->/{
    /<!-- STATS_START -->/!{/<!-- STATS_END -->/!d;}
    /<!-- STATS_START -->/a\
| Metric | Count |\
|--------|-------|\
| API Routers | '"$API_COUNT"' |\
| ORM Models | '"$MODEL_COUNT"' |\
| Backend Tests | '"$BACKEND_TEST_COUNT"' |\
| Pages | '"$PAGE_COUNT"' |\
| Shared Components | '"$COMPONENT_COUNT"' |\
| E2E Tests | '"$E2E_COUNT"' |\
| Specifications | '"$SPEC_COUNT"' |\
| Plans | '"$PLAN_COUNT"' |
  }' "$WIKI_DIR/Home.md"
  rm -f "$WIKI_DIR/Home.md.bak"
  echo "Home.md stats updated"
fi
