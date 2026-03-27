#!/usr/bin/env bash
# Sync .planning/ artifacts to GitHub Projects V2
# Requires: GH_TOKEN, PROJECT_NUMBER
# Idempotent: uses [gsd:*] markers to avoid duplicate items
# Updates status based on [x]/[ ] checkboxes in ROADMAP.md
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

# --- Get Project ID and Status field ---
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

# --- Discover Status field and option IDs ---
STATUS_FIELD_ID=""
STATUS_TODO_ID=""
STATUS_IN_PROGRESS_ID=""
STATUS_DONE_ID=""

fields_json=$(gh api graphql -f query='
  query($pid: ID!) {
    node(id: $pid) {
      ... on ProjectV2 {
        fields(first: 30) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id name
              options { id name }
            }
          }
        }
      }
    }
  }' -f pid="$PROJECT_ID" 2>/dev/null)

STATUS_FIELD_ID=$(echo "$fields_json" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .id' 2>/dev/null || echo "")
if [ -n "$STATUS_FIELD_ID" ]; then
  STATUS_TODO_ID=$(echo "$fields_json" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == "Todo") | .id' 2>/dev/null || echo "")
  STATUS_IN_PROGRESS_ID=$(echo "$fields_json" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == "In Progress") | .id' 2>/dev/null || echo "")
  STATUS_DONE_ID=$(echo "$fields_json" | jq -r '.data.node.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == "Done") | .id' 2>/dev/null || echo "")
  echo "Status field: $STATUS_FIELD_ID (Todo=$STATUS_TODO_ID, InProgress=$STATUS_IN_PROGRESS_ID, Done=$STATUS_DONE_ID)"
fi

# --- Fetch existing items with IDs for dedup and update ---
declare -A EXISTING_ITEMS  # marker -> item_id

fetch_existing_items() {
  local cursor=""
  while true; do
    local result
    if [ -z "$cursor" ]; then
      result=$(gh api graphql -f query='
        query($pid: ID!) {
          node(id: $pid) {
            ... on ProjectV2 {
              items(first: 100) {
                pageInfo { hasNextPage endCursor }
                nodes { id content { ... on DraftIssue { title } } }
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
                nodes { id content { ... on DraftIssue { title } } }
              }
            }
          }
        }' -f pid="$PROJECT_ID" -f cursor="$cursor" 2>/dev/null)
    fi

    while IFS=$'\t' read -r item_id title; do
      if [ -n "$title" ]; then
        # Extract [gsd:*] marker from title
        local marker
        marker=$(echo "$title" | grep -oP '\[gsd:[^\]]+\]' 2>/dev/null || echo "")
        if [ -n "$marker" ]; then
          EXISTING_ITEMS["$marker"]="$item_id"
        fi
      fi
    done < <(echo "$result" | jq -r '.data.node.items.nodes[]? | "\(.id)\t\(.content.title? // "")"' 2>/dev/null)

    local has_next
    has_next=$(echo "$result" | jq -r '.data.node.items.pageInfo.hasNextPage' 2>/dev/null || echo "false")
    if [ "$has_next" != "true" ]; then break; fi
    cursor=$(echo "$result" | jq -r '.data.node.items.pageInfo.endCursor' 2>/dev/null)
  done
}

echo "Fetching existing project items..."
fetch_existing_items
echo "Found ${#EXISTING_ITEMS[@]} existing items with markers"

# --- Helper: set status on an item ---
set_item_status() {
  local item_id="$1"
  local status_option_id="$2"
  local label="$3"

  if [ -z "$STATUS_FIELD_ID" ] || [ -z "$status_option_id" ]; then
    return 0
  fi

  gh api graphql -f query='
    mutation($pid: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $pid
        itemId: $itemId
        fieldId: $fieldId
        value: { singleSelectOptionId: $optionId }
      }) { projectV2Item { id } }
    }' -f pid="$PROJECT_ID" -f itemId="$item_id" \
       -f fieldId="$STATUS_FIELD_ID" -f optionId="$status_option_id" \
       --silent 2>/dev/null \
    && echo "  STATUS -> $label" \
    || echo "  ERROR: Failed to set status on $item_id"
}

# --- Helper: create or update item ---
sync_item() {
  local title="$1"
  local marker="$2"
  local is_done="$3"  # "x" or " "

  local item_id="${EXISTING_ITEMS[$marker]:-}"

  if [ -z "$item_id" ]; then
    # Create new item
    item_id=$(gh api graphql -f query='
      mutation($pid: ID!, $title: String!) {
        addProjectV2DraftIssue(input: {
          projectId: $pid
          title: $title
        }) { projectItem { id } }
      }' -f pid="$PROJECT_ID" -f title="$title" \
      --jq '.data.addProjectV2DraftIssue.projectItem.id' 2>/dev/null || echo "")

    if [ -n "$item_id" ]; then
      echo "  CREATED: $title"
    else
      echo "  ERROR: Failed to create: $title"
      return 1
    fi
  else
    echo "  EXISTS: $marker"
  fi

  # Set status based on checkbox
  if [ -n "$item_id" ]; then
    if [ "$is_done" = "x" ]; then
      set_item_status "$item_id" "$STATUS_DONE_ID" "Done"
    else
      set_item_status "$item_id" "$STATUS_TODO_ID" "Todo"
    fi
  fi
}

# --- Parse phases from ROADMAP.md ---
echo "=== Syncing phases ==="
while IFS= read -r line; do
  if [[ "$line" =~ ^-\ \[([x\ ])\]\ \*\*Phase\ ([0-9]+(\.[0-9]+)?):\ (.+)\*\* ]]; then
    DONE_FLAG="${BASH_REMATCH[1]}"
    PHASE_NUM="${BASH_REMATCH[2]}"
    PHASE_TITLE="${BASH_REMATCH[4]}"
    PHASE_TITLE="${PHASE_TITLE%% - *}"
    MARKER="[gsd:phase-${PHASE_NUM}]"
    sync_item "[Phase ${PHASE_NUM}] ${PHASE_TITLE} ${MARKER}" "$MARKER" "$DONE_FLAG"
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
    DONE_FLAG="${BASH_REMATCH[1]}"
    PLAN_FILE="${BASH_REMATCH[2]}"
    PLAN_DESC="${BASH_REMATCH[4]}"
    PLAN_NUM="${PLAN_FILE%-PLAN.md}"
    MARKER="[gsd:plan-${PLAN_NUM}]"
    sync_item "[Phase ${CURRENT_PHASE}/Plan] ${PLAN_DESC} ${MARKER}" "$MARKER" "$DONE_FLAG"
  fi
done < "$ROADMAP"

echo "=== Planning project sync complete ==="
