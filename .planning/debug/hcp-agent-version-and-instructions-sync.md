---
status: fixing
trigger: "HCP Profile Dr. Wang Fang has two sync problems: (1) Agent version mismatch v11 vs v12, (2) Instructions truncation missing Background section"
created: 2026-04-09T00:00:00Z
updated: 2026-04-09T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Two root causes: (1) update_agent_metadata_only creates new Foundry agent versions without updating profile.agent_version, causing version drift. (2) update_agent_metadata_only re-sends instructions via fragile read-back pattern with no verification. Test gap: no test verifies instruction preservation through metadata-only update.
test: Fix update_agent_metadata_only to return the new version, update callers to propagate version back to profile
expecting: After fix, version stays in sync and instructions are verified through preserved tests
next_action: Implement fix for version drift and add instruction verification

## Symptoms

expected: After saving HCP profile, the corresponding AI Foundry agent should have (a) the full instructions including Background section, (b) platform should show the latest version from Foundry
actual: (a) Foundry agent v12 has truncated instructions missing Background section, (b) Platform still shows v11 while Foundry is at v12
errors: No explicit errors - sync appears to succeed but data is incomplete
reproduction: 1) Open HCP profile cb6bce84 2) Check Auto-generated Instructions 3) Save profile 4) Check AI Foundry agent - instructions truncated, version not synced back
started: Since agent sync implementation - version read-back was likely never implemented correctly

## Eliminated

## Evidence

- timestamp: 2026-04-09T00:01:00Z
  checked: DEFAULT_AGENT_TEMPLATE in agent_sync_service.py
  found: Template DOES include Background section with {hospital}, {title}, {expertise_areas}, {prescribing_habits}, {concerns} placeholders
  implication: Template itself is correct - truncation must come from data or runtime behavior

- timestamp: 2026-04-09T00:02:00Z
  checked: HcpProfile.to_prompt_dict() in hcp_profile.py
  found: Returns hospital, title, prescribing_habits, concerns as direct string fields, expertise_areas/objections/probe_topics as json.loads() lists
  implication: All fields needed for Background section ARE provided by to_prompt_dict()

- timestamp: 2026-04-09T00:03:00Z
  checked: build_agent_instructions() logic
  found: Uses defaultdict(lambda: "", data) for safe missing-key handling, then format_map on template. If any field is missing from profile_data, it gets empty string replacement
  implication: Even missing fields would render as empty but the section headers (Background:, - Hospital:, etc.) would still appear

- timestamp: 2026-04-09T00:04:00Z
  checked: Version handling in sync_agent_for_profile (line 605-607) and hcp_profile_service create/update
  found: sync_agent_for_profile sets profile.agent_version from result["version"]. hcp_profile_service ALSO sets profile.agent_version from result.get("version"). Both write the same value. The create_agent/update_agent functions return result.version from SDK response.
  implication: Version SHOULD be stored correctly IF the SDK returns the correct new version number

## Resolution

root_cause:
fix:
verification:
files_changed: []
