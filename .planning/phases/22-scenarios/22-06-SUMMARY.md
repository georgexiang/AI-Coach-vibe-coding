---
phase: "22"
plan: "06"
subsystem: frontend-i18n
tags: [i18n, localization, react-i18next, defaultValue-removal]
dependency-graph:
  requires: []
  provides: [complete-i18n-coverage, locale-key-parity]
  affects: [all-frontend-pages, all-frontend-components, locale-files]
tech-stack:
  added: []
  patterns: [react-i18next-namespace-separation, locale-key-parity-enforcement]
key-files:
  created: []
  modified:
    - frontend/src/pages/admin/hcp-profile-editor.tsx
    - frontend/src/pages/admin/reports.tsx
    - frontend/src/pages/admin/scenarios.tsx
    - frontend/src/pages/admin/scoring-rubrics.tsx
    - frontend/src/pages/admin/settings.tsx
    - frontend/src/pages/admin/users.tsx
    - frontend/src/pages/admin/azure-config.tsx
    - frontend/src/pages/admin/dashboard.tsx
    - frontend/src/pages/admin/dry-run-report.tsx
    - frontend/src/pages/admin/skill-hub.tsx
    - frontend/src/pages/admin/skill-editor.tsx
    - frontend/src/pages/admin/meta-skills.tsx
    - frontend/src/pages/admin/training-materials.tsx
    - frontend/src/pages/user/dashboard.tsx
    - frontend/src/pages/user/reports.tsx
    - frontend/src/pages/user/session-history.tsx
    - frontend/src/pages/user/training-session.tsx
    - frontend/src/pages/user/scoring-feedback.tsx
    - frontend/src/pages/user/training.tsx
    - frontend/src/pages/login.tsx
    - frontend/src/components/analytics/trend-line-chart.tsx
    - frontend/src/components/coach/scenario-card.tsx
    - frontend/src/components/admin/rubric-table.tsx
    - frontend/src/components/voice/voice-test-playground.tsx
    - frontend/src/components/shared/quality-score-card.tsx
    - frontend/src/components/shared/dry-run-score-summary.tsx
    - frontend/src/components/shared/dry-run-conversation.tsx
    - frontend/src/components/shared/dry-run-issue-card.tsx
    - frontend/src/components/shared/dry-run-button.tsx
    - frontend/src/components/shared/dry-run-progress.tsx
    - frontend/src/components/shared/sop-editor.tsx
    - frontend/src/components/shared/publish-gate-dialog.tsx
    - frontend/src/components/shared/quality-radar-chart.tsx
    - frontend/src/components/shared/skill-material-uploader.tsx
    - frontend/src/components/shared/dry-run-comparison-chart.tsx
    - frontend/src/components/shared/sop-coverage-map.tsx
    - frontend/src/components/shared/conversion-progress.tsx
    - frontend/public/locales/en-US/admin.json
    - frontend/public/locales/zh-CN/admin.json
    - frontend/public/locales/en-US/analytics.json
    - frontend/public/locales/zh-CN/analytics.json
    - frontend/public/locales/en-US/skill.json
    - frontend/public/locales/zh-CN/skill.json
    - frontend/public/locales/en-US/meta-skill.json
    - frontend/public/locales/zh-CN/meta-skill.json
    - frontend/public/locales/en-US/common.json
    - frontend/public/locales/zh-CN/common.json
    - frontend/public/locales/en-US/auth.json
    - frontend/public/locales/zh-CN/auth.json
    - frontend/public/locales/en-US/coach.json
    - frontend/public/locales/zh-CN/coach.json
    - frontend/public/locales/en-US/dashboard.json
    - frontend/public/locales/zh-CN/dashboard.json
    - frontend/public/locales/en-US/scoring.json
    - frontend/public/locales/zh-CN/scoring.json
decisions:
  - All static defaultValue fallbacks removed; dynamic fallbacks (template literals with runtime values) preserved as legitimate
  - Duplicate aiFoundry JSON objects in admin.json merged into single object
  - rubrics.pageDescription key created to avoid collision with existing rubrics.description form field key
metrics:
  completed: "2026-05-06"
---

# Phase 22 Plan 06: I18N Global Audit Summary

**One-liner:** Removed all static `defaultValue` fallbacks from 37 frontend pages/components, added 80+ missing locale keys to both en-US and zh-CN with full parity.

## What Was Done

Performed a comprehensive audit of the entire frontend codebase to eliminate all hardcoded English/Chinese text and `defaultValue` fallback patterns in i18n `t()` calls. Every key referenced in production code now exists in both locale files.

