---
status: resolved
trigger: "Voice output doesn't work (AI replies text-only), avatar lip sync not driven, avatar thumbnails show colored circles"
created: 2026-04-05T00:00:00Z
updated: 2026-04-06T18:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Three root causes found and fixed
test: All backend tests pass (34 voice live tests), TypeScript compiles clean
expecting: User verifies audio playback works and thumbnails display correctly
next_action: Await human verification

## Symptoms

expected: |
  1. Voice Live session should produce AUDIO output (speaker plays AI voice), not just text
  2. Avatar (digital human) should animate with lip sync when speaking
  3. HCP Profile editor avatar selection grid should show real avatar photos
  4. Avatar metadata (thumbnail images) should be retrieved via Azure Speech API
actual: |
  1. AI responds with TEXT saying "can't do voice output"
  2. Avatar appears as static image but lips don't move
  3. HCP Profile editor avatar grid shows colored circles with single letter initials
  4. Avatar thumbnails use hardcoded AVATAR_CHARACTER_MAP with CDN URLs that don't resolve
errors: No specific error messages visible in screenshots
reproduction: Start a voice session from the Voice & Avatar tab in HCP Profile editor
started: Current state after recent refactoring

## Eliminated

- hypothesis: Backend not forwarding audio delta events
  evidence: Backend _forward_azure_to_client forwards ALL Azure events without filtering (line 355-378)
  timestamp: 2026-04-05T00:03:00Z

- hypothesis: Azure session not configured for audio modality
  evidence: Modalities always include TEXT and AUDIO (line 226), AVATAR added conditionally
  timestamp: 2026-04-05T00:04:00Z

- hypothesis: Azure Speech API has a public REST endpoint for listing avatar characters with thumbnails
  evidence: Tested multiple API patterns (cognitiveservices, tts, customvoice) - no avatar character listing API exists. AI Foundry uses internal APIs.
  timestamp: 2026-04-05T09:45:00Z

## Evidence

- timestamp: 2026-04-05T00:01:00Z
  checked: voice-avatar-tab.tsx useVoiceLive initialization (line 175-192)
  found: useVoiceLive called WITHOUT onAudioDelta callback. Only onTranscript and onConnectionStateChange provided.
  implication: Audio data silently discarded. ROOT CAUSE of issue 1.

- timestamp: 2026-04-05T00:02:00Z
  checked: voice-session.tsx useVoiceLive initialization (line 152-165)
  found: VoiceSession DOES pass onAudioDelta: audioPlayer.playAudio. Main voice session page would play audio correctly.
  implication: Bug is specifically in VoiceAvatarTab test panel.

- timestamp: 2026-04-05T00:03:00Z
  checked: Backend voice_live_websocket.py _forward_azure_to_client (line 355-378)
  found: Backend forwards ALL Azure events to client without filtering. response.audio.delta events ARE forwarded.
  implication: Backend is correct. Issue is purely frontend.

- timestamp: 2026-04-05T09:40:00Z
  checked: CDN URLs at speech.microsoft.com/assets/avatar/
  found: These URLs return HTTP 200 with content-type text/html (Speech Studio SPA), NOT actual image files. The img tag receives HTML, triggering onError.
  implication: ROOT CAUSE of issue 3. The URLs were never going to work.

- timestamp: 2026-04-05T09:45:00Z
  checked: Azure REST APIs for avatar character listing (multiple patterns tested)
  found: No public REST API exists for listing avatar characters with thumbnails. AI Foundry uses internal APIs.
  implication: Must generate thumbnails ourselves. Created backend SVG avatar thumbnail generator.

## Resolution

root_cause: |
  ISSUE 1 (No audio playback): VoiceAvatarTab component was missing the onAudioDelta callback in its useVoiceLive options. The hook receives response.audio.delta events from Azure via the backend WebSocket proxy, but without onAudioDelta, the base64 PCM audio data is silently discarded. The main VoiceSession component had it wired correctly, but VoiceAvatarTab (the HCP Profile editor test panel) did not.

  ISSUE 2 (Avatar lip sync): Depends on azure_avatar config being active + having a key. This is a configuration issue, not a code bug. The avatar MODALITY must be included in the session config, which requires the avatar service to be configured in the platform settings.

  ISSUE 3 (Thumbnails showing initials): The CDN URLs at speech.microsoft.com/assets/avatar/ return HTML (the Speech Studio SPA) instead of actual images. The img tags fail to load, triggering onError, which shows the colored circle fallback. There is no public Azure REST API for avatar character thumbnails. Fixed by creating a backend SVG avatar thumbnail generator endpoint.

