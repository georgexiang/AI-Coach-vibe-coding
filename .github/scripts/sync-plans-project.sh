#!/usr/bin/env bash
# Sync docs/plans/ markdown tasks to GitHub Project V2
# Requires: GH_TOKEN, PROJECT_NUMBER
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLANS_DIR="$REPO_ROOT/docs/plans"
OWNER="${GITHUB_REPOSITORY_OWNER:-huqianghui}"
REPO_NAME=$(basename "$GITHUB_REPOSITORY" 2>/dev/null || basename "$REPO_ROOT")

if [ -z "${GH_TOKEN:-}" ] || [ -z "${PROJECT_NUMBER:-}" ]; then
  echo "Skipping project sync: GH_TOKEN or PROJECT_NUMBER not set"
  exit 0
fi

if [ ! -d "$PLANS_DIR" ]; then
  echo "No plans directory found, skipping"
  exit 0
fi

echo "=== Syncing plans to GitHub Project #$PROJECT_NUMBER ==="

# Get project ID
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

# Parse tasks from plan files and create/update items
TASK_NUM=0
for plan_file in "$PLANS_DIR"/*.md; do
  [ -f "$plan_file" ] || continue
  PLAN_NAME=$(basename "$plan_file" .md)
  echo "Processing plan: $PLAN_NAME"

  # Extract tasks (lines matching "### Task N:" or "- [ ]" or "- [x]")
  while IFS= read -r line; do
    if [[ "$line" =~ ^###[[:space:]]+Task[[:space:]]+([0-9]+):[[:space:]]+(.*) ]]; then
      TASK_NUM=$((TASK_NUM + 1))
      TASK_TITLE="${BASH_REMATCH[2]}"
      MARKER="[ai-coach:${PLAN_NAME}:task-${TASK_NUM}]"

      echo "  Task $TASK_NUM: $TASK_TITLE"

      # Create draft issue in project
      gh api graphql -f query='
        mutation($projectId: ID!, $title: String!) {
          addProjectV2DraftIssue(input: {
            projectId: $projectId
            title: $title
          }) { projectItem { id } }
        }' -f projectId="$PROJECT_ID" \
           -f title="[$PLAN_NAME] $TASK_TITLE $MARKER" \
           --silent 2>/dev/null || echo "    (item may already exist)"
    fi
  done < "$plan_file"
done

echo "=== Sync complete: $TASK_NUM tasks processed ==="
