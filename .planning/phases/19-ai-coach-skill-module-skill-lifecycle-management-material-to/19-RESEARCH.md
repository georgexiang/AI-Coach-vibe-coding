# Phase 19: AI Coach Skill Module - Research

**Researched:** 2026-04-11
**Domain:** Skill lifecycle management, document-to-SOP conversion, Skill Hub UI, HCP Agent skill assignment
**Confidence:** HIGH

## Summary

Phase 19 builds a Skill module that sits on top of the existing training material and HCP Agent infrastructure. The core workflow is: admin uploads training documents (PDF, DOCX, PPTX) -> system uses Azure OpenAI to extract structured SOP content (standard operating procedures, assessment criteria, key knowledge points) -> admin publishes the Skill -> admin assigns Skills to HCP Agents -> during training sessions, the HCP Agent follows the SOP to guide and assess the MR's interaction.

This phase introduces 4 new database models (Skill, SkillVersion, SkillMaterial, SkillAssignment), a new `skill_service.py` for business logic, a new `skill_conversion_service.py` for AI-powered document-to-SOP extraction, new API routes, and a Skill Hub frontend with admin management pages. The existing `agent_sync_service.py` will be extended to inject skill SOP content into agent instructions when skills are assigned.

**Primary recommendation:** Follow the exact patterns established in Phases 5 (material upload), 11 (agent sync), and 17 (knowledge base config) -- new models with TimestampMixin, async services with `db.flush()`, Pydantic v2 schemas, TanStack Query hooks, and Alembic migrations with `server_default` for SQLite compatibility.

## Project Constraints (from CLAUDE.md)

- All Python code async (`async def`, `await`, `AsyncSession`)
- Pydantic v2 schemas with `model_config = ConfigDict(from_attributes=True)`
- Route ordering: static routes before parameterized `/{id}` routes
- Create returns 201, Delete returns 204
- Service layer holds business logic, routers only handle HTTP
- All models MUST use `TimestampMixin`
- Schema changes require Alembic migration (never delete DB file)
- All routes under `/api/v1/` prefix
- TypeScript `strict: true`, no `any` types
- TanStack Query hooks per domain, no inline `useQuery`
- i18n via react-i18next with separate namespace files
- Design tokens via CSS custom properties, `cn()` for class composition
- `server_default` in migrations for SQLite compatibility with existing rows
- `db.flush()` instead of `db.commit()` to work with session middleware

## Standard Stack

### Core (Backend - already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 | API routing, DI | Project standard [VERIFIED: pyproject.toml] |
| SQLAlchemy 2.0+ | async | ORM models | Project standard [VERIFIED: pyproject.toml] |
| Alembic | >=1.13.0 | DB migrations | Project standard [VERIFIED: pyproject.toml] |
| Pydantic v2 | >=2.0 | Request/response schemas | Project standard [VERIFIED: pyproject.toml] |
| pypdf | 6.9.2 | PDF text extraction | Already installed [VERIFIED: pip list] |
| python-docx | 1.2.0 | DOCX text extraction | Already installed [VERIFIED: pip list] |
| openai | >=1.50.0 | Azure OpenAI for SOP extraction | Project standard [VERIFIED: pyproject.toml] |
| aiofiles | >=23.0.0 | Async file I/O | Project standard [VERIFIED: pyproject.toml] |

### New (Backend - needs installation)

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| python-pptx | 1.0.2 | PPTX text extraction | Phase requires PPT/PPTX support for material-to-skill conversion [VERIFIED: pip index versions] |

### Core (Frontend - already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.60.0 | Server state | Project standard [VERIFIED: package.json] |
| react-dropzone | ^15.0.0 | File upload drag-and-drop | Used in materials page [VERIFIED: package.json] |
| axios | ^1.7.0 | HTTP client | Project standard [VERIFIED: package.json] |
| react-hook-form + zod | ^7.72.0 / ^4.3.6 | Form validation | Used in admin forms [VERIFIED: package.json] |
| lucide-react | ^0.460.0 | Icons | Project standard [VERIFIED: package.json] |
| file-saver | ^2.0.5 | File download | Already installed [VERIFIED: package.json] |

