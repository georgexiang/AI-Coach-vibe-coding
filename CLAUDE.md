# CLAUDE.md — AI Coach Platform Engineering Handbook

> This is the **single source of truth** for HOW to develop on this project.
> For WHAT to build → `docs/specs/`, for WHY → `docs/requirements.md`

---

## Document Hierarchy (No-Overlap Principle)

| Layer | File(s) | Purpose |
|-------|---------|---------|
| Engineering Ops | `CLAUDE.md` (this file) | HOW to develop, coding standards, gotchas |
| Requirements | `docs/requirements.md` | Business requirements & acceptance criteria |
| Specifications | `docs/specs/` | Module specs (GIVEN/WHEN/THEN) |
| Plans | `docs/plans/` | Implementation plans with tasks |
| Architecture | `wiki/Architecture.md` | System design, data flows, diagrams |
| External | `README.md` | Quick start, overview, API reference |

---

## Project Structure

```
AI-Coach-vibe-coding/
├── .github/
│   ├── workflows/          # CI/CD (ci.yml, sync-wiki.yml, sync-project.yml)
│   └── scripts/            # Automation scripts (wiki gen, project sync)
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (one per domain)
│   │   ├── models/         # SQLAlchemy ORM models
│   │   ├── schemas/        # Pydantic v2 request/response schemas
│   │   ├── services/       # Business logic + AI adapters
│   │   ├── utils/          # Shared utilities (exceptions, pagination)
│   │   ├── config.py       # pydantic-settings configuration
│   │   ├── database.py     # Async SQLAlchemy engine + session
│   │   ├── dependencies.py # DI: get_db, get_current_user
│   │   └── main.py         # FastAPI app, lifespan, CORS
│   ├── alembic/            # Database migrations
│   ├── tests/              # pytest (unit + integration)
│   ├── scripts/            # init_db.py, seed_data.py
│   ├── pyproject.toml      # Dependencies + tool config
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/            # Typed axios API client
│   │   ├── components/
│   │   │   ├── shared/     # Reusable UI components
│   │   │   └── coach/      # AI coaching components
│   │   ├── contexts/       # React contexts (agent routing)
│   │   ├── hooks/          # TanStack Query hooks
│   │   ├── pages/          # Route-level page components
│   │   ├── stores/         # Auth store
│   │   ├── types/          # TypeScript type definitions
│   │   ├── lib/            # Utility functions (cn)
│   │   └── styles/         # Design tokens + Tailwind config
│   ├── e2e/                # Playwright E2E tests
│   ├── playwright.config.ts
│   ├── vite.config.ts
│   └── Dockerfile
├── docs/
│   ├── requirements.md     # Business requirements
│   ├── specs/              # Module specifications
│   ├── plans/              # Implementation plans
│   └── best-practices.md   # Engineering patterns reference
├── wiki/                   # Auto-synced to GitHub Wiki
├── infra/                  # Azure deployment scripts
├── docker-compose.yml
└── CLAUDE.md               # This file
```

---

## Tech Stack

### Backend
- **Python 3.11+** with async throughout
- **FastAPI** (ASGI, lifespan, dependency injection)
- **SQLAlchemy 2.0** async with aiosqlite (dev) / PostgreSQL (prod)
- **Alembic** for database migrations
- **Pydantic v2** for all schemas
- **pydantic-settings** for configuration
- **python-jose + passlib[bcrypt]** for JWT auth
- **pytest + pytest-asyncio** for testing

### Frontend
- **React 18+** with TypeScript strict mode
- **Vite 6+** with Tailwind CSS v4
- **TanStack Query v5** for server state
- **React Router v7** for routing
- **Axios** with typed API layer
- **Playwright** for E2E testing

### Infrastructure
- **Docker** with multi-stage builds
- **nginx** for frontend serving + API proxy
- **Azure Container Apps** for deployment
- **GitHub Actions** for CI/CD

---

## Local Development

### Prerequisites
- Python 3.11+, Node 20+, Docker (optional)

