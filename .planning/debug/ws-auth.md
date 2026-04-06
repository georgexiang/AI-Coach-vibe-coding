---
status: awaiting_human_verify
trigger: "Fix security issue: WebSocket endpoint has no authentication"
created: 2026-04-04T00:00:00Z
updated: 2026-04-04T00:05:00Z
---

## Current Focus

hypothesis: CONFIRMED - WebSocket endpoint lacked JWT authentication
test: All tests pass (6 backend auth tests, 17 frontend tests, TypeScript checks, build)
expecting: User verifies fix works in real environment
next_action: Await human verification

## Symptoms

expected: WebSocket connections should require JWT authentication, same as HTTP endpoints
actual: The WebSocket endpoint accepts connections from any client without authentication
errors: Security vulnerability - no auth on WebSocket
reproduction: Connect to ws://localhost:8000/api/v1/voice-live/ws without any token
started: Never had authentication

## Eliminated

## Evidence

- timestamp: 2026-04-04T00:01:00Z
  checked: backend/app/api/voice_live.py line 71-84
  found: WebSocket route has no Depends(get_current_user) and no token parameter. HTTP endpoints at lines 21-68 all use Depends(get_current_user).
  implication: Confirmed vulnerability - any client can connect to the WebSocket without auth.

- timestamp: 2026-04-04T00:01:30Z
  checked: backend/app/dependencies.py
  found: get_current_user validates JWT via jose.jwt.decode with settings.secret_key and settings.algorithm. Extracts user_id from "sub" claim, looks up User in DB, checks is_active.
  implication: Same validation logic needed for WebSocket, but can't use OAuth2PasswordBearer since browser WebSocket API can't set HTTP headers.

- timestamp: 2026-04-04T00:02:00Z
  checked: frontend/src/hooks/use-voice-live.ts line 53-55
  found: WebSocket URL constructed as `${protocol}//${location.host}/api/v1/voice-live/ws` with no token parameter.
  implication: Frontend needs to append ?token=xxx to WebSocket URL.

- timestamp: 2026-04-04T00:02:30Z
  checked: frontend/src/api/client.ts line 14
  found: JWT token stored in localStorage as "access_token".
  implication: Frontend can read token from localStorage.getItem("access_token") and append to WS URL.

- timestamp: 2026-04-04T00:04:00Z
  checked: Backend tests (6 WebSocket auth tests)
  found: All 6 pass — no token rejected, invalid token rejected, valid token accepted, nonexistent user rejected, inactive user rejected, missing sub claim rejected.
  implication: Auth logic is correct for all edge cases.

- timestamp: 2026-04-04T00:04:30Z
  checked: Frontend tests (17 tests including 2 new auth tests)
  found: All 17 pass — token appended to URL, empty token when no localStorage entry, all existing tests still pass.
  implication: Frontend correctly reads JWT from localStorage and appends to WebSocket URL.

- timestamp: 2026-04-04T00:05:00Z
  checked: TypeScript compilation + production build + ruff lint/format
  found: All pass with zero errors on changed files.
  implication: No regressions introduced.

## Resolution

root_cause: WebSocket endpoint at voice_live.py had no authentication mechanism. Browser WebSocket API cannot set HTTP Authorization headers, so the standard Depends(get_current_user) pattern (which reads from Authorization header) cannot work. The endpoint accepted connections from anyone, allowing unauthenticated access to Azure Voice Live resources.
fix: Added _authenticate_websocket() helper that extracts JWT from query parameter ?token=xxx, validates it using same jose.jwt.decode logic as get_current_user, looks up user in DB, checks is_active. Returns User on success, sends JSON error and closes with 1008 on failure. Frontend updated to read JWT from localStorage and append to WebSocket URL.
verification: 6 backend auth tests pass (all edge cases), 17 frontend tests pass (token appended to URL + all existing tests), TypeScript type-checks clean, production build succeeds, ruff lint/format clean.
files_changed:
  - backend/app/api/voice_live.py
  - frontend/src/hooks/use-voice-live.ts
  - backend/tests/test_voice_live_websocket.py
  - frontend/src/hooks/use-voice-live.test.ts