### New (Frontend - needs installation)

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| jszip | 3.10.1 | Skill package ZIP export/import | Standard library for in-browser ZIP creation and extraction [VERIFIED: npm view jszip version] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pypdf + python-docx + python-pptx | Azure Content Understanding API | CU is overkill for text extraction; local parsing is faster, cheaper, and works offline. CU better for complex document analysis (tables, images). Use local parsing for MVP. |
| jszip (frontend) | Python zipfile (backend-only) | Backend-only ZIP is simpler but prevents client-side preview before upload. Use both: backend for export API, jszip for client-side import preview. |
| Custom SOP extraction prompts | LangChain/LlamaIndex | Over-engineered for single-prompt extraction. A well-crafted Azure OpenAI prompt with structured JSON output is sufficient. |

**Installation:**

```bash
# Backend
cd backend
pip install "python-pptx>=1.0.0"
# Add to pyproject.toml dependencies

# Frontend
cd frontend
npm install jszip @types/jszip
```

## Architecture Patterns

### Recommended Project Structure

```
backend/app/
├── models/
│   └── skill.py           # Skill, SkillVersion, SkillMaterial, SkillAssignment
├── schemas/
│   └── skill.py           # Pydantic v2 request/response schemas
├── api/
│   └── skills.py          # /api/v1/skills/* routes
├── services/
│   ├── skill_service.py          # CRUD, lifecycle, assignment management
│   └── skill_conversion_service.py  # AI-powered material -> SOP extraction

frontend/src/
├── types/
│   └── skill.ts           # TypeScript interfaces
├── api/
│   └── skills.ts          # Axios API client for skills
├── hooks/
│   └── use-skills.ts      # TanStack Query hooks
├── pages/
│   ├── admin/
│   │   ├── skill-hub.tsx          # Skill list + management
│   │   └── skill-editor.tsx       # Skill create/edit with material upload
│   └── user/
│       └── skill-hub.tsx          # Read-only Skill Hub for MR users (browse available skills)
├── locales/
│   ├── en-US/skill.json   # English translations
│   └── zh-CN/skill.json   # Chinese translations
```

### Pattern 1: Skill Data Model (4 tables)

**What:** Four SQLAlchemy models following the existing TimestampMixin + relationship pattern.
**When to use:** All skill-related data persistence.

```python
# Source: Existing pattern from models/material.py, models/hcp_profile.py [VERIFIED: codebase]

class Skill(Base, TimestampMixin):
    """Training skill with lifecycle: draft -> published -> archived."""
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    product: Mapped[str] = mapped_column(String(255), default="", index=True)
    therapeutic_area: Mapped[str] = mapped_column(String(255), default="")
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft/published/archived
    tags: Mapped[str] = mapped_column(Text, default="")  # comma-separated
    current_version: Mapped[int] = mapped_column(default=1)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)

    # SOP content (structured JSON) - the core skill payload
    sop_content: Mapped[str] = mapped_column(Text, default="{}")  # JSON: structured SOP
    assessment_criteria: Mapped[str] = mapped_column(Text, default="[]")  # JSON: assessment items
    key_knowledge_points: Mapped[str] = mapped_column(Text, default="[]")  # JSON: knowledge points

    # Relationships
    versions = relationship("SkillVersion", back_populates="skill", order_by="SkillVersion.version_number.desc()")
    materials = relationship("SkillMaterial", back_populates="skill")
    assignments = relationship("SkillAssignment", back_populates="skill")


class SkillVersion(Base, TimestampMixin):
    """Versioned snapshot of a skill's SOP content."""
    __tablename__ = "skill_versions"

    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(nullable=False)
    sop_content: Mapped[str] = mapped_column(Text, default="{}")
    assessment_criteria: Mapped[str] = mapped_column(Text, default="[]")
    key_knowledge_points: Mapped[str] = mapped_column(Text, default="[]")
    change_notes: Mapped[str] = mapped_column(Text, default="")
    is_active: Mapped[bool] = mapped_column(default=True)

    skill = relationship("Skill", back_populates="versions")


class SkillMaterial(Base, TimestampMixin):
    """Links a training material to a skill (source materials used for SOP extraction)."""
    __tablename__ = "skill_materials"

    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id"), nullable=False, index=True)
    material_id: Mapped[str] = mapped_column(String(36), ForeignKey("training_materials.id"), nullable=False, index=True)
    extraction_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/processing/completed/failed
    extraction_result: Mapped[str] = mapped_column(Text, default="")  # JSON: extracted SOP fragment

    skill = relationship("Skill", back_populates="materials")
    material = relationship("TrainingMaterial")


class SkillAssignment(Base, TimestampMixin):
    """Assigns a published skill to an HCP Agent for SOP-driven training."""
    __tablename__ = "skill_assignments"

    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id"), nullable=False, index=True)
    hcp_profile_id: Mapped[str] = mapped_column(String(36), ForeignKey("hcp_profiles.id"), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(default=True)

    skill = relationship("Skill", back_populates="assignments")
    hcp_profile = relationship("HcpProfile")
```

