---
status: awaiting_human_verify
trigger: "Skill Creator agent creation fails: (invalid_parameters) Must start and end with alphanumeric characters, can contain hyphens in the middle, and must not exceed 63 characters"
created: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED - _sanitize_agent_name() now rejects underscores, enforces 63 char limit, default names use hyphens
test: 124 tests pass (10 new sanitize tests + 2 new migration tests + all existing)
expecting: User verifies Skill Creator agent creation works in their environment
next_action: Await human verification

## Symptoms

expected: Skill Creator agent creates successfully
actual: RuntimeError - invalid_parameters, name format violation
errors: (invalid_parameters) Must start and end with alphanumeric characters, can contain hyphens in the middle, and must not exceed 63 characters
reproduction: Test Skill Creator agent creation
started: Current version

## Eliminated

## Evidence

- timestamp: 2026-04-13T00:01:00Z
  checked: _sanitize_agent_name() in agent_sync_service.py line 432-438
  found: Regex [^a-zA-Z0-9_-] allows underscores, but Azure requires only alphanumeric+hyphens. Max length uses 64 not 63.
  implication: "skill_creator" passes through unchanged, Azure rejects the underscore.

- timestamp: 2026-04-13T00:02:00Z
  checked: meta_skill_service._DEFAULT_CONFIGS and sync_meta_skill_agent
  found: Default name is "skill_creator" (underscore). sync_meta_skill_agent passes meta.name to create_agent/update_agent.
  implication: The underscore in the default name triggers the Azure naming validation error.

- timestamp: 2026-04-13T00:03:00Z
  checked: Azure error message
  found: "(invalid_parameters) Must start and end with alphanumeric characters, can contain hyphens in the middle, and must not exceed 63 characters"
  implication: Rules are: ^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$ and len<=63. No underscores allowed.

## Resolution

root_cause: _sanitize_agent_name() in agent_sync_service.py allows underscores in agent names (regex [^a-zA-Z0-9_-]), but Azure AI Foundry requires only alphanumeric characters and hyphens. Additionally, the max length was 64 in the code but Azure requires max 63. The default meta skill name "skill_creator" contains an underscore which Azure rejects with invalid_parameters error.
fix: 1) Updated _sanitize_agent_name() regex to [^a-zA-Z0-9-] (no underscores) and max length to 63. 2) Changed _DEFAULT_CONFIGS names from skill_creator/skill_evaluator to skill-creator/skill-evaluator. 3) Added migration logic in ensure_defaults() to fix existing DB rows with underscore names. 4) Added 10 new sanitize tests and 2 migration tests. 5) Created documentation at docs/microsoft-agent-framework/07-agent-skill-creation-guide.md.
verification: 124 tests pass (10 new sanitize + 2 new migration + 112 existing). Lint and format checks clean.
files_changed:
  - backend/app/services/agent_sync_service.py
  - backend/app/services/meta_skill_service.py
  - backend/tests/test_agent_sync_service.py
  - backend/tests/test_meta_skill_service.py
  - backend/tests/test_meta_skill_api.py
  - backend/tests/test_skill_creator_service.py
  - docs/microsoft-agent-framework/README.md
  - docs/microsoft-agent-framework/07-agent-skill-creation-guide.md
