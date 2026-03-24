# Best Practices — Synthesized from Reference Projects

> Extracted from `ragflow-skill-orchestrator-studio` and `yoga-guru-copilot-platform`

---

## 1. Project Management

### GitHub Project V2 Auto-Sync
- Use a GitHub Project board (Kanban: Todo / In Progress / Done)
- Plan files in `docs/plans/` are the **source of truth**
- CI script parses plan markdown -> creates/updates GitHub Project items via GraphQL API
- No manual board updates needed — all status comes from code

### Issue & Label Strategy
- Standard labels: `bug`, `enhancement`, `documentation`, `good first issue`, `help wanted`
- Custom labels for domain: `training-module`, `assessment`, `hcp-scenario`, `scoring`, `dashboard`
- Use plan-file-driven issues instead of manual issue creation

---

## 2. Documentation Hierarchy (No-Overlap Principle)

| Document | Purpose | Content |
|----------|---------|---------|
| `CLAUDE.md` | HOW to develop | Coding standards, pre-commit, gotchas, local dev |
| `docs/specs/` | WHAT to build | Module specifications (GIVEN/WHEN/THEN) |
| `docs/plans/` | HOW EXACTLY | Implementation plans with tasks |
| `docs/requirements.md` | WHY | Business requirements, acceptance criteria |
| `README.md` | External overview | Architecture, quick start, API reference |
| `wiki/` | Team knowledge | Architecture, onboarding, roadmap, changelog |

---

## 3. Wiki Strategy

### In-Repo Wiki (Auto-Synced)
- Wiki lives in `wiki/` directory within the repo
- CI auto-syncs to GitHub Wiki on push to main
- Dynamic stats generated from code (test count, model count, API count, page count)

### Required Pages
| Page | Content |
|------|---------|
| `Home.md` | Quick nav + live project stats |
| `Architecture.md` | System diagrams, data flows, component relationships |
| `Dev-Onboarding.md` | Setup guide, prerequisites, default credentials, checklist |
| `Roadmap.md` | Phase tracking tables |
| `Changelog.md` | Version history |
| `_Sidebar.md` | Navigation |

---

## 4. CI/CD Pattern (Three Workflows)

### Workflow 1: `ci.yml` — Build + Test + Deploy
```
backend-test (Python lint + unit tests)
    ↓
frontend-test (TypeScript check + build)
    ↓
e2e-test (Playwright, depends on both above)
    ↓
deploy (Azure OIDC, only on main push, after all tests)
```

**Key practices**:
- OIDC-based Azure auth (zero stored credentials)
- `az acr build` for cloud-based image building
- Dual image tagging: `$SHA` + `latest`
- Health check verification post-deploy with retry loop
- `npm ci` for reproducible installs

### Workflow 2: `sync-wiki.yml` — Wiki Auto-Sync
- Triggers on changes to wiki/, docs/, source code, tests
- Generates dynamic stats via shell script
- Pushes to `.wiki.git` repo

### Workflow 3: `sync-project.yml` — Project Board Sync
- Triggers on changes to plan/spec files
- Parses markdown tasks -> creates/updates GitHub Project items

---

## 5. Testing Strategy

### Backend (pytest)
- **In-memory SQLite** (`sqlite+aiosqlite:///:memory:`) for test isolation
- **Autouse fixture**: create tables before, drop after each test
- **FastAPI dependency override**: `app.dependency_overrides[get_db] = override_get_db`
- **httpx AsyncClient** with ASGITransport (no server needed)
- **Schema integrity test**: Auto-verifies Alembic migrations match ORM models
- **Full CRUD coverage**: Every API module has create/read/update/delete/list/not-found tests
- **asyncio_mode = "auto"**: No manual `@pytest.mark.asyncio` needed

### Frontend E2E (Playwright)
- **webServer config**: Auto-starts both backend and frontend
- **Retry in CI**: 1-2 retries, 0 locally
- **Screenshot on failure**, trace on first retry
- **Shared helpers**: `login()`, `expectLayoutLoaded()`
- **HTML + GitHub annotation reporters**
- **8-11 spec files** covering core user flows

### Test Reports in CI
- pytest with `-v` flag and HTML reporter
- Playwright HTML reporter
- GitHub annotations for inline PR feedback
- Coverage reports attached as artifacts

---

## 6. Code Organization

### Backend Layered Architecture
```
Router (HTTP) → Schema (Validation) → Service (Business Logic) → Model (ORM) → Database
```