### Pattern 2: AI-Powered SOP Extraction Service

**What:** A service that reads training material files, extracts text, and uses Azure OpenAI to generate structured SOP content.
**When to use:** When admin uploads materials and clicks "Convert to Skill".

```python
# Source: Existing patterns from material_service.py + scoring_engine.py [VERIFIED: codebase]

async def extract_sop_from_materials(
    db: AsyncSession,
    skill_id: str,
    material_ids: list[str],
) -> dict:
    """Extract SOP content from training materials using Azure OpenAI.

    1. Read material files from storage
    2. Extract text from PDF/DOCX/PPTX
    3. Send combined text to Azure OpenAI with SOP extraction prompt
    4. Return structured JSON: {sop_steps, assessment_criteria, key_knowledge_points}
    """
    # Use existing storage backend
    storage = get_storage()

    combined_text = ""
    for material_id in material_ids:
        # Load latest active version
        material = await material_service.get_material(db, material_id)
        latest = next((v for v in material.versions if v.is_active), None)
        if not latest:
            continue
        content = await storage.read(f"materials/{material_id}/v{latest.version_number}/{latest.filename}")
        combined_text += extract_text(content, latest.content_type) + "\n\n"

    # Call Azure OpenAI for SOP extraction
    sop_result = await call_sop_extraction(combined_text)
    return sop_result
```

### Pattern 3: Agent Instruction Injection for SOP-Driven Training

**What:** When a skill is assigned to an HCP Agent, the SOP content is injected into the agent's system prompt so training sessions follow the SOP.
**When to use:** During agent sync and session creation.

```python
# Source: Existing pattern from agent_sync_service.py build_agent_instructions() [VERIFIED: codebase]
# Extend the existing sync_agent_for_profile to include skill SOP content

async def build_skill_augmented_instructions(
    db: AsyncSession,
    profile: HcpProfile,
    template: str | None = None,
) -> str:
    """Build agent instructions with SOP content from assigned skills."""
    base_instructions = build_agent_instructions(profile.to_prompt_dict(), template)

    # Fetch active skill assignments for this HCP
    assignments = await get_active_skill_assignments(db, profile.id)
    if not assignments:
        return base_instructions

    sop_sections = []
    for assignment in assignments:
        skill = assignment.skill
        sop_sections.append(f"## Training Skill: {skill.name}\n{skill.sop_content}")

    sop_block = "\n\n".join(sop_sections)
    return f"{base_instructions}\n\n# SOP Training Instructions\n{sop_block}"
```

### Pattern 4: Skill Package ZIP Import/Export

**What:** Export a skill as a ZIP package containing metadata JSON + source materials. Import by uploading a ZIP.
**When to use:** Skill portability between environments.

