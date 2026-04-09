---
status: awaiting_human_verify
trigger: "Every time HCP profile is saved, platform stores agent version N but Azure AI Foundry shows version N+1. Example: platform shows v14, Foundry shows v15."
created: 2026-04-09T00:00:00Z
updated: 2026-04-09T14:30:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED -- Removed agent_version write-back from all 4 update_agent_metadata_only callers in voice_live_instance_service.py. All 66 relevant tests pass. DB version for Dr-Wang-Fang manually corrected to match Foundry.
test: All unit tests pass (66 passed). Lint and format pass. DB version reconciled.
expecting: Next HCP profile save will produce matching version between platform and Foundry.
next_action: Await human verification that the off-by-one no longer occurs after a real HCP save.

## Symptoms

expected: After HCP profile save, the agent version shown on the platform should match the version shown in Azure AI Foundry Portal.
actual: Platform shows Agent Version = 14, but AI Foundry Portal shows Version = 15 for the same agent "Dr-Wang-Fang". The offset is consistently +1.
errors: No errors -- the save succeeds, but version numbers don't match.
reproduction: 1) Open HCP Profile editor for Dr. Wang Fang (cb6bce84-5cbc-49c5-8624-f5d56fc5255e) 2) Make any change and click Save Profile 3) Platform sidebar shows Agent Version = 14 4) Check AI Foundry Portal -> Agent "Dr-Wang-Fang" shows Version = 15
started: Pattern observed after the recent fix that added version tracking to update_agent_metadata_only. The +1 offset has been consistent.

## Eliminated

- hypothesis: SDK create_version returns 0-based version while Foundry uses 1-based
  evidence: Tested fresh agent creation -- SDK returns 1, 2, 3 matching Foundry display. No 0-based offset.
  timestamp: 2026-04-09T13:20

- hypothesis: Single create_version call stores wrong version
  evidence: create_version returns the NEWLY created version number. Verified with fresh agent and with Dr-Wang-Fang agent.
  timestamp: 2026-04-09T13:22

## Evidence

- timestamp: 2026-04-09T13:20
  checked: Azure SDK AgentVersionDetails model
  found: create_version returns AgentVersionDetails with `version` field described as "The version identifier of the agent. Agents are immutable and every update creates a new version." The SDK returns the NEWLY created version, not the previous one.
  implication: The returned version should match what Foundry shows.

- timestamp: 2026-04-09T13:22
  checked: Azure create_version idempotency behavior
  found: If content (instructions+metadata) is identical, create_version returns the EXISTING version without incrementing. Only changes to definition or metadata trigger a new version.
  implication: The modified_at timestamp in VL metadata changes every call, so each call with VL metadata always creates a new version.

- timestamp: 2026-04-09T13:25
  checked: DB value vs Azure value for Dr-Wang-Fang
  found: DB has agent_version="14", Azure latest version=15 (before my test). Confirmed off-by-one.
  implication: Something created v15 without updating the DB.

- timestamp: 2026-04-09T13:28
  checked: Full version history of Dr-Wang-Fang agent (list_versions)
  found: v14 created_at=13:12:48 desc="" (update_agent_metadata_only pattern), v15 created_at=13:12:49 desc="HCP Agent: Dr. Wang Fang" (update_agent pattern). Created 1 second apart. Same instructions, same VL config, only modified_at timestamp differs.
  implication: TWO create_version calls happened during the same user action. First update_agent_metadata_only (v14), then update_agent (v15).

- timestamp: 2026-04-09T13:30
  checked: Frontend agent-config-left-panel.tsx VL dropdown handler
  found: When user selects VL instance in HCP editor dropdown, assignMutation.mutate() fires immediately (POST /voice-live/instances/{id}/assign). This calls assign_to_hcp -> update_agent_metadata_only -> creates Foundry version. Then user clicks Save -> update_hcp_profile -> sync_agent_for_profile -> update_agent -> creates another Foundry version.
  implication: The assign call is the source of the extra version. It runs concurrently with the save.

- timestamp: 2026-04-09T13:32
  checked: assign_to_hcp DB commit pattern (voice_live_instance_service.py:184-205)
  found: assign_to_hcp commits VL assignment at line 184 (db.commit()), then later flushes agent_version at line 205 (db.flush()). This second transaction commits when the request ends. If the save request commits its agent_version BEFORE the assign's second transaction commits, the assign overwrites the save's newer version.
  implication: Concurrent DB writes cause the older version (from assign) to overwrite the newer version (from save). This is the root cause of the off-by-one.

## Resolution

root_cause: When the VL instance dropdown is changed in the HCP editor, the frontend fires POST assign_to_hcp (which calls update_agent_metadata_only -> create_version -> v14) AND then PUT update_hcp_profile (which calls sync_agent_for_profile -> update_agent -> create_version -> v15). Both write profile.agent_version to the DB. Due to concurrent transaction commits, the assign's older version (14) overwrites the save's newer version (15). The fix from the previous debug session (adding version write-back to update_agent_metadata_only callers) actually INTRODUCED this race condition.
fix: Remove profile.agent_version write-back from update_agent_metadata_only callers in voice_live_instance_service.py. The authoritative version is set only by sync_agent_for_profile (full profile sync). Metadata-only updates sync VL config to Foundry but do not update the platform's stored version -- the next full sync will reconcile.
verification: All 66 unit tests pass (34 VL service + 32 agent sync). Ruff lint+format clean. DB version for Dr-Wang-Fang corrected from 14 to 16 (current Foundry latest). Awaiting human verification of real HCP save flow.
files_changed: [backend/app/services/voice_live_instance_service.py]
