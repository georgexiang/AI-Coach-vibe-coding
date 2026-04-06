---
status: awaiting_human_verify
trigger: "Avatar thumbnails show letters instead of real avatar images; VL Management page needs VoiceLiveInstance CRUD"
created: 2026-04-05T10:00:00Z
updated: 2026-04-05T10:30:00Z
---

## Current Focus

hypothesis: Fix applied and self-verified. Awaiting human confirmation.
test: User should open HCP Editor > Voice/Avatar tab and see detailed face illustrations instead of letter circles
expecting: Face SVGs render correctly in avatar grid and preview area
next_action: Wait for user verification

## Symptoms

expected:
1. Avatar selection grid shows real face thumbnail images (like Azure AI Foundry Voice Live playground)
2. Voice Live Management page should be a CRUD for VoiceLiveInstance entities

actual:
1. Avatar grid shows colored circles with single-letter initials (L, H, M, J, etc.) - SVG silhouettes
2. Voice Live Management page is actually already a VoiceLiveInstance CRUD (was updated recently)

errors: No errors - the SVG thumbnails load successfully, they just aren't face photos

reproduction:
1. Go to HCP Editor > Voice/Avatar tab > Avatar Settings section
2. See colored letter circles (generated SVG) instead of face thumbnails

started: Since initial implementation - the SVG generator was intentionally built as fallback

## Eliminated

- hypothesis: Frontend img tags fail to load and fall to fallback
  evidence: The thumbnailUrl points to /api/v1/voice-live/avatar-thumbnail/{id} which returns valid SVG. The SVG loads correctly as an img. The issue is the SVG itself shows a silhouette+letter, not a face photo.
  timestamp: 2026-04-05T10:05:00Z

- hypothesis: VL Management page is a read-only HCP card dashboard
  evidence: Reading voice-live-management.tsx shows it already has full CRUD for VoiceLiveInstance entities with create/edit/delete dialogs, stat cards, and VoiceLiveInstanceCard components. The old HCP card design has been replaced.
  timestamp: 2026-04-05T10:05:00Z

## Evidence

- timestamp: 2026-04-05T10:01:00Z
  checked: backend/app/services/avatar_characters.py - generate_avatar_svg function
  found: SVG generator creates colored silhouettes with initial letters. No real face photo URLs used anywhere.
  implication: Root cause for Issue 1 is clear - need real avatar face image URLs

- timestamp: 2026-04-05T10:02:00Z
  checked: frontend/src/data/avatar-characters.ts - thumbnailUrl field
  found: Uses `/api/v1/voice-live/avatar-thumbnail/{character}` which returns generated SVG
  implication: Need to change thumbnail URLs to point to real Azure avatar face images

- timestamp: 2026-04-05T10:03:00Z
  checked: frontend/src/pages/admin/voice-live-management.tsx
  found: Already a full VoiceLiveInstance CRUD page with create/edit/delete + stat cards + instance cards
  implication: Issue 2 is already resolved in the current codebase

- timestamp: 2026-04-05T10:04:00Z
  checked: Azure avatar CDN URLs, reference repos
  found: No public CDN URLs found for Azure avatar face thumbnails. Azure Speech Studio renders avatars in-browser.
  implication: Need to use static face photo assets bundled with the app, or generate high-quality realistic avatar images

## Resolution

root_cause: The avatar thumbnail system used a backend SVG generator endpoint (`/api/v1/voice-live/avatar-thumbnail/{id}`) that produced abstract silhouettes with letter initials instead of realistic face illustrations. The generator was intentionally built as a fallback when the speech.microsoft.com CDN was found to serve HTML instead of images, but the resulting SVGs looked like colored circles with single letters.
fix: Created 6 detailed, realistic face illustration SVGs as static assets in `frontend/public/avatars/`. Updated the frontend `avatar-characters.ts` data to point to `/avatars/{id}.svg` static paths instead of the backend SVG generator. Updated the backend `get_avatar_characters_list()` to return static paths for known characters. Enhanced VoiceLiveInstanceCard to show avatar face thumbnails. The backend SVG generator endpoint is preserved as a fallback for unknown/custom characters.
verification: TypeScript compiles cleanly, frontend builds successfully with avatars in dist/avatars/, all 38 avatar-related backend tests pass, SVG files validated as well-formed XML.
files_changed:
  - frontend/public/avatars/lisa.svg (new)
  - frontend/public/avatars/harry.svg (new)
  - frontend/public/avatars/meg.svg (new)
  - frontend/public/avatars/jeff.svg (new)
  - frontend/public/avatars/lori.svg (new)
  - frontend/public/avatars/max.svg (new)
  - frontend/src/data/avatar-characters.ts (updated thumbnailUrl to static paths)
  - backend/app/services/avatar_characters.py (updated get_avatar_characters_list)
  - frontend/src/components/admin/voice-live-chain-card.tsx (added avatar thumbnail to card)