```python
# Backend: Python zipfile (stdlib) for creation
import zipfile
import io

async def export_skill_package(db: AsyncSession, skill_id: str) -> bytes:
    """Export a skill as a ZIP package."""
    skill = await get_skill(db, skill_id)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Metadata
        zf.writestr("skill.json", json.dumps({
            "name": skill.name,
            "description": skill.description,
            "sop_content": json.loads(skill.sop_content),
            "assessment_criteria": json.loads(skill.assessment_criteria),
            "key_knowledge_points": json.loads(skill.key_knowledge_points),
        }))
        # Attached materials
        for sm in skill.materials:
            material = sm.material
            latest = next((v for v in material.versions if v.is_active), None)
            if latest:
                content = await storage.read(...)
                zf.writestr(f"materials/{latest.filename}", content)
    return buffer.getvalue()
```

### Anti-Patterns to Avoid

- **Storing SOP content only in agent instructions:** SOP must be stored in the Skill model as the source of truth. Agent instructions are derived from it and regenerated on sync.
- **Direct file parsing in API routes:** All document parsing and AI extraction must go through the service layer. Routers only handle HTTP.
- **Synchronous document processing in request:** Material-to-SOP conversion can be slow (AI call). Use async processing with status tracking (pending -> processing -> completed -> failed) per SkillMaterial record.
- **Modifying agent instructions without the sync pattern:** Always go through `agent_sync_service.sync_agent_for_profile()` to update agent instructions. Never patch instructions directly.
- **Hard-coding SOP prompt in multiple places:** Use a single `build_sop_extraction_prompt()` function in `prompt_builder.py`, following the existing pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF text extraction | Custom PDF parser | `pypdf.PdfReader` | Already installed, handles 99% of PDFs |
| DOCX text extraction | Custom XML parser | `python-docx` Document API | Already installed, handles paragraphs + tables |
| PPTX text extraction | Custom OPC parser | `python-pptx` Presentation API | Standard library for .pptx files |
| ZIP packaging | Custom binary format | Python `zipfile` (stdlib) + `jszip` (frontend) | Standard, portable, inspectable |
| Structured JSON extraction from LLM | Regex parsing of LLM output | Azure OpenAI `response_format={"type": "json_object"}` | Guarantees valid JSON output |
| File upload with progress | Custom XHR handler | Axios `onUploadProgress` (existing pattern) | Already established in materials upload |
| Pagination | Custom pagination logic | `PaginatedResponse.create()` (existing) | Project standard utility |

**Key insight:** This phase is primarily data modeling and UI -- the AI extraction is a single well-crafted prompt call to Azure OpenAI. Don't over-engineer the AI pipeline. The existing `openai` SDK + a structured prompt is sufficient.

## Common Pitfalls

### Pitfall 1: SQLite ALTER COLUMN in Alembic Migration
**What goes wrong:** SQLite doesn't support ALTER COLUMN; migration fails.
**Why it happens:** Phase adds new tables but may also need to add FK columns to existing tables.
**How to avoid:** Use `render_as_batch=True` in alembic env.py (already configured). Use `server_default` on all new columns. New tables don't need batch mode.
**Warning signs:** Alembic migration error mentioning ALTER TABLE.

### Pitfall 2: MissingGreenlet on SQLAlchemy Relationship Loading
**What goes wrong:** Accessing a relationship attribute outside async context raises MissingGreenlet.
**Why it happens:** SQLAlchemy async mode requires eager loading or explicit async loading of relationships.
**How to avoid:** Use `selectinload()` in queries or the expunge+re-query pattern from `material_service.py`. [VERIFIED: Phase 05 decision]
**Warning signs:** `MissingGreenlet` exception in logs.

### Pitfall 3: SOP Extraction Prompt Returns Invalid JSON
**What goes wrong:** Azure OpenAI returns markdown-wrapped JSON or truncated output.
**Why it happens:** Without `response_format`, LLM may wrap JSON in code blocks or truncate long responses.
**How to avoid:** Always use `response_format={"type": "json_object"}` in the API call. Validate the response with Pydantic before storing.
**Warning signs:** JSON parse errors in skill_conversion_service.

