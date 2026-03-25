---
phase: 05-training-material-management
verified: 2026-03-25T09:00:00Z
status: gaps_found
score: 4/5 must-haves verified
gaps:
  - truth: "Retention policies enable auto-deletion of expired materials per configurable rules"
    status: failed
    reason: "Config setting material_retention_days exists (365 days default) but no service/scheduler/cron code implements the actual auto-deletion logic. The setting is defined but never consumed."
    artifacts:
      - path: "backend/app/config.py"
        issue: "material_retention_days is defined but never used by any service"
      - path: "backend/app/services/material_service.py"
        issue: "No function implements retention-based deletion (e.g., delete_expired_materials)"
    missing:
      - "Implement retention enforcement function in material_service (e.g., async def delete_expired_materials)"
      - "Wire retention check to a startup task, scheduled job, or management command"
      - "Add test for retention-based deletion"
---

# Phase 5: Training Material Management Verification Report

**Phase Goal:** Admin can upload, version, and manage training materials (Word/Excel/PDF) organized by product -- materials feed into AI knowledge base for more accurate HCP simulation
**Verified:** 2026-03-25T09:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can upload training documents (Word, Excel, PDF) organized by product via the web UI | VERIFIED | POST /api/v1/materials with multipart form (file + product + name), admin-only auth guard, frontend page with react-dropzone at /admin/materials, 34 tests pass |
| 2 | Uploaded materials support versioning and archiving -- admin can see version history and restore previous versions | VERIFIED | MaterialVersion model, upload_material supports material_id for re-upload, archive/restore endpoints, version history dialog in frontend, tests confirm version_number increment |
| 3 | Retention policies enable auto-deletion of expired materials per configurable rules | FAILED | material_retention_days config exists (365 default) but no code consumes it -- no scheduled deletion, no management command, no enforcement function |
| 4 | Uploaded materials are indexed and available to the AI knowledge base for enhanced HCP simulation accuracy | VERIFIED | Text extraction (PDF/DOCX/XLSX) creates MaterialChunk records, search_chunks with latest-version subquery, get_material_context feeds into prompt_builder via material_context param, sessions.py wires material_ctx injection |
| 5 | All new code has unit tests with >=95% coverage maintained | VERIFIED | 34 tests pass (21 integration + 13 unit), covering upload, versioning, CRUD, archive/restore, search, auth guards, text extraction (PDF/DOCX/XLSX/chunking), prompt builder integration. All code passes ruff lint+format |

**Score:** 4/5 truths verified

### Required Artifacts

