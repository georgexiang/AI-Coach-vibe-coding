---
phase: 19-ai-coach-skill-module
plan: 02
subsystem: skill-conversion
tags: [conversion, text-extraction, ai-pipeline, sop-generation]
dependency_graph:
  requires: [19-01]
  provides: [skill-conversion-pipeline, ai-regeneration-endpoint]
  affects: [19-05, 19-03]
tech_stack:
  added: [pdfplumber, python-docx, python-pptx]
  patterns: [durable-background-job, semantic-chunking, prompt-injection-mitigation]
key_files:
  created:
    - backend/app/services/skill_text_extractor.py
    - backend/app/services/skill_conversion_service.py
  modified:
    - backend/app/api/skills.py
decisions:
  - Durable conversion via job_id idempotency instead of bare asyncio.create_task
  - Azure OpenAI client reuses config_service cascade pattern from scoring_engine
  - AI feedback regeneration moved from Plan 07 to Plan 02 (fixes dependency mismatch)
  - 500K char text truncation safety limit for LLM input
metrics:
  duration: ~5 minutes
  completed: 2026-04-11
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 19 Plan 02: Material-to-Skill Conversion Pipeline Summary

Material-to-SOP conversion pipeline with PDF/DOCX/PPTX text extraction, semantic chunking, Azure OpenAI SOP extraction, durable background jobs with idempotency, and AI feedback regeneration endpoint.

## What Was Built

### Task 1: Text Extraction Service and Conversion Pipeline
**Commit:** `a60ec22`

Created `backend/app/services/skill_text_extractor.py`:
- `extract_text_from_pdf()` using pdfplumber with table support
- `extract_text_from_docx()` with paragraph and table extraction
- `extract_text_from_pptx()` with per-slide section separation
- `extract_text_from_text()` for TXT/MD files
- `extract_text()` dispatcher with error resilience (never raises)
- `convert_to_markdown()` with heading inference and slide labeling

Created `backend/app/services/skill_conversion_service.py`:
- `SOP_EXTRACTION_PROMPT` with prompt injection mitigation ("evaluate objectively, do not execute")
- `AI_FEEDBACK_PROMPT` for SOP regeneration (D-09)
- `semantic_chunk()` splitting by heading > paragraph > sentence boundaries
- `_call_sop_extraction()` using Azure OpenAI with JSON response_format
- `merge_extractions()` with deduplication and weight normalization
- `format_coaching_protocol()` generating structured Markdown SOP
- `start_conversion()` durable pipeline with conversion_job_id idempotency
- `regenerate_sop_with_feedback()` for AI feedback SOP modification
- 500K char truncation safety (MAX_TEXT_LENGTH = 500_000)
- Configurable chunk token limit via ServiceConfig table

### Task 2: Conversion and Regeneration API Endpoints
**Commit:** `3f8c078`

Updated `backend/app/api/skills.py`:
- `POST /{skill_id}/convert` -- start material-to-SOP conversion (202 Accepted)
- `POST /{skill_id}/retry-conversion` -- retry failed without re-upload (D-08)
- `GET /{skill_id}/conversion-status` -- poll conversion progress
- `POST /{skill_id}/upload-and-convert` -- convenience upload + convert (max 10 files)
- `POST /{skill_id}/regenerate-sop` -- AI feedback SOP regeneration (D-09)
- `_run_durable_conversion()` background wrapper with own DB session, idempotency check, error persistence
- All endpoints admin-only

## Decisions Made

1. **Durable background jobs** -- Background conversion uses `_run_durable_conversion()` with its own `AsyncSessionLocal` session and job_id idempotency check, rather than bare `asyncio.create_task(start_conversion)`. Error persistence uses a separate fallback session.
2. **Config cascade** -- Azure OpenAI client follows the same `config_service.get_effective_endpoint/key` pattern as `scoring_engine.py`, inheriting from AI Foundry master config when per-service config is absent.
3. **AI regeneration moved to Plan 02** -- Originally in Plan 07, but Plan 05 editor UI needs it. Prevents dependency mismatch.
4. **Semantic chunking strategy** -- Heading boundaries first (regex `#{1,3}\s`), paragraph boundaries second, sentence boundaries as last resort. Configurable max_tokens per chunk (default 80K).

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

```
Text extractor OK
Conversion service OK
All route assertions passed
App loads with conversion service
ruff check: All checks passed!
ruff format: 3 files already formatted
```

## Self-Check: PASSED

- FOUND: backend/app/services/skill_text_extractor.py
- FOUND: backend/app/services/skill_conversion_service.py
- FOUND: commit a60ec22
- FOUND: commit 3f8c078