### Pages Cleaned (20 files)
- **Admin:** hcp-profile-editor, reports, scenarios, scoring-rubrics, settings, users, azure-config, dashboard, dry-run-report, skill-hub, skill-editor, meta-skills, training-materials
- **User:** dashboard, reports, session-history, training-session, scoring-feedback, training
- **Auth:** login

### Components Cleaned (17 files)
- **Analytics:** trend-line-chart
- **Coach:** scenario-card
- **Admin:** rubric-table
- **Voice:** voice-test-playground
- **Shared:** quality-score-card, dry-run-score-summary, dry-run-conversation, dry-run-issue-card, dry-run-button, dry-run-progress, sop-editor, publish-gate-dialog, quality-radar-chart, skill-material-uploader, dry-run-comparison-chart, sop-coverage-map, conversion-progress

### Locale Keys Added
- **admin.json:** 35+ keys (users section with 30 keys, rubrics.actions/default, materials.derivedSkills, settings section)
- **analytics.json:** 7 keys (scoreDistribution, topPerformers, needsAttention, sessions, trainingActivity, trainingActivityDesc, week)
- **skill.json:** 10+ keys (hub.selectMaterials/selectMaterialsDesc/convertSelected, conversion.started, editor.sourceMaterials, fileTree.downloadPackage, dryRun.runCompleteToast/retry/tabSopCoverage/errors.startFailed)
- **meta-skill.json:** 2 keys (resources.downloadPackage, resources.downloadError)
- **common.json:** previously added (active, draft, back, user, lang.zhCN, lang.enUS)
- **auth.json:** previously added (emailPlaceholder, passwordPlaceholder)
- **coach.json:** previously added (session.hideHints, showHints, noHints)
- **dashboard.json:** previously added (noSessions, noSessionsBody)
- **scoring.json:** previously added (scenario, mode, date)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate aiFoundry key in admin.json**
- **Found during:** azure-config task
- **Issue:** Both en-US and zh-CN admin.json had two separate `aiFoundry` objects within azureConfig, causing JSON duplicate key behavior (only last wins)
- **Fix:** Merged both into a single object containing all keys
- **Files modified:** frontend/public/locales/en-US/admin.json, frontend/public/locales/zh-CN/admin.json

**2. [Rule 1 - Bug] Key collision rubrics.description**
- **Found during:** scoring-rubrics task (earlier session)
- **Issue:** `rubrics.description` was used for both the page subtitle and a form field label
- **Fix:** Created separate `rubrics.pageDescription` key for the page subtitle
- **Files modified:** admin.json (both locales), scoring-rubrics.tsx

## Remaining Dynamic Fallbacks (Intentional)

Five instances of `defaultValue` remain in components - all use template literal keys with runtime data:
- `t(\`dimension_${dim}\`, { defaultValue: dim })` in analytics components (3 instances)
- `t(\`quality.dimensions.${i18nKey}\`, { defaultValue: dim.name })` in quality components (2 instances)

These are legitimate i18n patterns where the key is dynamically generated from backend data and the fallback displays the raw dimension name if no translation exists.

## Commits

| Hash | Message |
|------|---------|
| 0f226d6 | feat(22-06): i18n hardcoded strings in hcp-profile-editor |
| 45ff824 | feat(22-06): i18n admin reports page - remove defaultValue patterns |
| bceae4a | feat(22-06): i18n scenarios page and user dashboard |
| 7006ceb | feat(22-06): i18n user reports and session history pages |
| bbf5237 | feat(22-06): i18n remaining pages - login, rubrics, training, config, settings |
| 981fcb4 | fix(22-06): remove defaultValue patterns from admin settings page |
| bd32d86 | fix(22-06): remove defaultValue patterns from admin users page |
| b8315a6 | fix(22-06): remove defaultValue patterns from azure-config page |
| 5dd6f71 | fix(22-06): remove defaultValue patterns from admin dashboard |
| 6647212 | fix(22-06): remove defaultValue patterns from dry-run-report page |
| 67536bc | fix(22-06): remove defaultValue patterns from skill-hub and skill-editor |
| b64f816 | fix(22-06): remove defaultValue patterns from meta-skills, training-materials, training |
| 32fef45 | fix(22-06): remove defaultValue patterns from all frontend components |

## Verification

- All 26 locale JSON files pass JSON validation
- Full key parity between en-US and zh-CN confirmed (zero mismatches)
- TypeScript compilation shows no new errors (pre-existing test infra issues only)
- No remaining static `defaultValue` patterns in production code

## Self-Check: PASSED