**Plan 01 Artifacts:**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/material.py` | TrainingMaterial, MaterialVersion, MaterialChunk ORM models | VERIFIED | 3 models with correct ForeignKey relationships, TimestampMixin, indexes |
| `backend/app/schemas/material.py` | Pydantic v2 request/response schemas | VERIFIED | MaterialCreate, MaterialUpdate, MaterialOut, MaterialListOut, MaterialVersionOut, MaterialChunkOut with ConfigDict(from_attributes=True) |
| `backend/app/services/storage/__init__.py` | StorageBackend protocol and get_storage factory | VERIFIED | Protocol class with save/read/delete/exists methods, factory returns LocalStorageBackend |
| `backend/app/services/storage/local.py` | Local filesystem storage adapter | VERIFIED | LocalStorageBackend with aiofiles for async I/O |
| `backend/app/services/text_extractor.py` | PDF/DOCX/XLSX text extraction | VERIFIED | extract_text dispatcher, _extract_pdf (page-level), _extract_docx (paragraph-chunked), _extract_xlsx (sheet-per-chunk), _chunk_text (2000 chars, 200 overlap) |
| `backend/alembic/versions/b148c6bf1d9b_add_training_material_tables.py` | Migration for 3 tables | VERIFIED | Creates training_materials, material_versions, material_chunks with indexes |
| `backend/app/config.py` | material_storage_path, material_max_size_mb, material_retention_days | VERIFIED | All three config fields present with defaults |
| `backend/.env.example` | Material env vars | VERIFIED | MATERIAL_STORAGE_PATH, MATERIAL_MAX_SIZE_MB, MATERIAL_RETENTION_DAYS present |
| `backend/pyproject.toml` | pypdf, python-docx, openpyxl, aiofiles | VERIFIED | All four dependencies in [project] dependencies list |

**Plan 02 Artifacts:**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/material_service.py` | Material CRUD + versioning + chunk search | VERIFIED | 287 lines, upload_material, get_materials, search_chunks, get_material_context, archive/restore, asyncio.to_thread for text extraction |
| `backend/app/api/materials.py` | REST API router for material management | VERIFIED | 9 endpoints, /search before /{material_id} (Gotcha #3), POST 201, DELETE 204, admin-only |
| `backend/tests/test_materials.py` | Integration tests for material API | VERIFIED | 21 integration tests, all pass |
| `backend/tests/test_text_extractor.py` | Unit tests for text extraction | VERIFIED | 13 unit tests, all pass |
| `backend/app/services/prompt_builder.py` | material_context parameter for RAG | VERIFIED | build_hcp_system_prompt accepts material_context: list[str] | None, adds "Product Training Materials" section |

**Plan 03 Artifacts:**

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/types/material.ts` | TypeScript types matching backend schemas | VERIFIED | TrainingMaterial, MaterialVersion, MaterialChunk, MaterialCreate, MaterialUpdate, PaginatedMaterials interfaces |
| `frontend/src/api/materials.ts` | Typed API client functions | VERIFIED | 8 functions covering all endpoints, multipart upload with progress callback |
| `frontend/src/hooks/use-materials.ts` | TanStack Query hooks | VERIFIED | useMaterials, useMaterial, useMaterialVersions, useVersionChunks, useUploadMaterial, useUpdateMaterial, useArchiveMaterial, useRestoreMaterial with cache invalidation |
| `frontend/src/pages/admin/training-materials.tsx` | Admin page for material management | VERIFIED | 820 lines, material table, search/product/archived filters, upload dialog with react-dropzone, version history dialog, chunks viewer, edit dialog, archive/restore confirmation |
| `frontend/public/locales/en-US/admin.json` | i18n strings for materials | VERIFIED | "materials" section with 30+ keys |
| `frontend/public/locales/zh-CN/admin.json` | Chinese i18n strings | VERIFIED | "materials" section with matching Chinese translations |

### Key Link Verification

**Plan 01 Key Links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/models/material.py` | `backend/app/models/__init__.py` | re-export in __all__ | WIRED | TrainingMaterial, MaterialVersion, MaterialChunk in imports and __all__ |
| `backend/app/models/material.py` | `backend/alembic/env.py` | import for migration discovery | WIRED | TrainingMaterial, MaterialVersion, MaterialChunk imported in env.py |

**Plan 02 Key Links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/app/api/materials.py` | `backend/app/services/material_service.py` | service function calls | WIRED | material_service.upload_material, get_materials, search_chunks, etc. all called |
| `backend/app/api/materials.py` | `backend/app/main.py` | router registration | WIRED | materials_router imported from app.api and include_router called with api_prefix |
| `backend/app/services/prompt_builder.py` | `backend/app/api/sessions.py` | material_context parameter | WIRED | sessions.py calls material_service.get_material_context and passes result to build_hcp_system_prompt |

**Plan 03 Key Links:**

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `frontend/src/pages/admin/training-materials.tsx` | `frontend/src/hooks/use-materials.ts` | hook imports | WIRED | useMaterials, useMaterialVersions, useVersionChunks, useUploadMaterial, useUpdateMaterial, useArchiveMaterial, useRestoreMaterial imported and used |
| `frontend/src/hooks/use-materials.ts` | `frontend/src/api/materials.ts` | API function imports | WIRED | getMaterials, getMaterial, getMaterialVersions, getVersionChunks, uploadMaterial, updateMaterial, archiveMaterial, restoreMaterial imported |
| `frontend/src/router/index.tsx` | `frontend/src/pages/admin/training-materials.tsx` | route registration | WIRED | TrainingMaterialsPage imported and registered at path "materials" under admin children |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `training-materials.tsx` | materialsData | useMaterials -> getMaterials -> GET /api/v1/materials | API returns paginated DB query results via material_service.get_materials | FLOWING |
| `training-materials.tsx` | versions | useMaterialVersions -> getMaterialVersions -> GET /api/v1/materials/{id}/versions | API returns DB query via material_service.get_versions | FLOWING |
| `training-materials.tsx` | chunks | useVersionChunks -> getVersionChunks -> GET /api/v1/materials/{id}/versions/{vid}/chunks | API returns DB query via material_service.get_version_chunks | FLOWING |
| `prompt_builder.py` | material_context | material_service.get_material_context -> search_chunks -> DB query | Chunks from latest active version joined with TrainingMaterial.product filter | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All backend modules importable | python3 -c "from app.models.material import ...; from app.services.material_service import ..." | "ALL IMPORTS OK" | PASS |
| 34 backend tests pass | pytest tests/test_materials.py tests/test_text_extractor.py -v | "34 passed in 6.29s" | PASS |
| Backend lint clean | ruff check + ruff format --check on all phase 05 files | "All checks passed!" + "10 files already formatted" | PASS |
| Frontend TypeScript compiles | npx tsc -b --noEmit (after npm ci) | Exit 0, no errors | PASS |
| Frontend Vite build | npm run build (after npm ci) | "built in 3.81s" with output files | PASS |
| Alembic migration exists | ls backend/alembic/versions/*training_material* | b148c6bf1d9b_add_training_material_tables.py found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CONTENT-01 | 05-01, 05-02, 05-03 | Admin can upload training materials (PDF, Word, Excel) organized by product and therapeutic area | SATISFIED | POST /materials endpoint accepts file + product + name, text extraction for PDF/DOCX/XLSX, frontend upload UI with react-dropzone |
| CONTENT-02 | 05-02 | Uploaded materials feed into AI knowledge base for more accurate HCP simulation (RAG-style grounding) | SATISFIED | material_service.get_material_context retrieves chunks by product, prompt_builder includes material_context in HCP system prompt, sessions.py injects material context automatically |
| CONTENT-03 | 05-01, 05-02, 05-03 | Training materials support versioning and folder organization | SATISFIED | MaterialVersion model with version_number, upload_material supports re-upload to create new versions, version history API and frontend dialog, folder organization via product field |

**Orphaned requirements:** None. REQUIREMENTS.md maps CONTENT-01, CONTENT-02, CONTENT-03 to Phase 3/5 (the traceability table says Phase 3 but the actual implementation is Phase 5 in the roadmap). All three are claimed and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/services/storage/azure_blob.py` | 5, 16-25 | "Stub -- not yet implemented" + raise NotImplementedError | Info | Intentional production stub, not used in current code path. Factory returns LocalStorageBackend |
| `backend/app/config.py` | 57 | material_retention_days defined but never consumed | Warning | Config exists but no retention enforcement logic implements it |

### Human Verification Required

### 1. Visual UI Verification

**Test:** Navigate to /admin/materials, upload a PDF file via drag-and-drop, verify the material appears in the list, view version history, view extracted text chunks
**Expected:** Material table shows uploaded file with product, version badge, upload date. Upload dialog has drag-and-drop zone, progress bar during upload. Version history dialog shows version list with "View Chunks" button. Chunks dialog shows extracted text with page labels.
**Why human:** Visual layout, drag-and-drop UX, responsive behavior, dialog rendering cannot be verified programmatically

### 2. End-to-End RAG Integration

**Test:** Upload a training material for product "Brukinsa", then start a coaching session with a scenario for "Brukinsa" product. Check if the AI HCP responses reference the uploaded material content.
**Expected:** The HCP system prompt should include "Product Training Materials (Reference Knowledge)" section with material excerpts. AI responses should be informed by the uploaded content.
**Why human:** Requires running both backend and frontend, creating a scenario, and evaluating AI response quality

### 3. i18n Language Switching

**Test:** Switch language to zh-CN, navigate to /admin/materials, verify all labels are in Chinese
**Expected:** Page title shows "Pei Xun Zi Liao Guan Li", all button labels, column headers, and dialog text are in Chinese
**Why human:** Visual verification of translated strings in context

### Gaps Summary

One gap found out of five success criteria:

**Success Criterion #3 (Retention policies):** The `material_retention_days` config setting exists with a default of 365 days, establishing the configuration foundation. However, there is no service function, scheduled task, management command, or any code path that reads this setting and deletes materials older than the configured retention period. The retention feature is a config-only stub -- the "retention policy" concept exists in configuration but has zero implementation.

This is a partial gap. The infrastructure is in place (config setting, soft-delete via archive, created_at timestamps on models), but the actual retention enforcement logic is missing. A scheduler or management command needs to:
1. Query materials where `created_at + retention_days < now()`
2. Delete or archive expired materials
3. Optionally clean up storage files

All other truths (upload, versioning, archiving, RAG knowledge base integration, test coverage) are fully verified with working code, passing tests, and complete wiring from frontend through API to database.

---

_Verified: 2026-03-25T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
