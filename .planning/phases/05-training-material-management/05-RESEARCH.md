# Phase 5: Training Material Management - Research

**Researched:** 2026-03-25
**Domain:** File upload, document processing, text extraction, RAG-style knowledge indexing, admin CRUD UI
**Confidence:** HIGH

## Summary

Phase 5 adds the ability for admins to upload training materials (PDF, DOCX, XLSX) organized by product, manage versions and retention, extract text for searchable chunks, and integrate those chunks into the AI coaching prompt pipeline. The codebase has well-established patterns for every layer (model, service, schema, router, API client, TanStack Query hook, admin page) that this phase follows directly.

The primary technical challenge is document text extraction -- requiring three new Python dependencies (pypdf, python-docx, openpyxl) that are all mature, well-maintained, and pure-Python. The chunking and search integration is straightforward: store extracted text as page-level chunks in a regular SQLAlchemy table with basic `LIKE` search for MVP (SQLite FTS5 is available but adds unnecessary complexity for the initial implementation). The prompt builder already accepts scenario context and can be extended to inject material chunks.

**Primary recommendation:** Follow the exact CRUD patterns from scenarios/HCP profiles for the material management layer. Use a pluggable storage adapter (local filesystem dev, Azure Blob prod) consistent with ARCH-01. Extract text synchronously on upload (documents are small -- medical training materials under 50MB). Store chunks in a `material_chunks` table linked to material versions, and extend `prompt_builder.py` to include relevant chunks in HCP system prompts.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Storage backend uses pluggable adapter pattern: local filesystem for dev, Azure Blob Storage for prod (consistent with ARCH-01)
- Upload size limit: 50MB per file, single file upload per request
- File format validation: MIME type + extension whitelist on backend, accept PDF/DOCX/XLSX only
- Material organization: flat by product with tags, consistent with existing scenario-product grouping from Phase 2
- Linear version sequence (v1, v2, v3) for simplicity and admin intuitiveness
- Re-upload of same material auto-creates new version, preserving full history and audit trail
- Soft delete with archived flag + admin restore capability (matches CONTENT-03 versioning requirement)
- Configurable per-product retention rules with background cleanup task (meets success criterion 3)
- Extract text on upload, store as searchable chunks for immediate RAG availability
- Page-level chunking with overlap for good granularity on medical content
- SQLAlchemy full-text search for MVP, pluggable interface for Azure AI Search later (keeps dev simple, prod-ready via adapter)
- Materials linked via product -- HCP session auto-includes relevant product materials as context (aligns with scenario-product relationship from Phase 2)

### Claude's Discretion
No items deferred to Claude's discretion -- all areas explicitly decided.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONTENT-01 | Admin can upload training materials (PDF, Word, Excel) organized by product and therapeutic area | File upload via FastAPI UploadFile, pypdf/python-docx/openpyxl for validation, storage adapter pattern, material model with product FK |
| CONTENT-02 | Uploaded materials feed into AI knowledge base for more accurate HCP simulation (RAG-style grounding) | Text extraction pipeline, MaterialChunk model, prompt_builder.py extension to inject relevant chunks into HCP system prompt |
| CONTENT-03 | Training materials support versioning and folder organization | MaterialVersion model with linear version sequence, soft delete with archived flag, version history API endpoints |
</phase_requirements>

## Standard Stack

### Core (Backend - New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pypdf | 6.9.2 | PDF text extraction | Pure Python, actively maintained successor to PyPDF2, no native deps |
| python-docx | 1.2.0 | DOCX text extraction | Standard library for Word docs, pure Python with lxml |
| openpyxl | 3.1.5 | XLSX text extraction | Standard library for Excel files, pure Python |
| aiofiles | 25.1.0 | Async file I/O for storage adapter | Required for non-blocking file writes in async FastAPI |

### Core (Frontend - New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-dropzone | 15.0.0 | File upload drag-and-drop UI | De facto standard for React file uploads, accessible, typed |

