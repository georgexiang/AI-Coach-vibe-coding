---
status: awaiting_human_verify
trigger: "HCP column shows '-' for all scenarios in the list page, but HCP data is visible when editing a scenario"
created: 2026-05-07T00:00:00Z
updated: 2026-05-07T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED - Backend ScenarioOut schema now includes hcp_profile field; all service functions reload with relationship
test: All 131 scenario-related backend tests pass, linting clean
expecting: Frontend will display HCP name/avatar in scenario list table
next_action: Awaiting human verification in browser

## Symptoms

expected: HCP name should display in the HCP column of the scenario list table
actual: All rows show "-" in the HCP column
errors: No visible errors - just missing data display
reproduction: Open the scenario list page (/scenarios) - all HCP columns show "-". Click edit on any scenario - HCP data is present.
started: Unknown - likely since list page was implemented

## Eliminated

## Evidence

- timestamp: 2026-05-07T00:00:30Z
  checked: Backend scenario_service.get_scenarios() 
  found: Uses selectinload(Scenario.hcp_profile) - relationship IS eagerly loaded
  implication: Data is available in the ORM object but not serialized to response

- timestamp: 2026-05-07T00:00:40Z
  checked: Backend ScenarioOut Pydantic model in api/scenarios.py
  found: Only has hcp_profile_id:str field, no hcp_profile relationship field
  implication: Loaded relationship data is silently dropped during serialization

- timestamp: 2026-05-07T00:00:50Z
  checked: Frontend scenario-table.tsx line 159
  found: Renders scenario.hcp_profile?.name and .avatar_url - shows "-" when hcp_profile is undefined
  implication: Frontend expects nested object but backend never sends it

- timestamp: 2026-05-07T00:01:00Z
  checked: Frontend types/scenario.ts
  found: Scenario type has optional hcp_profile?: HcpProfile field already defined
  implication: Frontend type is correct and ready to consume the data once backend sends it

## Resolution

root_cause: Backend ScenarioOut Pydantic response model in api/scenarios.py does not include an hcp_profile field. The service layer eagerly loads the relationship via selectinload, but Pydantic silently drops it during serialization because the schema has no matching field. Additionally, service functions that mutate scenarios (create, update, clone, transition) did not re-load the relationship after db.refresh(), which would cause MissingGreenlet errors in async context.
fix: (1) Added HcpProfileBrief nested schema with id/name/avatar_url to api/scenarios.py. (2) Added optional hcp_profile field to ScenarioOut. (3) Added _reload_with_hcp() helper in scenario_service.py that re-queries with selectinload after mutations. (4) Updated create_scenario, update_scenario, clone_scenario, and transition_scenario_status to use _reload_with_hcp() instead of bare db.refresh().
verification: All 131 scenario-related tests pass. Ruff linting clean. Mock serialization test confirms HcpProfileBrief is correctly serialized from ORM objects.
files_changed: [backend/app/api/scenarios.py, backend/app/services/scenario_service.py]