### Pitfall 4: Circular Import Between skill_service and agent_sync_service
**What goes wrong:** Import error at startup.
**Why it happens:** skill_service imports agent_sync_service for agent re-sync; agent_sync_service needs skill data for instruction building.
**How to avoid:** Use lazy import pattern inside functions (existing convention: `from app.services import knowledge_base_service` inside `sync_agent_for_profile`). [VERIFIED: agent_sync_service.py line 635]
**Warning signs:** ImportError on startup.

### Pitfall 5: Large Document Text Exceeds Azure OpenAI Token Limit
**What goes wrong:** SOP extraction fails because combined document text exceeds model context window.
**Why it happens:** Multiple large documents combined for extraction.
**How to avoid:** Implement text chunking (truncate to ~100K characters, roughly 25K tokens for GPT-4o). For very large corpora, extract per-document then merge. Log a warning if truncation occurs.
**Warning signs:** 400 error from Azure OpenAI mentioning token limit.

### Pitfall 6: Skill Assignment Not Triggering Agent Re-Sync
**What goes wrong:** HCP Agent doesn't follow the SOP during training.
**Why it happens:** Assigning a skill to an HCP doesn't automatically update the agent's instructions in AI Foundry.
**How to avoid:** In `skill_service.assign_skill()`, always call `agent_sync_service.sync_agent_for_profile()` after assignment (same pattern as `knowledge_base_service._trigger_agent_resync()`). [VERIFIED: knowledge_base_service.py line 313]
**Warning signs:** Agent responds without SOP awareness.

### Pitfall 7: Frontend Type Mismatch with Snake_Case Backend
**What goes wrong:** TypeScript types use camelCase but API returns snake_case.
**Why it happens:** Backend follows Python snake_case convention.
**How to avoid:** Use snake_case in TypeScript types to match API exactly (existing project convention). [VERIFIED: all frontend types use snake_case matching backend]
**Warning signs:** Undefined values in UI when rendering skill data.

## Code Examples

### Document Text Extraction (Backend)

```python
# Source: Extending existing pattern from material upload [VERIFIED: material_service.py, storage/local.py]

def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF bytes using pypdf."""
    from pypdf import PdfReader
    import io
    reader = PdfReader(io.BytesIO(content))
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def extract_text_from_docx(content: bytes) -> str:
    """Extract text from DOCX bytes using python-docx."""
    from docx import Document
    import io
    doc = Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n".join(paragraphs)


def extract_text_from_pptx(content: bytes) -> str:
    """Extract text from PPTX bytes using python-pptx."""
    from pptx import Presentation
    import io
    prs = Presentation(io.BytesIO(content))
    slides_text = []
    for slide in prs.slides:
        texts = []
        for shape in slide.shapes:
            if hasattr(shape, "text") and shape.text.strip():
                texts.append(shape.text)
        if texts:
            slides_text.append("\n".join(texts))
    return "\n\n---\n\n".join(slides_text)


def extract_text(content: bytes, content_type: str) -> str:
    """Dispatch text extraction based on content type."""
    if "pdf" in content_type:
        return extract_text_from_pdf(content)
    elif "wordprocessing" in content_type or content_type.endswith(".docx"):
        return extract_text_from_docx(content)
    elif "presentation" in content_type or content_type.endswith(".pptx"):
        return extract_text_from_pptx(content)
    return ""
```

### SOP Extraction Prompt

```python
# Source: Extending pattern from prompt_builder.py [VERIFIED: codebase]

SOP_EXTRACTION_PROMPT = """You are an expert medical training content designer. 
Analyze the following training materials and extract a structured Standard Operating Procedure (SOP) for Medical Representative (MR) training.

## Input Materials
{document_text}

## Required Output Format
Return ONLY valid JSON in this exact format:
{{
  "sop_steps": [
    {{
      "step_number": 1,
      "title": "Step title",
      "description": "Detailed description of what MR should do",
      "key_points": ["point 1", "point 2"],
      "expected_duration_minutes": 5
    }}
  ],
  "assessment_criteria": [
    {{
      "criterion": "Assessment item description",
      "weight": 20,
      "passing_score": 70
    }}
  ],
  "key_knowledge_points": [
    {{
      "topic": "Knowledge topic",
      "content": "Key information the MR must know",
      "importance": "high"
    }}
  ],
  "summary": "Brief 2-3 sentence summary of the skill"
}}

Rules:
1. Extract ALL actionable training steps from the materials
2. Assessment criteria weights must total 100
3. Knowledge points should cover product, mechanism, clinical data, and safety
4. Use the same language as the source materials (Chinese or English)
5. Be specific and actionable - avoid generic instructions"""
```