### Existing (Already in project)
| Library | Purpose | Used For |
|---------|---------|----------|
| python-multipart >= 0.0.9 | FastAPI file upload parsing | Already a dependency -- enables `UploadFile` |
| axios | HTTP client with interceptors | Upload via `multipart/form-data` with progress |
| @radix-ui/react-progress | Progress bar component | Upload progress indicator |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pypdf | PyMuPDF (fitz) | Better extraction quality but requires C libs, complicates Docker |
| react-dropzone | Native input[type=file] | Less accessible, no drag-and-drop, more boilerplate |
| aiofiles | Synchronous file writes | Would block the event loop on large files |
| SQLAlchemy LIKE search | SQLite FTS5 virtual table | FTS5 is faster but requires non-standard Alembic migration, SQLAlchemy FTS5 integration is awkward -- LIKE is sufficient for MVP material volumes |

**Installation:**
```bash
# Backend
cd backend
pip install pypdf python-docx openpyxl aiofiles

# Frontend
cd frontend
npm install react-dropzone
```

**Version verification:** All versions confirmed via pip index and npm registry on 2026-03-25.

## Architecture Patterns

### Recommended New Files Structure
```
backend/app/
  models/
    material.py              # TrainingMaterial, MaterialVersion, MaterialChunk
  schemas/
    material.py              # MaterialCreate, MaterialOut, VersionOut, ChunkOut
  services/
    material_service.py      # CRUD + versioning logic
    text_extractor.py        # PDF/DOCX/XLSX text extraction
    storage/
      __init__.py            # StorageBackend protocol + get_storage()
      local.py               # LocalStorageBackend (dev)
      azure_blob.py          # AzureBlobStorageBackend (prod, stub)
  api/
    materials.py             # Router: upload, list, version history, delete, restore, chunks

frontend/src/
  types/
    material.ts              # TrainingMaterial, MaterialVersion, MaterialChunk types
  api/
    materials.ts             # API client functions
  hooks/
    use-materials.ts         # TanStack Query hooks
  pages/admin/
    training-materials.tsx   # Admin page
  components/admin/
    material-list.tsx        # Material table with filters
    material-upload.tsx      # Upload dialog with drag-and-drop
    material-versions.tsx    # Version history panel
```

### Pattern 1: Storage Adapter (Pluggable Backend)
**What:** Abstract file storage behind a protocol/ABC so local filesystem is used in dev and Azure Blob Storage in prod.
**When to use:** Any file I/O operation (save, read, delete).
**Example:**
```python
# backend/app/services/storage/__init__.py
from typing import Protocol

class StorageBackend(Protocol):
    async def save(self, path: str, content: bytes) -> str:
        """Save file, return storage URL/path."""
        ...

    async def read(self, path: str) -> bytes:
        """Read file content."""
        ...

    async def delete(self, path: str) -> None:
        """Delete file from storage."""
        ...

    async def exists(self, path: str) -> bool:
        """Check if file exists."""
        ...
```

### Pattern 2: Text Extraction Service
**What:** Stateless module that accepts file bytes + content type and returns extracted text pages.
**When to use:** Called during upload to populate MaterialChunk records.
**Example:**
```python
# backend/app/services/text_extractor.py
from pypdf import PdfReader
from docx import Document
from openpyxl import load_workbook
import io

def extract_text(content: bytes, content_type: str) -> list[str]:
    """Extract text pages from document. Returns list of page-level strings."""
    if content_type == "application/pdf":
        return _extract_pdf(content)
    elif content_type in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        return _extract_docx(content)
    elif content_type in (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ):
        return _extract_xlsx(content)
    return []

def _extract_pdf(content: bytes) -> list[str]:
    reader = PdfReader(io.BytesIO(content))
    return [page.extract_text() or "" for page in reader.pages]

def _extract_docx(content: bytes) -> list[str]:
    doc = Document(io.BytesIO(content))
    # Group paragraphs into logical pages (DOCX has no inherent pages)
    # Use section breaks or paragraph count as chunking boundary
    full_text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return _chunk_text(full_text, chunk_size=2000, overlap=200)

def _extract_xlsx(content: bytes) -> list[str]:
    wb = load_workbook(io.BytesIO(content), data_only=True, read_only=True)
    pages = []
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        rows = []
        for row in ws.iter_rows(values_only=True):
            cells = [str(c) for c in row if c is not None]
            if cells:
                rows.append(" | ".join(cells))
        if rows:
            pages.append(f"Sheet: {sheet}\n" + "\n".join(rows))
    return pages
```

