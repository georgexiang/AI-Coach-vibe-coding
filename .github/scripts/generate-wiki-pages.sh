#!/usr/bin/env bash
# Generate dynamic wiki page stats from codebase
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WIKI_DIR="$REPO_ROOT/wiki"

# Count items (|| true to prevent pipefail on missing dirs)
API_COUNT=$(find "$REPO_ROOT/backend/app/api" -name "*.py" ! -name "__init__*" ! -name "router*" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
MODEL_COUNT=$(find "$REPO_ROOT/backend/app/models" -name "*.py" ! -name "__init__*" ! -name "base*" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
BACKEND_TEST_COUNT=$(find "$REPO_ROOT/backend/tests" -name "test_*.py" 2>/dev/null | wc -l | tr -d ' ' || echo 0)

PAGE_COUNT=$(find "$REPO_ROOT/frontend/src/pages" -name "*.tsx" -o -name "*.ts" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
COMPONENT_COUNT=$(find "$REPO_ROOT/frontend/src/components/shared" -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
E2E_COUNT=$(find "$REPO_ROOT/frontend/e2e" -name "*.spec.ts" 2>/dev/null | wc -l | tr -d ' ' || echo 0)

SPEC_COUNT=$(find "$REPO_ROOT/docs/specs" -name "*.md" 2>/dev/null | wc -l | tr -d ' ' || echo 0)
PLAN_COUNT=$(find "$REPO_ROOT/docs/plans" -name "*.md" 2>/dev/null | wc -l | tr -d ' ' || echo 0)

echo "=== Project Stats ==="
echo "API Routers:     $API_COUNT"
echo "ORM Models:      $MODEL_COUNT"
echo "Backend Tests:   $BACKEND_TEST_COUNT"
echo "Pages:           $PAGE_COUNT"
echo "Components:      $COMPONENT_COUNT"
echo "E2E Tests:       $E2E_COUNT"
echo "Specifications:  $SPEC_COUNT"
echo "Plans:           $PLAN_COUNT"

# Update Home.md stats section using Python for portability (no sed quirks)
if [ -f "$WIKI_DIR/Home.md" ]; then
  python3 -c "
import sys
path = sys.argv[1]
stats = sys.argv[2:]
with open(path) as f:
    content = f.read()
start = '<!-- STATS_START -->'
end = '<!-- STATS_END -->'
if start in content and end in content:
    table = '''| Metric | Count |
|--------|-------|
| API Routers | {0} |
| ORM Models | {1} |
| Backend Tests | {2} |
| Pages | {3} |
| Shared Components | {4} |
| E2E Tests | {5} |
| Specifications | {6} |
| Plans | {7} |'''.format(*stats)
    before = content[:content.index(start) + len(start)]
    after = content[content.index(end):]
    with open(path, 'w') as f:
        f.write(before + '\n' + table + '\n' + after)
    print('Home.md stats updated')
else:
    print('Stats markers not found in Home.md')
" "$WIKI_DIR/Home.md" "$API_COUNT" "$MODEL_COUNT" "$BACKEND_TEST_COUNT" "$PAGE_COUNT" "$COMPONENT_COUNT" "$E2E_COUNT" "$SPEC_COUNT" "$PLAN_COUNT"
fi