### Skill API Route (Backend)

```python
# Source: Following exact pattern from api/materials.py [VERIFIED: codebase]

router = APIRouter(prefix="/skills", tags=["skills"])

@router.post("", response_model=SkillOut, status_code=201)
async def create_skill(
    data: SkillCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new skill. Admin only."""
    skill = await skill_service.create_skill(db, data, user.id)
    return skill


# Static routes BEFORE parameterized /{id} routes (Gotcha #3)
@router.get("/published", response_model=PaginatedResponse[SkillListOut])
async def list_published_skills(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_role("user")),
):
    """List published skills for Skill Hub (available to all users)."""
    items, total = await skill_service.get_published_skills(db, page=page, page_size=page_size, search=search)
    return PaginatedResponse.create(items=[SkillListOut.model_validate(i) for i in items], total=total, page=page, page_size=page_size)


@router.get("/{skill_id}", response_model=SkillOut)
async def get_skill(skill_id: str, db: AsyncSession = Depends(get_db), _user: User = Depends(require_role("admin"))):
    """Get a skill with full details. Admin only."""
    return await skill_service.get_skill(db, skill_id)
```

### TanStack Query Hook (Frontend)

```typescript
// Source: Following exact pattern from hooks/use-materials.ts [VERIFIED: codebase]
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSkills, getSkill, createSkill, updateSkill } from "@/api/skills";
import type { SkillCreate, SkillUpdate } from "@/types/skill";

export function useSkills(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["skills", params],
    queryFn: () => getSkills(params),
  });
}

export function useSkill(id: string | undefined) {
  return useQuery({
    queryKey: ["skills", id],
    queryFn: () => getSkill(id!),
    enabled: !!id,
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SkillCreate) => createSkill(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unstructured training materials only (Phase 5) | Structured Skills with SOP extraction | Phase 19 | Enables SOP-driven training instead of free-form conversations |
| HCP Agent instructions = personality only | Agent instructions = personality + skill SOP | Phase 19 | Agent follows structured training protocol |
| Manual scoring criteria per scenario | Skill-level assessment criteria auto-extracted | Phase 19 | Assessment criteria derived from training materials |
| Azure OpenAI without json_object response format | `response_format={"type": "json_object"}` | GPT-4o launch | Guaranteed valid JSON from extraction prompts [ASSUMED] |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Azure OpenAI supports `response_format={"type": "json_object"}` for SOP extraction | Code Examples | Would need manual JSON parsing with error handling; moderate risk |
| A2 | GPT-4o 128K context window is sufficient for combined training materials | Common Pitfalls | Would need chunked extraction strategy; low risk (truncation fallback exists) |
| A3 | python-pptx 1.0.2 supports all modern .pptx files | Standard Stack | Very low risk; widely tested library |
| A4 | jszip 3.10.1 works with modern React 18 + Vite 6 | Standard Stack | Very low risk; pure JS library with no framework dependencies |
| A5 | Existing `StorageBackend` Protocol is sufficient for skill package storage | Architecture Patterns | Low risk; same file I/O pattern as materials |

## Open Questions

1. **SOP Content Schema Granularity**
   - What we know: SOP needs steps, assessment criteria, and knowledge points
   - What's unclear: Exact JSON schema for SOP content -- should it include conversation flow trees, scoring rubrics, or just linear steps?
   - Recommendation: Start with linear steps + criteria + knowledge points (as shown in code examples). Conversation flow trees can be added in a later iteration.

2. **Skill Assignment Cardinality**
   - What we know: Admin assigns skills to HCP Agents
   - What's unclear: Can one HCP have multiple skills? Can one skill be assigned to multiple HCPs?
   - Recommendation: Many-to-many via SkillAssignment table (most flexible). When multiple skills are assigned, combine their SOP content in the agent instructions with clear section headers.

3. **Skill Version vs Material Version**
   - What we know: Materials already have versioning. Skills need versioning too.
   - What's unclear: Should a new material version auto-trigger skill re-extraction?
   - Recommendation: No automatic re-extraction. Admin manually triggers "re-extract" when materials are updated. This prevents unexpected changes to published skills.

4. **How SOP Content Integrates into Training Session Scoring**
   - What we know: Current scoring uses 5 fixed dimensions from scenario scoring weights.
   - What's unclear: Should skill assessment_criteria override or supplement scenario scoring?
   - Recommendation: Start by injecting SOP content into agent instructions only (HCP follows SOP). Leave scoring dimension integration for a future phase. The existing scoring system evaluates the conversation quality regardless of SOP adherence.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11+ | Backend | Yes | 3.11.9 | -- |
| Node.js 20+ | Frontend | Yes | 25.9.0 | -- |
| pypdf | PDF extraction | Yes | 6.9.2 | -- |
| python-docx | DOCX extraction | Yes | 1.2.0 | -- |
| python-pptx | PPTX extraction | No | -- | Install via pip (pyproject.toml) |
| jszip | ZIP export/import | No | -- | Install via npm |
| Azure OpenAI | SOP extraction | Config-dependent | -- | Mock extraction returning placeholder SOP |

**Missing dependencies with no fallback:**
- None (all missing deps are installable)

**Missing dependencies with fallback:**
- python-pptx: Install step required. Fallback: skip PPTX support until installed.
- jszip: Install step required. Fallback: skip client-side ZIP preview.
- Azure OpenAI: If not configured, provide mock SOP extraction with placeholder content (same pattern as mock coaching adapter).

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT Bearer token via `require_role()` dependency [VERIFIED: codebase] |
| V3 Session Management | yes | Existing JWT + localStorage pattern [VERIFIED: codebase] |
| V4 Access Control | yes | Admin-only for skill CRUD; user can view published skills only |
| V5 Input Validation | yes | Pydantic v2 for all request schemas; file extension validation |
| V6 Cryptography | no | No new crypto needs |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious file upload (ZIP bomb, malicious PPTX) | Tampering | File size limits (existing 50MB), extension whitelist, ZIP extraction limits |
| SOP content injection via crafted documents | Tampering | LLM extraction acts as content sanitizer; validate output JSON schema |
| Unauthorized skill assignment manipulation | Elevation | `require_role("admin")` on all assignment endpoints |
| Path traversal in ZIP import | Tampering | Validate all filenames in ZIP; reject paths with `..` or absolute paths |
| Storage of sensitive training content | Information Disclosure | Same access controls as existing materials; admin-only access |

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/app/models/material.py`, `backend/app/services/material_service.py`, `backend/app/services/agent_sync_service.py`, `backend/app/services/knowledge_base_service.py`, `backend/app/services/prompt_builder.py` -- verified all patterns referenced
- `backend/pyproject.toml` -- verified all dependency versions
- `frontend/package.json` -- verified all frontend dependency versions

### Secondary (MEDIUM confidence)
- pip index: python-pptx 1.0.2 is latest version
- npm registry: jszip 3.10.1 is latest version

### Tertiary (LOW confidence)
- Azure OpenAI `response_format` JSON mode -- based on training knowledge, not verified against current API docs [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core libraries already in project, only 2 new additions
- Architecture: HIGH -- follows exact patterns from 5+ existing phases verified in codebase
- Pitfalls: HIGH -- all pitfalls derived from actual project gotchas documented in STATE.md and CLAUDE.md
- SOP extraction approach: MEDIUM -- prompt engineering quality depends on iteration

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (30 days -- stable domain, no fast-moving dependencies)
