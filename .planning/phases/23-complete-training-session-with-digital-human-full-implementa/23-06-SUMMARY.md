---
plan: 23-06
phase: 23
status: complete
started: 2026-05-14T00:30:00+08:00
completed: 2026-05-14T01:00:00+08:00
---

# Plan 23-06 Summary: Integration Wiring (Routes, i18n, Tests)

## Objective
Wire unified session into routing, create session i18n namespace, update navigation, add backend tests.

## What Was Built

### Task 1: Route Updates + i18n + Navigation
- **Router** (`frontend/src/router/index.tsx`): UnifiedSession lazy-loaded at `/user/training/session`, old `/user/training/voice` redirects via Navigate
- **i18n config** (`frontend/src/i18n/index.ts`): Added "session" namespace to namespace list
- **Session locale en-US** (`frontend/public/locales/en-US/session.json`): Full namespace with mode, guidance, textPanel, voicePanel, micDenied, endSession strings
- **Session locale zh-CN** (`frontend/public/locales/zh-CN/session.json`): Complete Chinese translations
- **Training page** (`frontend/src/pages/user/training.tsx`): All session start navigation goes to unified page

### Task 2: Backend Tests
- **test_audio_upload.py** (`backend/tests/test_audio_upload.py`): 11 tests covering upload success/auth/ownership/size, voice score status polling, mock backend, storage service
- **test_voice_scoring.py** (`backend/tests/test_voice_scoring.py`): 7 tests covering mock backend dimensions, weights, factory, audio storage

## Key Files Created/Modified
- `frontend/src/router/index.tsx` (modified)
- `frontend/src/i18n/index.ts` (modified)
- `frontend/public/locales/en-US/session.json` (created)
- `frontend/public/locales/zh-CN/session.json` (created)
- `frontend/src/pages/user/training.tsx` (modified)
- `backend/tests/test_audio_upload.py` (created)
- `backend/tests/test_voice_scoring.py` (created)

## Test Results
- Backend: 26 Phase 23 tests passing
- Frontend: TypeScript clean, build succeeds
- i18n: Valid JSON in both locales

## Self-Check: PASSED