### Pattern 3: Version Auto-Increment
**What:** When re-uploading to an existing material, auto-create a new MaterialVersion with incremented version number.
**When to use:** Upload endpoint when material_id is provided.
**Example:**
```python
async def upload_version(
    db: AsyncSession, material_id: str, file_content: bytes,
    filename: str, content_type: str, storage: StorageBackend
) -> MaterialVersion:
    material = await get_material(db, material_id)
    # Get next version number
    latest = await _get_latest_version(db, material_id)
    next_version = (latest.version_number + 1) if latest else 1
    # Store file
    storage_path = f"materials/{material_id}/v{next_version}/{filename}"
    storage_url = await storage.save(storage_path, file_content)
    # Create version record
    version = MaterialVersion(
        material_id=material_id,
        version_number=next_version,
        filename=filename,
        file_size=len(file_content),
        content_type=content_type,
        storage_url=storage_url,
    )
    db.add(version)
    await db.flush()
    # Extract and store chunks
    pages = extract_text(file_content, content_type)
    for i, text in enumerate(pages):
        if text.strip():
            chunk = MaterialChunk(
                version_id=version.id,
                material_id=material_id,
                chunk_index=i,
                content=text,
            )
            db.add(chunk)
    await db.flush()
    return version
```

### Pattern 4: Knowledge Base Integration via Prompt Builder
**What:** Extend the existing `prompt_builder.py` to include relevant material chunks when building HCP system prompts.
**When to use:** During coaching session initialization -- look up materials by product, inject as context.
**Example:**
```python
# Extension to prompt_builder.py
def build_hcp_system_prompt(
    hcp_profile: HcpProfile,
    scenario: Scenario,
    key_messages: list[str],
    material_context: list[str] | None = None,  # NEW
) -> str:
    # ... existing prompt building ...
    if material_context:
        prompt_parts.extend([
            "",
            "# Product Training Materials (Reference Knowledge)",
            "Use the following product information to inform your responses:",
        ])
        for i, chunk in enumerate(material_context, 1):
            prompt_parts.append(f"\n--- Material Excerpt {i} ---\n{chunk}")
    # ... rest of prompt ...
```

### Anti-Patterns to Avoid
- **Processing files in background tasks:** Decision is to extract text synchronously on upload. With a 50MB limit on medical training materials, extraction takes < 5 seconds. Background tasks add complexity without benefit.
- **Storing file content in the database:** Store files on filesystem/blob storage, only metadata and text chunks in the DB.
- **Using virtual FTS5 tables with Alembic:** FTS5 virtual tables cannot be managed by Alembic autogenerate. Use regular tables with LIKE/ILIKE queries for MVP.
- **Returning file content in JSON responses:** Return URLs/paths, not base64-encoded content. Frontend downloads files via a separate endpoint.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom PDF parser | `pypdf.PdfReader` | PDF format is complex; pypdf handles encoding, layout, encryption |
| DOCX text extraction | XML parsing of .docx | `python-docx.Document` | DOCX is a zip of XML files; python-docx abstracts this correctly |
| XLSX text extraction | Custom Excel reader | `openpyxl.load_workbook` | Excel format has multiple internal representations |
| File upload drag-and-drop | Custom drag events | `react-dropzone` | Cross-browser drag-and-drop is tricky; accessibility built in |
| MIME type detection | Extension-only check | Dual check: extension + `python-multipart` content-type header | Rely on both -- extension alone can be spoofed |
| Pagination | Custom offset logic | Existing `PaginatedResponse.create()` | Already has battle-tested implementation |
| Query invalidation | Manual cache clear | TanStack Query `invalidateQueries` | Already used across all hooks |

**Key insight:** Document parsing is deceptively complex. Even simple-looking PDFs can have encoding issues, embedded fonts, or layout quirks that only mature libraries handle correctly. pypdf, python-docx, and openpyxl are the standard choices used across the Python ecosystem.

## Common Pitfalls

### Pitfall 1: File Size Validation Timing
**What goes wrong:** Large files consume memory before validation rejects them.
**Why it happens:** FastAPI reads the entire `UploadFile` into memory by default when you call `await file.read()`.
**How to avoid:** Check `Content-Length` header first as a quick reject, then stream-read with a size counter. For 50MB limit this is not critical but is good practice.
**Warning signs:** Memory spikes during upload testing.

