---
status: awaiting_human_verify
trigger: "All UI labels in zh locale showing raw i18n keys instead of translated text"
created: 2026-04-11T00:00:00Z
updated: 2026-04-11T00:02:00Z
---

## Current Focus

hypothesis: CONFIRMED - All fixes applied and verified
test: TypeScript build, i18n unit tests, JSON validity check, key count comparison
expecting: User to confirm translations render correctly in browser
next_action: Await human verification

## Symptoms

expected: UI should display Chinese translations when in zh locale mode
actual: Raw i18n key strings like "azureConfig.title", "azureConfig.aiFoundry.endpoint" etc. displayed instead of translated text
errors: No JS console errors - react-i18next falls back to showing key when translation missing
reproduction: Switch to ZH locale, navigate to any page
started: New features added without corresponding zh-CN translations

## Eliminated

- hypothesis: Keys are missing from zh-CN files but present in en-US
  evidence: Full key comparison shows all 12 namespace files have identical key sets between en-US and zh-CN (979 keys total per locale)
  timestamp: 2026-04-11T00:00:30Z

## Evidence

- timestamp: 2026-04-11T00:00:10Z
  checked: JSON validity of all 24 locale files (12 per locale)
  found: 4 files had JSON syntax errors that prevent parsing:
    1. en-US/admin.json line 288 - trailing comma before closing brace
    2. zh-CN/admin.json line 288 - same trailing comma
    3. zh-CN/skill.json lines 145,147 - unescaped double quotes inside string values
    4. zh-CN/voice.json line 88 - unescaped double quotes inside string value
  implication: When i18next-http-backend fetches these files, JSON.parse fails, so ENTIRE namespace fails to load

- timestamp: 2026-04-11T00:00:20Z
  checked: i18n config at frontend/src/i18n/index.ts
  found: ns array was missing "voice" namespace
  implication: Voice namespace never loaded at startup for any locale

- timestamp: 2026-04-11T00:00:30Z
  checked: Key comparison across all 12 JSON files
  found: All keys match between en-US and zh-CN (0 missing, 0 extra)
  implication: No translation keys were actually missing - problem was purely syntax errors + missing namespace registration

- timestamp: 2026-04-11T00:01:30Z
  checked: Post-fix verification
  found: All 24 JSON files parse successfully. npx tsc -b passes. npm run build passes. i18n unit tests (8/8) pass.
  implication: Fixes are correct

## Resolution

root_cause: Multiple JSON syntax errors prevented i18next from loading entire namespaces, plus missing "voice" namespace registration:
  1. Trailing comma in en-US/admin.json and zh-CN/admin.json (line 288) broke admin namespace for both locales
  2. Unescaped double quotes in zh-CN/skill.json (lines 145, 147) broke skill namespace for Chinese
  3. Unescaped double quotes in zh-CN/voice.json (line 88) broke voice namespace for Chinese
  4. "voice" namespace missing from i18n config ns array - voice translations never loaded for any locale
fix: |
  1. Removed trailing comma in en-US/admin.json and zh-CN/admin.json
  2. Replaced unescaped ASCII double quotes with Chinese corner brackets in zh-CN/skill.json
  3. Replaced unescaped ASCII double quotes with Chinese corner brackets in zh-CN/voice.json
  4. Added "voice" to ns array in frontend/src/i18n/index.ts
  5. Updated i18n unit test to expect "skill" and "voice" in ns array
verification: All 24 JSON files parse, tsc build passes, npm build passes, 8/8 i18n tests pass
files_changed:
  - frontend/public/locales/en-US/admin.json
  - frontend/public/locales/zh-CN/admin.json
  - frontend/public/locales/zh-CN/skill.json
  - frontend/public/locales/zh-CN/voice.json
  - frontend/src/i18n/index.ts
  - frontend/src/i18n/index.test.ts
