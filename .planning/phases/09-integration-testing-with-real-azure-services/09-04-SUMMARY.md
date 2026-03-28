---
phase: 09-integration-testing-with-real-azure-services
plan: 04
subsystem: testing
tags: [pytest, integration-tests, azure-openai, azure-speech, azure-avatar, voice-live]

# Dependency graph
requires:
  - phase: 09-01
    provides: "Unified AI Foundry config, connection tester, region capabilities"
  - phase: 07
    provides: "Azure service adapters (OpenAI, Speech STT/TTS, Avatar)"
  - phase: 08
    provides: "Voice Live service, token broker, supported regions"
provides:
  - "18 integration tests across 4 Azure service modules"
  - "Integration test infrastructure with skip markers and credential helpers"
  - "pytest addopts to auto-deselect integration tests by default"
  - "First-token latency assertion (< 3s) for Azure OpenAI"
  - "TTS->STT round-trip validation for Azure Speech"
  - "ICE relay token retrieval test for Avatar"
  - "Region validation and endpoint reachability for Voice Live"
affects: [09-05, ci-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pytest.mark.integration for Azure credential-gated tests"
    - "skip_no_* markers from conftest for graceful credential-less execution"
    - "Import aliasing (check_* prefix) to prevent pytest collection of imported test_* functions"

key-files:
  created:
    - backend/tests/integration/__init__.py
    - backend/tests/integration/conftest.py
    - backend/tests/integration/test_azure_openai_integration.py
    - backend/tests/integration/test_azure_speech_integration.py
    - backend/tests/integration/test_voice_live_integration.py
    - backend/tests/integration/test_avatar_integration.py
  modified:
    - backend/pyproject.toml

key-decisions:
  - "Aliased connection_tester imports (test_azure_* -> check_*) to prevent pytest from collecting them as tests"
  - "Registered timeout marker in conftest rather than requiring pytest-timeout plugin installation"

patterns-established:
  - "Integration tests use pytestmark = [pytest.mark.integration] at module level"
  - "Credential check functions (has_azure_*_credentials) as module-level skip conditions"
  - "Connection tester functions aliased with check_* prefix in test imports"

requirements-completed: [COACH-04, COACH-05, COACH-06, COACH-07, PLAT-03]

# Metrics
duration: 13min
completed: 2026-03-28
---

# Phase 09 Plan 04: Backend Integration Tests Summary

**18 pytest integration tests for Azure OpenAI, Speech STT/TTS, Voice Live, and Avatar with real credential gating and auto-skip**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-28T13:48:30Z
- **Completed:** 2026-03-28T14:01:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Created integration test infrastructure with conftest providing 4 skip markers (openai, speech, speech_sdk, voice_live)
- Built 6 Azure OpenAI tests including first-token latency < 3s assertion and Chinese language validation
- Built 5 Azure Speech tests including TTS->STT round-trip pipeline verification
- Built 4 Voice Live tests with region validation and endpoint reachability probes
- Built 3 Avatar tests with ICE relay token retrieval
- Configured pytest to auto-deselect integration tests (addopts = "-m 'not integration'")
- All 919 existing tests still pass with 18 integration tests properly deselected

## Task Commits

Each task was committed atomically:

1. **Task 1: Integration test infrastructure + Azure OpenAI + Azure Speech tests** - `a8056dd` (test)
2. **Task 2: Voice Live + Avatar integration tests** - `5b273f1` (test)

## Files Created/Modified
- `backend/tests/integration/__init__.py` - Empty package init
- `backend/tests/integration/conftest.py` - Skip markers, credential helpers, marker registration
- `backend/tests/integration/test_azure_openai_integration.py` - 6 tests: connection, availability, streaming, latency, Chinese, history
- `backend/tests/integration/test_azure_speech_integration.py` - 5 tests: connection, TTS, Chinese TTS, STT, round-trip
- `backend/tests/integration/test_voice_live_integration.py` - 4 tests: connection, region validation, endpoint probe, invalid region
- `backend/tests/integration/test_avatar_integration.py` - 3 tests: ICE token retrieval, connection, invalid region
- `backend/pyproject.toml` - Added integration marker definition and addopts for auto-deselection

## Decisions Made
- Aliased connection_tester imports (`test_azure_openai` -> `check_azure_openai`) because pytest was collecting imported `test_*` functions as test cases
- Registered `timeout` marker in conftest to suppress PytestUnknownMarkWarning when pytest-timeout plugin is not installed (the marker acts as no-op decoration)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pytest collecting imported test_* functions**
- **Found during:** Task 2
- **Issue:** Functions imported from `connection_tester.py` (e.g., `test_azure_openai`) were collected by pytest as test cases since they matched the `test_*` naming pattern
- **Fix:** Aliased all `test_*` imports with `check_*` prefix (e.g., `test_azure_openai as check_azure_openai`)
- **Files modified:** All 4 integration test modules
- **Verification:** `pytest --co -m integration` shows exactly 18 real tests, no spurious imports
- **Committed in:** `5b273f1` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix to prevent false test collection. No scope creep.

## Issues Encountered
- `pytest-timeout` plugin is listed in dev dependencies but not actually installed in the current environment, causing `PytestUnknownMarkWarning` for `@pytest.mark.timeout(N)`. The timeout markers are still included as documentation of expected time bounds and will function when the plugin is installed. Registered the marker in conftest to suppress warnings.

## Known Stubs
None - all tests are fully implemented with real assertion logic.

## Next Phase Readiness
- Integration test infrastructure is complete and ready for CI environment with Azure credentials
- Tests can be run with `pytest -m integration` when Azure credentials are available
- Default `pytest` execution safely excludes all integration tests

## Self-Check: PASSED

- All 6 created files verified present on disk
- Both commit hashes (a8056dd, 5b273f1) verified in git log
- Lint passes: `ruff check .` and `ruff format --check .` exit 0
- Tests pass: 919 passed, 14 skipped, 18 deselected (all integration tests deselected)

---
*Phase: 09-integration-testing-with-real-azure-services*
*Completed: 2026-03-28*