### Pitfall 2: MIME Type Mismatch
**What goes wrong:** A `.pdf` file uploads with `application/octet-stream` MIME type.
**Why it happens:** Browser MIME detection varies; some browsers send generic types.
**How to avoid:** Validate both: (1) file extension against whitelist, (2) attempt to open with the corresponding library (pypdf/python-docx/openpyxl) -- if it fails, reject. The library-level validation is the true authority.
**Warning signs:** Upload succeeds but text extraction returns empty results.

### Pitfall 3: SQLite Batch Mode for Alembic Migration
**What goes wrong:** `ALTER TABLE` fails in SQLite migration.
**Why it happens:** SQLite has limited ALTER TABLE support (Gotcha #1 from CLAUDE.md).
**How to avoid:** Alembic `env.py` already has `render_as_batch=True`. New migrations auto-use batch mode. Verify this is still set.
**Warning signs:** Alembic upgrade fails with "near ALTER: syntax error".

### Pitfall 4: Async File I/O Blocking the Event Loop
**What goes wrong:** Synchronous `open()` / `write()` calls block the async event loop during uploads.
**Why it happens:** Standard Python file I/O is synchronous.
**How to avoid:** Use `aiofiles` for all file operations in the storage adapter, or use `asyncio.to_thread()` for the text extraction calls (which are CPU-bound synchronous operations).
**Warning signs:** Other requests hang during file upload/processing.

### Pitfall 5: Alembic env.py Model Import
**What goes wrong:** New models not detected by autogenerate migration.
**Why it happens:** Alembic env.py must import all models for metadata registration (Gotcha #7).
**How to avoid:** After creating new models in `material.py`, add imports to `app/models/__init__.py` AND `alembic/env.py`.
**Warning signs:** `alembic revision --autogenerate` generates an empty migration.

### Pitfall 6: Multipart Form Data with Axios
**What goes wrong:** File upload fails with 422 Validation Error.
**Why it happens:** Axios defaults to `application/json`. File uploads need `multipart/form-data`.
**How to avoid:** Use `FormData` object with axios. The Content-Type header is auto-set when using FormData.
**Warning signs:** Backend receives empty file or parsing error.

### Pitfall 7: Chinese Text in PDF Extraction
**What goes wrong:** pypdf extracts garbled text from Chinese-language PDFs.
**Why it happens:** Some PDFs use CID-keyed fonts without embedded ToUnicode maps.
**How to avoid:** Test with representative Chinese medical PDFs early. pypdf handles most CJK correctly since v3+. If quality is poor, fall back to storing the raw document reference without chunks.
**Warning signs:** Extracted text contains `\x00` or replacement characters.

## Code Examples

### Backend: FastAPI File Upload Endpoint
```python
# Source: FastAPI official docs + codebase pattern
from fastapi import APIRouter, Depends, File, UploadFile, Form, Query
from fastapi.responses import Response

router = APIRouter(prefix="/materials", tags=["materials"])

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".xlsx"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

@router.post("/", status_code=201)
async def upload_material(
    file: UploadFile = File(...),
    product: str = Form(...),
    name: str = Form(...),
    tags: str = Form(""),  # comma-separated
    material_id: str | None = Form(None),  # if re-uploading for new version
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Upload a training material. Creates new material or adds version to existing."""
    # Validate extension
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        bad_request(f"File type {ext} not allowed. Accepted: PDF, DOCX, XLSX")
    # Read content
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        bad_request("File exceeds 50MB limit")
    # Delegate to service
    result = await material_service.upload_material(
        db, content=content, filename=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        product=product, name=name, tags=tags,
        material_id=material_id, user_id=user.id,
    )
    return result
```

### Backend: SQLAlchemy Models
```python
# Source: Codebase pattern (scenario.py, score.py)
class TrainingMaterial(Base, TimestampMixin):
    """Training material metadata -- one per logical document."""
    __tablename__ = "training_materials"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    product: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    therapeutic_area: Mapped[str] = mapped_column(String(255), default="")
    tags: Mapped[str] = mapped_column(Text, default="")  # comma-separated
    is_archived: Mapped[bool] = mapped_column(default=False)
    current_version: Mapped[int] = mapped_column(default=1)
    created_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    versions = relationship("MaterialVersion", back_populates="material",
                           order_by="MaterialVersion.version_number.desc()")


class MaterialVersion(Base, TimestampMixin):
    """Specific version of a training material with file metadata."""
    __tablename__ = "material_versions"

    material_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("training_materials.id"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size: Mapped[int] = mapped_column(nullable=False)  # bytes
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    storage_url: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)

    # Relationships
    material = relationship("TrainingMaterial", back_populates="versions")
    chunks = relationship("MaterialChunk", back_populates="version",
                         cascade="all, delete-orphan")


class MaterialChunk(Base, TimestampMixin):
    """Extracted text chunk from a material version for RAG search."""
    __tablename__ = "material_chunks"

    version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("material_versions.id"), nullable=False
    )
    material_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("training_materials.id"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    page_label: Mapped[str] = mapped_column(String(50), default="")  # "Page 3" or "Sheet: Data"

    # Relationships
    version = relationship("MaterialVersion", back_populates="chunks")
```

### Frontend: File Upload with react-dropzone + Axios FormData
```typescript
// Source: react-dropzone docs + codebase axios pattern
import apiClient from "./client";

export async function uploadMaterial(
  file: File,
  product: string,
  name: string,
  tags?: string,
  materialId?: string,
  onProgress?: (percent: number) => void,
) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("product", product);
  formData.append("name", name);
  if (tags) formData.append("tags", tags);
  if (materialId) formData.append("material_id", materialId);

  const { data } = await apiClient.post("/materials", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (event) => {
      if (event.total && onProgress) {
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    },
  });
  return data;
}
```

### Frontend: TanStack Query Hook Pattern
```typescript
// Source: Codebase pattern (use-hcp-profiles.ts)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMaterials, uploadMaterial, deleteMaterial } from "@/api/materials";

export function useMaterials(params?: { product?: string; search?: string }) {
  return useQuery({
    queryKey: ["materials", params],
    queryFn: () => getMaterials(params),
  });
}

export function useUploadMaterial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: { file: File; product: string; name: string }) =>
      uploadMaterial(args.file, args.product, args.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PyPDF2 | pypdf (v3+, now v6) | 2023 | PyPDF2 is deprecated, pypdf is the maintained successor |
| Sync file I/O in FastAPI | aiofiles for async I/O | Always best practice | Prevents blocking event loop |
| FTS via LIKE queries | FTS5 virtual tables or dedicated search service | Available but overkill for MVP | LIKE is fine for < 10K chunks; upgrade to Azure AI Search in prod |

**Deprecated/outdated:**
- PyPDF2: Deprecated, replaced by pypdf. Do NOT use PyPDF2.
- PyPDF4: Dead fork. Use pypdf.
- xlrd: Only supports .xls (old format). Use openpyxl for .xlsx.

## Open Questions

1. **Background Retention Cleanup Task**
   - What we know: Decision says "configurable per-product retention rules with background cleanup task"
   - What's unclear: Whether to use a simple periodic background task (FastAPI lifespan with asyncio.create_task), APScheduler, or external cron
   - Recommendation: Use a simple async background task started in the FastAPI lifespan, similar to how mock adapters are registered. Run every hour, check retention rules, soft-delete expired materials. This keeps it in-process and testable without external dependencies.

2. **Material Search Query Integration**
   - What we know: Need to retrieve relevant chunks for a product during coaching sessions
   - What's unclear: Whether to search all active version chunks or only the latest version
   - Recommendation: Search only chunks from the latest active version of each material for a given product. This avoids duplicate/stale context and keeps prompt size manageable.

3. **Chunk Size Optimization**
   - What we know: Decision says "page-level chunking with overlap for good granularity"
   - What's unclear: Optimal chunk size and overlap for medical training documents
   - Recommendation: Target ~2000 characters per chunk with ~200 character overlap. For PDFs, natural page boundaries. For DOCX (no pages), use paragraph-count-based splitting. For XLSX, one sheet per chunk.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Yes | 3.11.9 | -- |
| Node.js 20+ | Frontend | Yes | 23.11.0 | -- |
| pypdf | PDF extraction | Not installed | 6.9.2 (pip) | pip install |
| python-docx | DOCX extraction | Not installed | 1.2.0 (pip) | pip install |
| openpyxl | XLSX extraction | Not installed | 3.1.5 (pip) | pip install |
| aiofiles | Async file I/O | Not installed | 25.1.0 (pip) | pip install |
| react-dropzone | File upload UI | Not installed | 15.0.0 (npm) | npm install |
| SQLite FTS5 | Full-text search | Yes (built into SQLite) | -- | Not needed for MVP (using LIKE) |

**Missing dependencies with no fallback:**
- None -- all missing dependencies are installable via pip/npm

**Missing dependencies with fallback:**
- None -- all are straightforward installs

## Project Constraints (from CLAUDE.md)

- **Async everywhere:** All backend functions must be `async def` with `await`. Storage adapter methods must be async.
- **Pydantic v2 schemas:** All request/response schemas use `model_config = ConfigDict(from_attributes=True)`.
- **Service layer holds business logic:** Router only handles HTTP delegation (no business logic in route handlers).
- **Create returns 201, Delete returns 204:** Follow existing status code conventions.
- **Static routes before parameterized routes:** Any static material routes (e.g., `/search`) must come before `/{material_id}`.
- **No raw SQL:** Use SQLAlchemy ORM. LIKE queries via `column.ilike()`.
- **Alembic for schema changes:** Must create migration via `alembic revision --autogenerate`.
- **`render_as_batch=True`:** Already set in env.py for SQLite compatibility.
- **Import models in alembic/env.py:** New models must be imported there.
- **ruff format + ruff check:** Must pass before commit.
- **TypeScript strict mode:** No `any` types. All types defined in `src/types/`.
- **TanStack Query hooks per domain:** No inline `useQuery` in components.
- **i18n externalized:** All UI strings via react-i18next. New `materials` namespace needed.
- **`cn()` utility** for conditional classes.
- **db.flush() not db.commit():** Service layer uses flush; commit handled by session middleware.
- **>=95% test coverage:** Required per success criteria.

## Integration Points (Existing Code to Modify)

| File | Change |
|------|--------|
| `backend/app/models/__init__.py` | Add TrainingMaterial, MaterialVersion, MaterialChunk exports |
| `backend/app/api/__init__.py` | Add materials_router export |
| `backend/app/main.py` | Register materials_router with app |
| `backend/alembic/env.py` | Import new models (TrainingMaterial, MaterialVersion, MaterialChunk) |
| `backend/app/services/prompt_builder.py` | Add `material_context` parameter to `build_hcp_system_prompt` |
| `backend/app/config.py` | Add `material_storage_path`, `material_max_size_mb`, `material_retention_days` settings |
| `backend/.env.example` | Add new config vars |
| `backend/pyproject.toml` | Add pypdf, python-docx, openpyxl, aiofiles to dependencies |
| `frontend/package.json` | Add react-dropzone |
| `frontend/src/i18n/index.ts` | Add `materials` to ns array |
| `frontend/src/router/index.tsx` | Add `/admin/training-materials` route |
| `frontend/public/locales/en-US/admin.json` | Add materials section |
| `frontend/public/locales/zh-CN/admin.json` | Add materials section (Chinese) |

Note: Admin sidebar already has `/admin/materials` entry with FileText icon in `admin-layout.tsx`. The nav.json already has `"materials": "Materials"`. These are already in place.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/app/models/`, `backend/app/services/`, `backend/app/api/`, `frontend/src/hooks/`, `frontend/src/api/` -- examined all existing CRUD patterns
- pip registry: Verified pypdf 6.9.2, python-docx 1.2.0, openpyxl 3.1.5, aiofiles 25.1.0
- npm registry: Verified react-dropzone 15.0.0
- SQLite FTS5: Verified available in local Python 3.11.9 installation

### Secondary (MEDIUM confidence)
- pypdf text extraction capabilities (CJK handling improved in v3+) -- based on training data, standard in Python ecosystem
- react-dropzone API patterns -- well-established library, training data reliable

### Tertiary (LOW confidence)
- Optimal chunk size for medical training materials (2000 chars + 200 overlap) -- this is a reasonable default but may need tuning based on actual document content

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via pip/npm, versions confirmed
- Architecture: HIGH - Follows exact patterns already established in codebase
- Pitfalls: HIGH - Based on documented gotchas in CLAUDE.md and direct codebase inspection
- Integration points: HIGH - Every file to modify was read and verified
- Chunking strategy: MEDIUM - Reasonable defaults, may need tuning

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain, libraries are mature)
