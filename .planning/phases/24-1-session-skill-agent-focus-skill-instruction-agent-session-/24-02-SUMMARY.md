---
phase: 24-session-skill-focus-cu-evaluation
plan: "02"
subsystem: backend-services
tags: [skill-focus, sop-tracking, additional-instructions, llm-classification]
dependency_graph:
  requires: [skill_manager.SkillContent]
  provides: [compose_focus_instruction, detect_sop_step, extract_sop_steps]
  affects: [session-flow, agent-runs]
tech_stack:
  added: []
  patterns: [lazy-import-openai, regex-multiformat-parser, bilingual-prompt-engineering]
key_files:
  created:
    - backend/app/services/skill_focus_service.py
  modified: []
decisions:
  - "Used regex-based multi-format SOP extraction (numbered, Step N:, markdown headers, fallback paragraphs)"
  - "Graded off-topic handling with bilingual prompts (gentle redirect for related, hard block for unrelated)"
  - "gpt-4o-mini for step detection with max_completion_tokens=10 for low latency"
  - "Lazy import of openai SDK inside detect_sop_step for graceful degradation when not installed"
  - "Result clamping to [0, len(sop_steps)] for LLM output safety (T-24-06)"
metrics:
  duration: "3min"
  completed: "2026-05-13"
---

# Phase 24 Plan 02: Skill Focus Service Summary

SkillFocusService providing dynamic additional_instructions composition with bilingual SOP focus rules and LLM-based step progress detection via gpt-4o-mini.

## What Was Built

### Task 1: Create skill_focus_service.py with compose_focus_instruction

Created `backend/app/services/skill_focus_service.py` (191 lines) with three exported functions:

1. **extract_sop_steps()** - Multi-format SOP content parser supporting:
   - Numbered lists ("1. Step text")
   - Step N: format (English and Chinese)
   - Markdown headers
   - Fallback paragraph split (capped at 20)

2. **compose_focus_instruction()** - Builds structured additional_instructions for Azure Foundry runs:
   - Full SOP content injection (D-02)
   - Current progress awareness with step counter (D-05)
   - Bilingual graded off-topic handling (D-04): gentle redirect for related topics, hard block for unrelated
   - Version tag for audit trail

3. **detect_sop_step()** - Async LLM-based step classifier:
   - Uses gpt-4o-mini for low latency (D-06)
   - max_completion_tokens=10 for DoS mitigation (T-24-05)
   - Result clamped to valid range (T-24-06)
   - Graceful fallback to 0 on any error

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 2f72518 | feat(24-02): add SkillFocusService with SOP instruction composition and step detection |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- ruff check: All checks passed
- ruff format: Already formatted
- Import test: All 3 functions importable without error
- Functional test: extract_sop_steps handles numbered, Step N:, and Chinese formats
- Functional test: compose_focus_instruction includes SKILL FOCUS MODE, skill name, version, bilingual rules

## Known Stubs

None - all functions are fully implemented. detect_sop_step requires live Azure OpenAI endpoint but gracefully returns 0 when unavailable.

## Self-Check: PASSED
