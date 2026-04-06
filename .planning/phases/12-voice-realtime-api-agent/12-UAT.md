---
status: testing
phase: 12-voice-realtime-api-agent
source: [12-01-SUMMARY.md, 12-02-SUMMARY.md, 12-03-SUMMARY.md, 12-04-SUMMARY.md]
started: 2026-04-02T10:00:00Z
updated: 2026-04-02T10:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running backend/frontend servers. Start the backend from scratch with `uvicorn app.main:app --reload --port 8000`. Server boots without errors, alembic migrations apply cleanly, and `GET /api/health` returns a successful response. Then run seed script (`python3 scripts/seed_phase2.py`) — it completes without errors and the 5 HCP profiles are seeded with voice/avatar fields.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running backend/frontend servers. Start the backend from scratch with `uvicorn app.main:app --reload --port 8000`. Server boots without errors, alembic migrations apply cleanly, and `GET /api/health` returns a successful response. Then run seed script (`python3 scripts/seed_phase2.py`) — it completes without errors and the 5 HCP profiles are seeded with voice/avatar fields.
result: [pending]

### 2. HCP Editor Three-Tab Layout
expected: Open Admin → HCP Profiles → click Edit on any HCP. The editor shows 3 tabs: "Profile", "Voice & Avatar", "Agent". Clicking each tab switches the visible form content. The Profile tab shows the existing HCP fields (name, specialty, etc.).
result: [pending]

### 3. Voice & Avatar Tab Controls
expected: In the HCP editor, click the "Voice & Avatar" tab. You see 3 card sections: Voice Settings (voice name select, temperature slider), Avatar Settings (character dropdown, style dropdown that updates based on character), and Conversation Parameters (turn detection type, noise suppression switch, echo cancellation switch, end-of-utterance detection switch, recognition language select).
result: [pending]

### 4. Agent Tab with Status and Instructions
expected: In the HCP editor, click the "Agent" tab. You see an Agent Status card showing sync status (synced/not synced). Below it, an auto-generated Instructions Preview showing the template-based instructions. Below that, an editable Override textarea where you can type custom agent instructions.
result: [pending]

### 5. Save HCP with Voice/Avatar Settings
expected: In the Voice & Avatar tab, change the voice name, select an avatar character, adjust temperature slider, toggle noise suppression ON. Click Save. The form saves successfully. Re-open the same HCP — all voice/avatar settings are preserved with the values you set.
result: [pending]

### 6. HCP Table Voice & Avatar Column
expected: On the HCP list page, the table shows a "Voice & Avatar" column. HCPs with configured voice/avatar show a badge pair (e.g., "en-US-AvaMultilingualNeural" + "lisa-casual-sitting"). HCPs without configuration show "Not configured" or similar.
result: [pending]

### 7. Voice Session Auto-Mode Resolution
expected: Start a voice session with an HCP that has avatar_character configured. The session auto-resolves to the highest available mode (Digital Human if avatar is available, Voice-only otherwise). You do NOT manually select a mode — it resolves automatically from the token broker response.
result: [pending]

### 8. Mode Status Indicator
expected: During a voice session, the header shows a ModeStatusIndicator with a colored dot: green when connected at the resolved mode, amber if degraded to a lower mode, red if disconnected. The mode label (e.g., "Digital Human Realtime Agent") appears next to the dot.
result: [pending]

### 9. Fallback Chain on Avatar Failure
expected: If avatar connection fails (e.g., HCP has no avatar configured or service unavailable), the session automatically falls back to voice-only mode. A toast warning notification appears explaining the degradation. The ModeStatusIndicator updates to show amber/degraded state.
result: [pending]

### 10. Per-HCP Token Broker API
expected: Call `GET /api/v1/voice-live/token?hcp_profile_id={id}` for an HCP with voice/avatar settings. The response includes per-HCP fields: voice_name, avatar_character, avatar_style, voice_temperature, turn_detection_type, noise_suppression, echo_cancellation, recognition_language, agent_instructions_override. Values match what was configured on the HCP profile.
result: [pending]

### 11. Token Broker Default Fallback
expected: Call `GET /api/v1/voice-live/token` without hcp_profile_id (or with an invalid ID). The response returns successfully with global default values for all voice/avatar fields. No error is thrown.
result: [pending]

### 12. Agent Instructions Override
expected: Set a custom agent_instructions_override on an HCP profile via the Agent tab. Save. When the token broker or agent sync uses this HCP, the override text is returned as-is instead of the template-generated instructions. Clearing the override (empty or whitespace-only) reverts to template-based instructions.
result: [pending]

### 13. Backend Tests Pass
expected: Run `cd backend && python3 -m pytest -v` — all tests pass including the 23 new per-HCP voice/avatar tests (test_voice_live_per_hcp.py, test_hcp_profile_voice.py, test_agent_sync_service.py override tests).
result: [pending]

### 14. Seed Data HCP Profiles
expected: After running seed_phase2.py, query `GET /api/v1/hcp-profiles`. The 5 HCP profiles each have distinct voice_name, avatar_character, avatar_style, turn_detection_type, and recognition_language values — not all defaults.
result: [pending]

## Summary

total: 14
passed: 0
issues: 0
pending: 14
skipped: 0
blocked: 0

## Gaps

[none yet]
