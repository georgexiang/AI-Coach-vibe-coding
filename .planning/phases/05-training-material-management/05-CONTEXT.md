# Phase 5: Training Material Management - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin can upload, version, and manage training materials (Word/Excel/PDF) organized by product -- materials feed into AI knowledge base for more accurate HCP simulation. This phase delivers the backend CRUD + file storage layer, document processing pipeline, RAG-style knowledge integration, and admin UI for material management.

</domain>

<decisions>
## Implementation Decisions

### File Storage & Upload
- Storage backend uses pluggable adapter pattern: local filesystem for dev, Azure Blob Storage for prod (consistent with ARCH-01)
- Upload size limit: 50MB per file, single file upload per request
- File format validation: MIME type + extension whitelist on backend, accept PDF/DOCX/XLSX only
- Material organization: flat by product with tags, consistent with existing scenario-product grouping from Phase 2

### Versioning & Lifecycle
- Linear version sequence (v1, v2, v3) for simplicity and admin intuitiveness
- Re-upload of same material auto-creates new version, preserving full history and audit trail
- Soft delete with archived flag + admin restore capability (matches CONTENT-03 versioning requirement)
- Configurable per-product retention rules with background cleanup task (meets success criterion 3)

### AI Knowledge Base Integration
- Extract text on upload, store as searchable chunks for immediate RAG availability
- Page-level chunking with overlap for good granularity on medical content
- SQLAlchemy full-text search for MVP, pluggable interface for Azure AI Search later (keeps dev simple, prod-ready via adapter)
- Materials linked via product -- HCP session auto-includes relevant product materials as context (aligns with scenario-product relationship from Phase 2)

### Claude's Discretion
No items deferred to Claude's discretion -- all areas explicitly decided.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- CRUD service pattern: `backend/app/services/` has session_service, scenario_service, hcp_profile_service as templates
- Router pattern: `backend/app/api/` has auth, scenarios, hcp_profiles, scoring routers
- Pydantic v2 schemas: `backend/app/schemas/` for all domain types
- Admin pages: `frontend/src/pages/admin/` has hcp-profiles, scenarios, azure-config, scoring-rubrics
- UI components: `frontend/src/components/ui/` has shared shadcn/ui components
- ServiceRegistry: pluggable adapter pattern in `backend/app/services/agents/registry.py`

### Established Patterns
- Async SQLAlchemy with AsyncSession for all DB operations
- Router -> Service -> Model layered architecture
- Pydantic v2 with ConfigDict(from_attributes=True) for all schemas
- Feature toggles via config API and ConfigProvider
- i18n separated by domain namespace (common, auth, nav, admin, coach, scoring)
- TanStack Query hooks per domain for frontend server state

### Integration Points
- New router: `backend/app/api/materials.py` registered in `main.py`
- New models: TrainingMaterial, MaterialVersion, MaterialChunk in `backend/app/models/`
- New admin page: `frontend/src/pages/admin/training-materials.tsx`
- New i18n namespace: `materials` for upload/version/management strings
- Knowledge base connects to existing prompt_builder.py for HCP session context injection

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond ROADMAP success criteria -- open to standard approaches following established codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>
