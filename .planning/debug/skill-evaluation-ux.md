---
status: awaiting_human_verify
trigger: "Skill quality evaluation has multiple UX/functionality problems: scores always 0/100, verdict always FAIL, no transparency into criteria/model/prompt"
created: 2026-04-11T00:00:00Z
updated: 2026-04-11T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED - Three root causes addressed
test: Backend tests (60/60 pass), TypeScript compiles clean, frontend builds successfully
expecting: User sees AI unavailable banner + evaluation criteria + model metadata when AI not configured
next_action: Await human verification

## Symptoms

expected: When user triggers "Quality Review" on a Skill, they should see meaningful evaluation scores. The evaluation criteria, model, and prompt should be visible/transparent. Scores should reflect actual quality when AI is available.
actual: Overall Score is 0/100, verdict is always FAIL. No visibility into what criteria are being used, which model evaluates, or what prompt drives the evaluation. The evaluation feels like a black box.
errors: No error messages — the evaluation "completes" but with meaningless fallback scores (all zeros).
reproduction: Go to Skill editor → trigger Quality Review on any skill → observe results
started: Current state since evaluation was implemented. The fallback path always returns zeros when Azure OpenAI is not configured.

## Eliminated

## Evidence

- timestamp: 2026-04-11T00:01:00Z
  checked: Azure OpenAI config via config_service.get_effective_endpoint/key
  found: Effective endpoint resolves to AI Foundry (https://ai-foundary-hu-sweden-central.services.ai.azure.com/) with model gpt-5.4-mini. Direct .env endpoint is https://openai-hu-swendencentral2.openai.azure.com/ with gpt-4o.
  implication: Config is present so _call_openai_for_evaluation doesn't return None at the endpoint/key check

- timestamp: 2026-04-11T00:02:00Z
  checked: Live API call to AI Foundry endpoint with gpt-5.4-mini
  found: 403 AuthenticationTypeDisabled - Key based auth disabled for this resource
  implication: API call fails in the try/except, returns None, triggers fallback all-zeros path

- timestamp: 2026-04-11T00:03:00Z
  checked: Live API call to direct OpenAI endpoint with gpt-4o
  found: 404 DeploymentNotFound
  implication: The direct endpoint also can't serve gpt-4o deployment

- timestamp: 2026-04-11T00:04:00Z
  checked: Backend evaluation response format vs frontend display
  found: Backend stores quality_details JSON with dimensions/scores but NO metadata about model, prompt, or criteria descriptions. Frontend shows scores/radar/cards but has zero transparency about evaluation process.
  implication: Even when AI works, user has no visibility into what drives the evaluation

- timestamp: 2026-04-11T00:05:00Z
  checked: Fallback UX when AI unavailable
  found: Returns overall_score=0, overall_verdict="FAIL", all dimensions score=0 verdict="FAIL". Frontend displays these zeros as real results. No special "AI unavailable" messaging.
  implication: User sees a FAIL verdict without understanding it's because AI service is down, not because their skill is bad

## Resolution

root_cause: Three distinct issues:
  1. AI call always fails (403/404 from Azure endpoints) → falls into except → returns None → fallback zeros displayed as real results
  2. No evaluation metadata (model, criteria descriptions, prompt info) returned to frontend → black box experience
  3. When AI is unavailable, fallback returns 0/FAIL scores that look identical to real results → misleading UX

fix: |
  Backend (skill_evaluation_service.py):
  - Added DIMENSION_DESCRIPTIONS dict with human-readable criteria for all 6 dimensions
  - Added _AICallResult dataclass to capture model_used, evaluation_status, error_detail from AI calls
  - SkillEvaluationResult now carries evaluation_status, model_used, error_detail fields
  - These fields are serialized into quality_details JSON for persistence

  Backend (skills.py API):
  - GET /{skill_id}/evaluation now returns evaluation_status, model_used, error_detail at quality level
  - Added evaluation_criteria array with dimension names + descriptions for transparency

  Frontend (types/skill.ts):
  - Added EvaluationStatus, EvaluationCriterion types
  - Extended SkillEvaluationSummary with new quality metadata fields

  Frontend (skill-editor.tsx):
  - Added AI Unavailable/Error alert banner with distinct styling (yellow for unavailable, red for error)
  - Hides misleading radar chart + 0-score cards when AI is unavailable
  - Shows model name + evaluation timestamp below radar chart
  - Added collapsible EvaluationCriteriaPanel showing all 6 criteria descriptions

  i18n (zh-CN + en-US):
  - Added keys: aiUnavailable, aiUnavailableDesc, aiError, aiErrorDesc, modelUsed, evaluatedAt, criteriaTitle, criteriaDescription

verification: |
  - Backend: 60/60 pytest tests pass
  - Backend: ruff lint clean (pre-existing E501 only)
  - Frontend: TypeScript compiles clean (npx tsc -b)
  - Frontend: Build succeeds (npm run build)
  - Dataclass serialization smoke test passes

files_changed:
  - backend/app/services/skill_evaluation_service.py
  - backend/app/api/skills.py
  - frontend/src/types/skill.ts
  - frontend/src/pages/admin/skill-editor.tsx
  - frontend/public/locales/zh-CN/skill.json
  - frontend/public/locales/en-US/skill.json