fix: |
  1. Added useAudioPlayer hook to VoiceAvatarTab and wired onAudioDelta: audioPlayer.playAudio
  2. Added audioPlayer.stopAudio() to disconnect handler for proper cleanup
  3. Created backend /api/v1/voice-live/avatar-characters endpoint returning character metadata
  4. Created backend /api/v1/voice-live/avatar-thumbnail/{character_id} endpoint serving SVG avatars
  5. Updated frontend avatar-characters.ts to use backend SVG endpoint URLs instead of broken CDN URLs
  6. Created new types (AvatarCharacterInfo, AvatarCharactersResponse) and API client function
  7. Created useAvatarCharacters hook for fetching avatar data from backend API

verification: |
  - TypeScript compiles clean (npx tsc -b --noEmit = 0 errors)
  - All 34 voice live backend tests pass
  - Ruff lint passes on all modified backend files
  - Backend avatar thumbnail endpoint returns valid SVG for all 6 characters

files_changed:
  - frontend/src/components/admin/voice-avatar-tab.tsx (added useAudioPlayer, onAudioDelta, stopAudio)
  - frontend/src/data/avatar-characters.ts (switched from CDN URLs to backend SVG URLs)
  - frontend/src/types/voice-live.ts (added AvatarCharacterInfo, AvatarCharactersResponse types)
  - frontend/src/api/voice-live.ts (added fetchAvatarCharacters function)
  - frontend/src/hooks/use-avatar-characters.ts (NEW - TanStack Query hook)
  - backend/app/api/voice_live.py (added avatar-characters and avatar-thumbnail endpoints)
  - backend/app/schemas/voice_live.py (added AvatarCharacterInfo, AvatarCharactersResponse schemas)
  - backend/app/services/avatar_characters.py (NEW - avatar metadata + SVG generator)

---

## Phase 2: WebRTC Avatar Audio Output Fix (2026-04-06)

### Symptoms (Phase 2)

After Phase 1 fixes, the avatar video displayed correctly but:
1. No audio output from avatar (speakers silent during AI response)
2. No lip-sync animation on the avatar
3. Only text transcript appeared

### Root Cause Analysis (Phase 2)

**Diagnostic method:** Used `window.__avatarPC.getStats()` via Chrome DevTools to inspect RTCPeerConnection inbound-rtp audio stats during AI response.

**Pre-fix stats (audio track during AI response):**
- `audioLevel`: always 0
- `totalAudioEnergy`: 0.000001 (stagnant)
- `bytesReceived`: ~9KB/min (comfort noise only)

**Azure session.updated avatar config showed:**
- `output_audit_audio: false` — Azure renders lip-sync internally but does NOT output TTS audio on the WebRTC audio track
- `video: null` — no video codec specified

**Root cause:** Azure Voice Live defaults `output_audit_audio` to `false` when not explicitly set. This means the avatar service processes TTS audio for lip-sync rendering only, but does NOT route the audio through the WebRTC audio track to the client.

### Fix Applied (Phase 2)

In `backend/app/services/voice_live_websocket.py`:

1. **Added `VideoParams(codec="h264")`** to AvatarConfig — specifies H264 video encoding matching Azure reference TypeScript implementation
2. **Set `output_audit_audio = True`** via dict access on AvatarConfig — instructs Azure to output TTS audio through the WebRTC audio track

```python
avatar_config_value = AvatarConfig(
    character=char_id,
    style=style if style else None,
    customized=cfg["avatar_customized"],
    video=VideoParams(codec="h264"),  # NEW
)
avatar_config_value["output_audit_audio"] = True  # NEW
```

Additionally in `frontend/src/hooks/use-avatar-stream.ts`:
3. **Added `window.__avatarPC = pc`** for WebRTC debugging access

### Post-fix Verification (Phase 2)

**Post-fix stats (audio track during AI response):**
- `audioLevel`: 0.06 ~ 0.138 (non-zero during speech)
- `totalAudioEnergy`: 3.2+ (significant energy)
- `bytesReceived`: ~400KB/min (real Opus audio data)

**Post-fix Azure session.updated avatar config:**
- `video: {"bitrate":2000000,"codec":"h264","crop":null,"resolution":null,"background":null,"gop_size":10}`
- `output_audit_audio` field present in avatar keys

**Visual confirmation:** Avatar displayed at 1920x1080, AI responded in Chinese with full audio transcript.

### Files Changed (Phase 2)

- `backend/app/services/voice_live_websocket.py` (added VideoParams, output_audit_audio=True, enhanced logging)
- `frontend/src/hooks/use-avatar-stream.ts` (added window.__avatarPC debug access)
