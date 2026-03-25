---
phase: 05-training-material-management
plan: 01
subsystem: database, api
tags: [sqlalchemy, pydantic, alembic, pdf, docx, xlsx, aiofiles, storage]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "User model, TimestampMixin, Base, Alembic setup"
provides:
  - "TrainingMaterial, MaterialVersion, MaterialChunk ORM models"
  - "Pydantic v2 schemas for material CRUD"
  - "StorageBackend protocol with LocalStorageBackend implementation"
  - "Text extractor for PDF, DOCX, XLSX with chunking"
  - "Alembic migration for three material tables"
affects: [05-02-service-api, 05-03-frontend]

# Tech tracking
tech-stack:
  added: [pypdf, python-docx, openpyxl, aiofiles]
  patterns: [StorageBackend protocol, text chunking with overlap, pluggable storage factory]

key-files:
  created:
    - backend/app/models/material.py
    - backend/app/schemas/material.py
    - backend/app/services/storage/__init__.py
    - backend/app/services/storage/local.py
    - backend/app/services/storage/azure_blob.py
    - backend/app/services/text_extractor.py
    - backend/alembic/versions/b148c6bf1d9b_add_training_material_tables.py
  modified:
    - backend/pyproject.toml
    - backend/app/config.py
    - backend/.env.example
    - backend/app/models/__init__.py
    - backend/alembic/env.py

key-decisions:
  - "StorageBackend as Protocol (not ABC) for structural typing flexibility"
  - "Local filesystem storage for MVP, Azure Blob stub for production"
  - "Page-level chunking for PDF, paragraph-group chunking for DOCX, sheet-per-chunk for XLSX"
  - "2000-char chunk size with 200-char overlap for RAG indexing"

patterns-established:
  - "StorageBackend Protocol: pluggable storage with factory function get_storage()"
  - "Text extraction pipeline: extract_text() dispatches by content_type to format-specific extractors"

requirements-completed: [CONTENT-01, CONTENT-03]

# Metrics
duration: 9min
completed: 2026-03-25
---

# Phase 05 Plan 01: Training Material Data Foundation Summary

**TrainingMaterial/MaterialVersion/MaterialChunk ORM models with Pydantic v2 schemas, pluggable storage adapter (local filesystem), and PDF/DOCX/XLSX text extraction with page-level chunking**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-25T07:45:48Z
- **Completed:** 2026-03-25T07:54:47Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Three ORM models (TrainingMaterial, MaterialVersion, MaterialChunk) with FK relationships, indexes, and TimestampMixin
- Pydantic v2 schemas for all CRUD operations (MaterialCreate, MaterialUpdate, MaterialOut, MaterialListOut, MaterialVersionOut, MaterialChunkOut)
- Pluggable StorageBackend protocol with local filesystem implementation and Azure Blob stub
- Text extraction service supporting PDF (page-level), DOCX (paragraph-chunked), XLSX (sheet-per-chunk) with configurable overlap
- Alembic migration creating three tables with appropriate indexes
- Config settings for material_storage_path, material_max_size_mb, material_retention_days

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies, add config settings, create ORM models and schemas** - `2a983e0` (feat)
2. **Task 2: Create storage adapter and text extraction service** - `5d1ba95` (feat)

## Files Created/Modified
- `backend/app/models/material.py` - TrainingMaterial, MaterialVersion, MaterialChunk ORM models
- `backend/app/schemas/material.py` - Pydantic v2 request/response schemas
- `backend/app/services/storage/__init__.py` - StorageBackend protocol and get_storage factory
- `backend/app/services/storage/local.py` - Local filesystem storage backend using aiofiles
- `backend/app/services/storage/azure_blob.py` - Azure Blob Storage stub for production
- `backend/app/services/text_extractor.py` - PDF/DOCX/XLSX text extraction with chunking
- `backend/alembic/versions/b148c6bf1d9b_add_training_material_tables.py` - Migration for 3 tables
- `backend/pyproject.toml` - Added pypdf, python-docx, openpyxl, aiofiles dependencies
- `backend/app/config.py` - Added material storage/size/retention settings
- `backend/.env.example` - Added material config env vars
- `backend/app/models/__init__.py` - Re-exported new material models
- `backend/alembic/env.py` - Added material model imports for migration discovery

## Decisions Made
- Used Protocol (not ABC) for StorageBackend to allow structural typing
- Local filesystem storage for MVP development, Azure Blob as a stub for future production
- Page-level chunking for PDF, paragraph-group chunking for DOCX, sheet-per-chunk for XLSX
- 2000-char chunk size with 200-char overlap balances context window usage and retrieval relevance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed Alembic migration generation with out-of-sync DB**
- **Found during:** Task 1 (Alembic migration)
- **Issue:** Local SQLite DB was out of sync with Alembic revision history; tables already existed from prior runs
- **Fix:** Stamped current DB state as head, dropped material tables, regenerated migration cleanly
- **Files modified:** None (runtime fix only)
- **Verification:** Migration file correctly contains CREATE TABLE for all three material tables
- **Committed in:** 2a983e0 (Task 1 commit)

**2. [Rule 3 - Blocking] Added ScoringRubric to alembic env.py imports**
- **Found during:** Task 1 (alembic env.py update)
- **Issue:** ScoringRubric was missing from alembic/env.py import list per plan instructions
- **Fix:** Added ScoringRubric alongside the new material model imports
- **Files modified:** backend/alembic/env.py
- **Committed in:** 2a983e0 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for correct migration generation. No scope creep.

## Issues Encountered
- Local dev DB had tables from prior manual runs causing "table already exists" errors during Alembic upgrade. Resolved by stamping head and regenerating migration.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Data foundation complete: models, schemas, storage adapter, and text extractor ready
- Plan 02 can build the material service layer and API routes on top of these artifacts
- Plan 03 can build the frontend material management UI

---
*Phase: 05-training-material-management*
*Completed: 2026-03-25*