**Patterns**:
- Central router registration in one file
- Base model with UUID v4 IDs + automatic timestamps
- Generic pagination utility
- Custom exception hierarchy: `AppException → NotFoundException | ValidationException | ConflictException`
- Config via `pydantic-settings` with `.env` support and `@lru_cache` singleton
- Async everything: SQLAlchemy 2.0 async
- Lifespan pattern: DB init + seed + background tasks

### Frontend Component Architecture
```
Pages → Shared Components → Design Tokens
  ↕
Hooks (TanStack Query) → API Layer (axios) → Backend
  ↕
Stores (auth) + Contexts (agent routing)
```

**Patterns**:
- Typed API service layer with domain-specific modules
- TanStack Query for server state (no Redux)
- Lightweight auth store (Zustand or custom)
- Shared component library with barrel exports
- `cn()` utility (clsx + tailwind-merge) for conditional styling
- Path aliases (`@/` → `./src/`)

### Agent/Adapter Plugin Architecture
```python
BaseAgentAdapter (ABC)
├── execute() → AsyncIterator[AgentEvent]
├── is_available() → bool
├── get_version() → str | None
└── Registry (singleton) + Dispatcher (failover)
```

**Adaptation for AI Coach**:
```python
BaseCoachingAdapter (ABC)
├── ClaudeAdapter
├── GPT4Adapter
├── AzureOpenAIAdapter
└── MockAdapter (dev/test without credentials)
```

---

## 7. Component Reuse Patterns

### Shared UI Components (Both Projects)
| Component | Purpose | Reuse Level |
|-----------|---------|-------------|
| `PageHeader` | Title + back + actions | Every page |
| `GlassCard` / `Card` | Content container | Every section |
| `StatCard` | Metric display | Dashboard |
| `FormField` | Input wrapper | Every form |
| `Badge` | Status/tag display | Lists |
| `ProgressBar` | Completion indicator | Training progress |
| `ListItem` | Clickable list row | Lists/navigation |
| `DataTable` | Sortable/filterable table | Reports |

### Backend Reuse
| Pattern | Description |
|---------|-------------|
| `TimestampMixin` | UUID id + created_at + updated_at for all models |
| `PaginatedResponse[T]` | Generic pagination wrapper |
| `get_db` dependency | Shared DB session injection |
| `get_current_user` dependency | Auth middleware |
| `startup.py` | Idempotent DB init + seed |
| Exception hierarchy | Consistent error responses |

---

## 8. DevOps Patterns

### Docker
- **Backend**: `python:3.11-slim`, pip install, HEALTHCHECK
- **Frontend**: Multi-stage (node:20 build → nginx:alpine), `envsubst` for runtime config
- **docker-compose**: Volume mounts for hot-reload, depends_on for startup order

### nginx.conf
- SPA fallback (`try_files $uri $uri/ /index.html`)
- API reverse proxy with WebSocket upgrade headers
- 1-year cache for static assets with immutable header
- `envsubst` for runtime BACKEND_URL injection
- `/health` endpoint returning JSON

### Azure Container Apps Deployment
- OIDC authentication (zero stored credentials)
- `az acr build` for remote image building
- Dynamic FQDN injection (frontend discovers backend URL)
- Health check verification with retry loop
- One-command setup script in `infra/`

---

## 9. Security Patterns

- JWT auth with `python-jose` + `passlib[bcrypt]`
- CORS configured per environment
- Secret masking in agent subprocess output
- `.env.example` committed (template), `.env` gitignored (secrets)
- MockAdapter fallback for dev without credentials
- No stored deployment credentials (OIDC)

---

## 10. Language & Style Conventions

### Python
- Async throughout (`async def`, `await`)
- Pydantic v2 for all schemas
- `NoReturn` type annotation on exception raisers
- Ruff for lint + format (line-length 100, py311 target)
- Alembic for ALL schema changes (never raw SQL)

### TypeScript
- `strict: true`, `noUnusedLocals: true`, `noUnusedParameters: true`
- Path aliases (`@/` → `./src/`)
- Barrel exports for component directories
- TanStack Query hooks per domain (not inline `useQuery`)
- CSS variables + Tailwind v4 `@theme inline` for design tokens

### Git
- Conventional commits (optional but encouraged)
- English for commits and docstrings
- Chinese for user-facing content (if applicable)
- Feature branches → PR → main
