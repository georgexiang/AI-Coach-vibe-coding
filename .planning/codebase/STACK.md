# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- Python 3.11+ - Backend API, business logic, AI integrations (`backend/`)
- TypeScript 5.6+ - Frontend SPA with strict mode enabled (`frontend/`)

**Secondary:**
- SQL - Database schemas via SQLAlchemy ORM and Alembic migrations (`backend/alembic/`)
- Bash - CI/CD scripts and infrastructure automation (`.github/scripts/`)
- CSS - Tailwind v4 with custom design tokens (`frontend/src/styles/index.css`)

## Runtime

**Backend:**
- Python 3.11+ (CPython)
- ASGI server: Uvicorn with `[standard]` extras (uvloop, httptools)
- Base image: `python:3.11-slim` (`backend/Dockerfile`)

**Frontend Build:**
- Node.js 20 (used for build and dev server)
- Base image: `node:20-slim` for build, `nginx:alpine` for serving (`frontend/Dockerfile`)

**Package Managers:**
- pip with setuptools (backend) - uses `pyproject.toml`
- npm (frontend) - uses `package.json` + `package-lock.json`
- Lockfile: `package-lock.json` present for frontend; backend relies on pinned ranges in `pyproject.toml`

## Frameworks

**Core:**
- FastAPI >=0.115.0 - ASGI web framework with dependency injection, lifespan events (`backend/app/main.py`)
- React 18.3+ - Frontend UI library (`frontend/package.json`)
- React Router v7 - Client-side routing (`frontend/package.json` - `react-router-dom ^7.0.0`)

**ORM / Database:**
- SQLAlchemy 2.0+ (async) - Database ORM with `AsyncSession` (`backend/app/database.py`)
- Alembic >=1.13.0 - Database migrations (`backend/alembic/`)
- aiosqlite >=0.20.0 - Async SQLite driver for development
- asyncpg >=0.29.0 - Async PostgreSQL driver for production (optional dep group `[postgresql]`)

**Testing:**
- pytest >=8.3.0 + pytest-asyncio >=0.24.0 - Backend unit/integration tests (`backend/tests/`)
- pytest-cov >=5.0.0 - Code coverage reporting
- pytest-html >=4.1.0 - HTML test reports
- pytest-timeout >=2.2.0 - Test timeout enforcement (60s default)
- Playwright >=1.48.0 - E2E browser testing (`frontend/e2e/`)

**Build/Dev:**
- Vite 6+ - Frontend build tool and dev server (`frontend/vite.config.ts`)
- Tailwind CSS v4 - Utility-first CSS with `@tailwindcss/vite` plugin
- Ruff >=0.6.0 - Python linter and formatter (replaces black + isort + flake8)

## Key Dependencies

**Critical:**
- `openai >=1.50.0` - OpenAI and Azure OpenAI API client for AI coaching (`backend/pyproject.toml`)
- `anthropic >=0.40.0` - Anthropic Claude API client for AI coaching (`backend/pyproject.toml`)
- `python-jose[cryptography] >=3.3.0` - JWT token creation/verification (`backend/pyproject.toml`)
- `passlib[bcrypt] >=1.7.4` - Password hashing (`backend/pyproject.toml`)
- `pydantic-settings >=2.5.0` - Environment-based configuration (`backend/app/config.py`)

**Frontend Critical:**
- `@tanstack/react-query ^5.60.0` - Server state management, caching, mutations (`frontend/package.json`)
- `axios ^1.7.0` - HTTP client with interceptors for JWT auth (`frontend/src/api/client.ts`)
- `lucide-react ^0.460.0` - Icon library (`frontend/package.json`)
- `react-markdown ^9.0.0` + `rehype-raw ^7.0.0` - Markdown rendering (likely for AI responses)
- `clsx ^2.1.0` + `tailwind-merge ^2.5.0` - Conditional CSS class composition via `cn()` utility (`frontend/src/lib/utils.ts`)

**Infrastructure:**
- `httpx >=0.27.0` - Async HTTP client, also used for testing via `ASGITransport` (`backend/tests/conftest.py`)
- `python-multipart >=0.0.9` - File upload support for FastAPI
- `websockets >=13.0` - WebSocket support (for real-time coaching interactions)

## Configuration

**Backend Environment (via pydantic-settings):**
- Config class: `backend/app/config.py` - `Settings` with `model_config = {"env_file": ".env"}`
- Singleton pattern: `get_settings()` with `@lru_cache` decorator
- Template: `backend/.env.example`
- Required env vars:
  - `DATABASE_URL` - SQLAlchemy async connection string (default: `sqlite+aiosqlite:///./ai_coach.db`)
  - `SECRET_KEY` - JWT signing key (default: `change-me-in-production`)
  - `CORS_ORIGINS` - Comma-separated allowed origins
  - `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT` - Azure OpenAI credentials
  - `ANTHROPIC_API_KEY` - Anthropic Claude credentials
  - `OPENAI_API_KEY` - Direct OpenAI credentials
  - `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` - Azure Speech Services (ASR/TTS)

**Frontend Environment:**
- Build-time via Vite: `VITE_API_BASE_URL` (set in Dockerfile ARG, defaults to `http://localhost:8000`)
- Dev proxy: Vite proxies `/api` requests to backend at `http://localhost:8000` (`frontend/vite.config.ts`)

**Build Configuration:**
- `backend/pyproject.toml` - Python build, dependency groups (`[dev]`, `[postgresql]`, `[all]`), tool configs
- `frontend/vite.config.ts` - Vite with React plugin, Tailwind CSS v4 plugin, `@/` path alias
- `frontend/tsconfig.json` - Strict TypeScript: `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`

**Linting/Formatting:**
- Ruff configured in `backend/pyproject.toml`: target py311, line-length 100, rules E/F/I/W/UP, double quotes
- TypeScript strict mode: `frontend/tsconfig.json` with `noUncheckedIndexedAccess: true`

## Platform Requirements

**Development:**
- Python 3.11+
- Node.js 20+
- Docker (optional, for containerized dev via `docker-compose.yml`)
- No external database required for dev (SQLite with aiosqlite)

**Production:**
- Azure Container Apps (backend + frontend as separate containers)
- Azure Container Registry (ACR) for image storage
- PostgreSQL database (via `asyncpg` driver, optional dependency group)
- nginx (Alpine) serving frontend static files with API reverse proxy
- Azure OpenAI / Anthropic / OpenAI API keys for AI coaching features
- Azure Speech Services for voice/ASR features

**Docker:**
- `backend/Dockerfile` - Single-stage, `python:3.11-slim`, healthcheck via urllib
- `frontend/Dockerfile` - Multi-stage: `node:20-slim` (build) then `nginx:alpine` (serve)
- `docker-compose.yml` - Development compose with backend (port 8000) + frontend (port 5173)

---

*Stack analysis: 2026-03-24*
