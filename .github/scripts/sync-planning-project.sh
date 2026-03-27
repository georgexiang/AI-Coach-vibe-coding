#!/usr/bin/env bash
# Sync .planning/ artifacts to GitHub Projects V2
# Requires: GH_TOKEN, PROJECT_NUMBER
# Idempotent: uses [gsd:*] markers to avoid duplicate items
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLANNING_DIR="$REPO_ROOT/.planning"
OWNER="${GITHUB_REPOSITORY_OWNER:-huqianghui}"

if [ -z "${GH_TOKEN:-}" ] || [ -z "${PROJECT_NUMBER:-}" ]; then
  echo "Skipping project sync: GH_TOKEN or PROJECT_NUMBER not set"
  exit 0
fi

ROADMAP="$PLANNING_DIR/ROADMAP.md"
if [ ! -f "$ROADMAP" ]; then
  echo "No .planning/ROADMAP.md found, skipping"
  exit 0
fi

# --- Get Project ID ---
PROJECT_ID=$(gh api graphql -f query='
  query($owner: String!, $number: Int!) {
    user(login: $owner) {
      projectV2(number: $number) { id }
    }
  }' -f owner="$OWNER" -F number="$PROJECT_NUMBER" \
  --jq '.data.user.projectV2.id' 2>/dev/null || echo "")

if [ -z "$PROJECT_ID" ]; then
  echo "Could not find project #$PROJECT_NUMBER for $OWNER"
  exit 0
fi

echo "Project ID: $PROJECT_ID"

# --- Fetch existing items for dedup ---
fetch_existing_titles() {
  local cursor=""
  local all_titles=""
  while true; do
    local result
    if [ -z "$cursor" ]; then
      result=$(gh api graphql -f query='
        query($pid: ID!) {
          node(id: $pid) {
            ... on ProjectV2 {
              items(first: 100) {
                pageInfo { hasNextPage endCursor }
                nodes { content { ... on DraftIssue { title } } }
              }
            }
          }
        }' -f pid="$PROJECT_ID" 2>/dev/null)
    else
      result=$(gh api graphql -f query='
        query($pid: ID!, $cursor: String!) {
          node(id: $pid) {
            ... on ProjectV2 {
              items(first: 100, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                nodes { content { ... on DraftIssue { title } } }
              }
            }
          }
        }' -f pid="$PROJECT_ID" -f cursor="$cursor" 2>/dev/null)
    fi

    all_titles+=$(echo "$result" | jq -r '.data.node.items.nodes[]? | .content.title? // empty' 2>/dev/null)
    all_titles+=$'\n'

    local has_next
    has_next=$(echo "$result" | jq -r '.data.node.items.pageInfo.hasNextPage' 2>/dev/null || echo "false")
    if [ "$has_next" != "true" ]; then break; fi
    cursor=$(echo "$result" | jq -r '.data.node.items.pageInfo.endCursor' 2>/dev/null)
  done
  echo "$all_titles"
}

echo "Fetching existing project items..."
EXISTING=$(fetch_existing_titles)

# --- Helper: create item if marker not found ---
create_if_new() {
  local title="$1"
  local marker="$2"

  if echo "$EXISTING" | grep -qF "$marker"; then
    echo "  EXISTS: $marker"
    return 0
  fi

  gh api graphql -f query='
    mutation($pid: ID!, $title: String!) {
      addProjectV2DraftIssue(input: {
        projectId: $pid
        title: $title
      }) { projectItem { id } }
    }' -f pid="$PROJECT_ID" -f title="$title" --silent 2>/dev/null \
    && echo "  CREATED: $title" \
    || echo "  ERROR: Failed to create: $title"
}

# --- Parse phases from ROADMAP.md ---
echo "=== Syncing phases ==="
while IFS= read -r line; do
  if [[ "$line" =~ ^-\ \[([x\ ])\]\ \*\*Phase\ ([0-9]+(\.[0-9]+)?):\ (.+)\*\* ]]; then
    PHASE_NUM="${BASH_REMATCH[2]}"
    PHASE_TITLE="${BASH_REMATCH[4]}"
    PHASE_TITLE="${PHASE_TITLE%% - *}"
    MARKER="[gsd:phase-${PHASE_NUM}]"
    create_if_new "[Phase ${PHASE_NUM}] ${PHASE_TITLE} ${MARKER}" "$MARKER"
  fi
done < "$ROADMAP"

# --- Parse plans from ROADMAP.md ---
echo "=== Syncing plans ==="
CURRENT_PHASE=""
while IFS= read -r line; do
  if [[ "$line" =~ ^###\ Phase\ ([0-9]+(\.[0-9]+)?): ]]; then
    CURRENT_PHASE="${BASH_REMATCH[1]}"
  fi
  if [ -n "$CURRENT_PHASE" ] && [[ "$line" =~ ^-\ \[([x\ ])\]\ ([0-9]+(\.[0-9]+)?-[0-9]+-PLAN\.md)\ --\ (.+) ]]; then
    PLAN_FILE="${BASH_REMATCH[2]}"
    PLAN_DESC="${BASH_REMATCH[4]}"
    PLAN_NUM="${PLAN_FILE%-PLAN.md}"
    MARKER="[gsd:plan-${PLAN_NUM}]"
    create_if_new "[Phase ${CURRENT_PHASE}/Plan] ${PLAN_DESC} ${MARKER}" "$MARKER"
  fi
done < "$ROADMAP"

echo "=== Planning project sync complete ==="