### Quick Start
```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
python scripts/init_db.py
python scripts/seed_data.py
uvicorn app.main:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm ci
cp .env.example .env
npm run dev
```

### Docker
```bash
docker-compose up
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

---

## Pre-Commit Checklist (MUST PASS)

Before every commit, run:

```bash
# Backend
cd backend
ruff check .          # Lint
ruff format --check . # Format check
pytest -v             # Tests

# Frontend
cd frontend
npx tsc -b            # Type check
npm run build         # Build check
```

CI will reject PRs that fail these checks.

---

## Coding Standards

### Python
- **Async everywhere**: `async def`, `await`, `AsyncSession`
- **Pydantic v2** schemas: use `model_config = ConfigDict(from_attributes=True)`
- **Exception raisers** must use `-> NoReturn` type annotation
- **Route ordering**: Static paths (`/defaults`, `/refresh`) BEFORE parameterized (`/{id}`)
- **Create returns 201**, Delete returns 204
- **Service layer** holds business logic, routers only handle HTTP
- **No raw SQL** — use SQLAlchemy ORM or Alembic migrations

### TypeScript
- **`strict: true`** — no `any` types, no unused variables
- **TanStack Query hooks** per domain, no inline `useQuery` in components
- **Path alias** `@/` for all imports from `src/`
- **Barrel exports** for component directories (`index.ts`)
- **`cn()` utility** for conditional class composition (clsx + tailwind-merge)
- **No Redux** — use TanStack Query for server state, lightweight store for auth

### General
- **English** for commits, code comments, docstrings
- **Chinese** for user-facing UI text (if applicable)
- **Conventional commits** encouraged: `feat:`, `fix:`, `docs:`, `test:`, `ci:`

---

## Database Rules

1. **NEVER** modify the database schema without an Alembic migration
2. **NEVER** delete the database file to "fix" schema issues
3. **Schema changes** → `alembic revision --autogenerate -m "description"` → `alembic upgrade head`
4. All models **MUST** use `TimestampMixin` (UUID id + created_at + updated_at)
5. Test database uses **in-memory SQLite** — production uses PostgreSQL

---

## API Design Rules

1. All routes under `/api/v1/` prefix
2. Structured error responses: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
3. Generic pagination: `{"items": [...], "total": N, "page": 1, "page_size": 20, "total_pages": N}`
4. Authentication via JWT Bearer token
5. CORS configured per environment

---

## AI Coach Domain Rules

1. **Training Sessions** have a lifecycle: `created → in_progress → completed → scored`
2. **Scoring** is multi-dimensional — never return a single score without breakdown
3. **HCP profiles** include: name, specialty, personality, knowledge background, perspective
4. **Conversations** are immutable once completed — only scoring/feedback can be added
5. **Voice records** must respect retention policies (auto-delete per config)
6. **All coaching interactions** must be auditable (traceable training paths)

---

## Gotcha List (Lessons Learned)

| # | Gotcha | Solution |
|---|--------|----------|
| 1 | SQLite doesn't support `ALTER COLUMN` | Use batch operations in Alembic |
| 2 | `async with` required for all DB sessions | Never use bare `get_db()` |
| 3 | Static routes must come before `/{id}` | FastAPI matches first route |
| 4 | `npm ci` not `npm install` in CI | Ensures reproducible builds |
| 5 | Playwright needs `--config=e2e/playwright.config.ts` | Default config path differs |
| 6 | CORS must include frontend dev port | Missing = silent auth failures |
| 7 | Alembic `env.py` must import all models | Missing = incomplete migrations |
| 8 | `pydantic-settings` reads `.env` only if configured | Add `model_config = {"env_file": ".env"}` |
| 9 | FastAPI lifespan replaces `@app.on_event` | Use `@asynccontextmanager` pattern |
| 10 | Azure OIDC needs `id-token: write` permission | Missing = deployment auth failure |

---

## CI Pipeline Overview

```
Push/PR → backend-test → frontend-test → e2e-test → deploy (main only)
                                                   ↓
Push → sync-wiki (wiki content changes)
Push → sync-project (plan file changes)
```

See `.github/workflows/` for full configurations.
