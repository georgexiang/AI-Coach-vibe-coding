---
created: 2026-05-22T07:49:15.476Z
title: Add voice-live-webrtc transport option
area: ui
files:
  - frontend/src/components/coach/
  - backend/app/services/
---

## Problem

Currently the voice-live session only supports WebSocket transport. Users need the ability to select voice-live-webrtc as an alternative transport mode. Since WebRTC support is still a preview feature in Azure Speech Service, it should be offered as an opt-in option via a dropdown selector while preserving all existing WebSocket functionality as the default.

Key requirements:
- Keep all existing WebSocket-based voice-live functionality unchanged (default)
- Add a dropdown/select control allowing users to choose between "WebSocket" (default) and "WebRTC" (preview)
- Implement WebRTC transport support following Azure Speech Service voice-live-webrtc docs
- Clearly mark WebRTC as a preview/experimental feature in the UI

## Solution

1. Add transport mode selector (dropdown) to the voice-live session configuration UI
2. Implement WebRTC transport adapter in the backend/frontend following the Azure reference:
   https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc
3. Route voice-live sessions through the selected transport (WebSocket or WebRTC)
4. Preserve existing WebSocket as default, WebRTC as opt-in preview
