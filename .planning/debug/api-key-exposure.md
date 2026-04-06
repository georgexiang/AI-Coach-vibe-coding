---
status: awaiting_human_verify
trigger: "Fix security issue: API Key exposed to frontend via token broker"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:01:00Z
---

## Current Focus

hypothesis: CONFIRMED. Lines 183-184 in voice_live_service.py set token_value = api_key and return it raw. agent_instructions_override also leaked.
test: Fix applied and verified via 69 passing tests including 2 new security regression tests
expecting: N/A - fix verified
next_action: Awaiting human verification

## Symptoms

expected: The raw Azure API key should never be sent to the frontend. The backend WebSocket proxy handles all Azure connections server-side.
actual: In model mode, the token broker returns the actual API key as `token` in VoiceLiveTokenResponse. agent_instructions_override also exposed.
errors: Security vulnerability - API key exposure
reproduction: Call POST /api/v1/voice-live/token?hcp_profile_id=xxx and see the raw API key in the response
started: Since token broker was created

## Eliminated

(none - root cause confirmed on first hypothesis)

## Evidence

- timestamp: 2026-04-04T00:01:00Z
  checked: voice_live_service.py lines 183-184
  found: auth_type = "key", token_value = api_key (raw Azure key returned to frontend)
  implication: Direct security vulnerability - raw API key sent to browser

- timestamp: 2026-04-04T00:02:00Z
  checked: voice_live_service.py line 216
  found: agent_instructions_override is returned in VoiceLiveTokenResponse
  implication: Coaching logic/system prompts exposed to frontend (audit issue)

- timestamp: 2026-04-04T00:03:00Z
  checked: voice_live_websocket.py lines 67-80
  found: WebSocket proxy reads API key directly from DB via config_service.get_effective_key, NOT from token broker
  implication: Token broker's token field is NOT needed by the WebSocket proxy - safe to mask

- timestamp: 2026-04-04T00:04:00Z
  checked: frontend/src/hooks/use-voice-live.ts
  found: Frontend connects via /api/v1/voice-live/ws WebSocket proxy, does NOT use token field for Azure auth
  implication: Frontend only needs metadata (endpoint, model, avatar config) from token broker, not the actual key

- timestamp: 2026-04-04T00:05:00Z
  checked: 69 tests pass including 2 new security regression tests
  found: TestTokenBrokerSecurity.test_token_never_contains_api_key PASSED, TestTokenBrokerSecurity.test_response_does_not_contain_agent_instructions PASSED
  implication: Fix is verified by test suite

## Resolution

root_cause: voice_live_service.py lines 183-184 assigned the raw Azure API key to token_value which was returned to the browser in VoiceLiveTokenResponse. In agent mode, an STS bearer token was returned instead (still sensitive). Additionally, agent_instructions_override exposed coaching system prompts to the frontend.
fix: (1) Replaced raw API key / STS token with masked value "***configured***" in both model and agent mode. (2) Removed agent_instructions_override field from VoiceLiveTokenResponse schema and service. (3) Removed STS token exchange from token broker (no longer needed since backend WS proxy handles auth). (4) Added 2 security regression tests. (5) Updated frontend TypeScript types.
verification: 69/69 tests pass. New security tests confirm raw key never appears in response and agent_instructions_override field is absent.
files_changed:
  - backend/app/services/voice_live_service.py
  - backend/app/schemas/voice_live.py
  - backend/tests/test_voice_live.py
  - backend/tests/test_voice_live_per_hcp.py
  - backend/tests/test_hcp_agent_sync_integration.py
  - frontend/src/types/voice-live.ts
