---
status: awaiting_human_verify
trigger: "During dry run evaluation, both AI-MR and AI-HCP agents return placeholder text instead of actual AI-generated conversation content"
created: 2026-04-27T00:00:00Z
updated: 2026-04-27T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - root cause was pre-fix code + unsynced agents. Robustness fix applied and verified.
test: All 54 tests pass including new test_simulation_mid_abort_on_consecutive_failures
expecting: User confirms new dry run produces real content
next_action: Await human verification

## Symptoms

expected: Dry run should produce actual AI-generated conversation between MR and HCP agents, with real dialogue content
actual: All messages show "[mr unavailable -- simulation continues]" for MR and "[hcp unavailable -- simulation continues]" for HCP. Score is 10/100, SOP coverage 0/5, 5 warnings.
errors: No explicit errors visible in UI - the simulation completes successfully but with placeholder content
reproduction: Run a dry run evaluation on any skill (tested on skill a7c5e171-05c7-4f35-890e-2623c840e958, run c2e9231f-d1a3-4de8-a95b-b815e3c0bc9e)
started: After dry run engine refactor to Azure AI Foundry agents (commit 17bf95a)

## Eliminated

- hypothesis: Model mismatch between MetaSkill.model and actual Azure deployment
  evidence: Both MetaSkill and master config use "gpt-5.4-mini". Successful run e801e4f1 used same model.
  timestamp: 2026-04-27T00:00:30Z

- hypothesis: Agent IDs not synced to Azure Foundry
  evidence: Current DB shows agent_id="skill-dry-run-mr" with version="1". Successful run e801e4f1 used these IDs.
  timestamp: 2026-04-27T00:00:35Z

- hypothesis: Project endpoint misconfiguration
  evidence: get_project_endpoint resolves to correct endpoint with project "avarda-demo-prj". Same path used by working chat_with_agent.
  timestamp: 2026-04-27T00:00:40Z

## Evidence

- timestamp: 2026-04-27T00:00:10Z
  checked: DB dry_runs table for failing run c2e9231f
  found: mr_agent_id and hcp_agent_id are EMPTY. Status is "completed" with score 10, coverage 0%.
  implication: Agent audit fields were not set, meaning either code was missing or agents weren't synced at time of run.

- timestamp: 2026-04-27T00:00:15Z
  checked: DB dry_run_messages for c2e9231f
  found: All 20 messages contain fallback text "[mr unavailable -- simulation continues]" / "[hcp unavailable -- simulation continues]". agent_label was "mr"/"hcp" not "skill-dry-run-mr".
  implication: MetaSkill agent_id was literally "mr"/"hcp" (not valid Foundry names) at time of run.

- timestamp: 2026-04-27T00:00:20Z
  checked: Timestamps - failing run created 2026-04-26T23:49:41, fix commit 785d11e at 2026-04-27T08:39:12
  found: Failing run was created 9 hours BEFORE the fix commit that switched from chat.completions.create to responses.create.
  implication: The failing run used pre-fix code (chat.completions.create which silently fails with Foundry). Early abort was not present.

- timestamp: 2026-04-27T00:00:25Z
  checked: Successful run e801e4f1 created at 2026-04-27T01:38:49 (also pre-fix but post-sync)
  found: Has real content (Chinese dialogue), score 92, mr_agent_id="skill-dry-run-mr". This succeeded because agents were properly synced by then.
  implication: The API was working once agents were synced, even before the responses.create fix. The key issue was the agent_id values.

- timestamp: 2026-04-27T00:00:45Z
  checked: Current code for remaining vulnerabilities
  found: Early abort only fires on turn 0 (line 516). If turn 0 succeeds but subsequent turns fail, simulation continues accumulating fallback text without aborting. No consecutive failure detection.
  implication: Residual robustness gap - partial failures can still produce poor-quality completed runs.

## Resolution

root_cause: The failing dry run c2e9231f was executed before commit 785d11e fixed the API call method (chat.completions.create -> responses.create). Additionally, MetaSkill agent_ids were not properly set (values were "mr"/"hcp" instead of valid Foundry names "skill-dry-run-mr"/"skill-dry-run-hcp"). The combination of wrong API method + invalid agent names caused all calls to silently fail and return fallback text. The early abort (which would prevent completing garbage runs) was not yet implemented. Residual gap: current code only aborts on turn-0 failure, not on consecutive mid-simulation failures.
fix: Added consecutive failure detection (_MAX_CONSECUTIVE_FAILURES=2) to dry_run_engine.py. If 2+ consecutive turns return fallback text mid-simulation, the run aborts with status="failed" and a clear error message. This closes the gap where only turn-0 failures were caught.
verification: All 54 tests pass (including new test_simulation_mid_abort_on_consecutive_failures). Ruff lint and format checks pass.
files_changed: [backend/app/services/dry_run_engine.py, backend/tests/test_dry_run.py]
