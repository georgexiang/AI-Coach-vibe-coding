# Deferred Items — Phase 28

Out-of-scope discoveries logged during execution. NOT fixed (unrelated to the
prompt create / version-content work).

## Pre-existing test failures (environment-related)

Discovered while running the full backend suite (`pytest -q`) as a pre-commit
gate for Plan 28-01. None of these touch `prompt_registry`, `app/api/prompts`,
or `app/schemas/prompt`, and all Phase 28 tests pass (48/48, 100% coverage on
the changed prompt modules).

- `tests/test_voice_live.py::TestConnectionTester::test_connection_tester_voice_live_no_key`
- `tests/test_voice_live.py::TestConnectionTester::test_connection_tester_dispatch_voice_live`
- `tests/test_coverage_boost_2.py::TestConnectionTester::test_ai_foundry_endpoint_no_key`
- `tests/test_coverage_boost_2.py::TestConnectionTester::test_azure_voice_live_no_key`
  - **Cause:** The dev host has an active `az login`. `DefaultAzureCredential`
    acquires a real token even in the "no_key" path, so the tester makes a live
    HTTP call instead of the expected short-circuit. Environmental, not a code
    regression.

- `tests/test_skill_text_extractor.py::TestExtractTextFromDocx::*` (5 tests)
  - **Cause:** python-docx extraction behavior in this environment; unrelated to
    prompt management.

## Pre-existing formatting drift (out of scope)

`ruff format --check app tests` reports two files needing reformat that are NOT
part of Phase 28:

- `app/services/scenario_service.py`
- `tests/test_scenarios_api.py`
