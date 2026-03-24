# Coding Conventions

**Analysis Date:** 2026-03-24

## Naming Patterns

**Python Files:**
- Use `snake_case.py` for all module files: `config.py`, `database.py`, `dependencies.py`
- Package `__init__.py` files re-export key symbols with `__all__`
- Test files prefixed with `test_`: `test_health.py`, `test_mock_adapter.py`

**Python Functions/Methods:**
- `snake_case` for all functions and methods: `get_settings()`, `get_db()`, `is_available()`
- Async functions use `async def` universally -- no sync alternatives
- Factory/creator class methods: `PaginatedResponse.create()`
- Exception helper functions as shorthand raisers: `not_found()`, `bad_request()`

**Python Classes:**
- `PascalCase` for all classes: `Settings`, `AppException`, `BaseCoachingAdapter`
- Mixins suffixed with `Mixin`: `TimestampMixin`
- Abstract base classes suffixed with `Adapter` or `Base`: `BaseCoachingAdapter`
- Enums use `PascalCase` with `UPPER_CASE` members: `CoachEventType.TEXT`

**Python Variables:**
- `snake_case` for variables and parameters: `session_id`, `scoring_criteria`
- Module-level singletons in lowercase: `settings = get_settings()`, `registry = AdapterRegistry()`
- Constants follow `UPPER_CASE`: `TEST_DATABASE_URL`

**TypeScript Files:**
- Use `camelCase.ts` for utility and API files: `client.ts`, `utils.ts`
- Use `camelCase.spec.ts` for E2E test files: `health.spec.ts`
- Config files use `kebab-case` with extensions: `vite.config.ts`, `playwright.config.ts`

**TypeScript Functions:**
- `camelCase` for all functions: `cn()`
- Export `default` for singleton API client (`export default apiClient`)

**TypeScript Types:**
- `PascalCase` for interfaces and types (planned, not yet populated in `src/types/`)
- Import types with `type` keyword when type-only: `import { type ClassValue } from "clsx"`

**Directories:**
- `snake_case` for Python packages: `app/services/agents/adapters/`
- `kebab-case` for frontend directories: `src/components/shared/`, `src/components/coach/`

## Code Style

**Python Formatting:**
- Tool: **Ruff** (format + lint combined)
- Config: `backend/pyproject.toml` `[tool.ruff]` section
- Line length: **100** characters
- Quote style: **double quotes**
- Target version: **Python 3.11**
- Run: `ruff format --check .` (check), `ruff format .` (fix)

**Python Linting:**
- Tool: **Ruff**
- Rule sets enabled: `E` (pycodestyle errors), `F` (pyflakes), `I` (isort), `W` (warnings), `UP` (pyupgrade)
- isort config: `known-first-party = ["app"]`
- Run: `ruff check .` (check), `ruff check --fix .` (fix)

**TypeScript:**
- No ESLint or Prettier configured -- TypeScript compiler (`tsc -b`) is the sole code quality gate
- `tsconfig.json` enforces:
  - `"strict": true`
  - `"noUnusedLocals": true`
  - `"noUnusedParameters": true`
  - `"noFallthroughCasesInSwitch": true`
  - `"noUncheckedIndexedAccess": true`

**CSS/Tailwind:**
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Design tokens defined via CSS custom properties in `@theme inline` block at `frontend/src/styles/index.css`
- Color scales: `primary`, `success`, `warning`, `danger`, `neutral` (each with numeric stops)
- Typography: `--font-sans` (Inter + Noto Sans SC), `--font-mono` (JetBrains Mono)
- Spacing/radius: `--radius-sm` through `--radius-xl`

## Import Organization

**Python Import Order (enforced by Ruff isort):**
1. Standard library: `from contextlib import asynccontextmanager`
2. Third-party packages: `from fastapi import FastAPI`
3. First-party (`app.*`): `from app.config import get_settings`

**Python Import Style:**
- Use `from X import Y` form (not bare `import X`)
- Use `collections.abc` for abstract types: `from collections.abc import AsyncIterator, AsyncGenerator`
- Use `typing` for type constructs: `from typing import Any, NoReturn, Generic, TypeVar`

**TypeScript Import Order (not enforced by tooling):**
1. External packages: `import axios from "axios"`
2. Internal with path alias: `import { ... } from "@/..."`

**Path Aliases:**
- TypeScript: `@/` maps to `./src/` (configured in `tsconfig.json` `paths` and `vite.config.ts` `resolve.alias`)

## Error Handling

**Backend Exception Hierarchy:**
- Base: `AppException` extends `HTTPException` -- defined in `backend/app/utils/exceptions.py`
- Subclasses: `NotFoundException(404)`, `ValidationException(422)`, `ConflictException(409)`
- Each carries: `status_code`, `code` (string constant), `message`, `details`

**Exception Helper Functions:**
- Use `-> NoReturn` type annotation on functions that always raise
- `not_found(message)` and `bad_request(message)` as shorthand raisers
- Example: `def not_found(message: str = "Resource not found") -> NoReturn:`

**Global Exception Handler:**
- Registered on `app` in `backend/app/main.py` via `@app.exception_handler(AppException)`
- Returns structured JSON: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`

**Database Session Error Handling:**
- `get_db()` in `backend/app/database.py` uses try/except with rollback
- Pattern: `yield session` -> `await session.commit()` on success, `await session.rollback()` on exception

**Frontend Error Handling:**
- Axios response interceptor in `frontend/src/api/client.ts`
- 401 responses: clear `access_token` from localStorage, redirect to `/login`
- All other errors: propagate via `Promise.reject(error)` for TanStack Query to handle

## Logging

**Framework:** No dedicated logging framework configured. Use Python `logging` module or `print` for debugging.

**Patterns:**
- SQLAlchemy echo mode controlled by `settings.debug` in `backend/app/database.py`
- No structured logging middleware currently set up

## Comments

**When to Comment:**
- Module-level docstrings on test files: `"""Health check endpoint tests."""`
- Docstrings on abstract base classes and mixins: `"""Abstract base for AI coaching adapters."""`
- Inline `# TODO:` comments for planned but unimplemented work
- Inline comments for non-obvious configuration: `# In-memory SQLite for test isolation`

**Docstring Style:**
- Triple double-quoted strings: `"""Description."""`
- Short single-line docstrings for classes and methods
- Multi-line docstrings for test conftest files explaining purpose and approach

**TODO Convention:**
- Prefix with `# TODO:` followed by description
- Found in: `backend/app/main.py` (seed initial data), `backend/app/dependencies.py` (add auth dependency)

## Function Design

**Async Pattern:**
- ALL backend functions are `async def` -- no sync database or service functions
- Async generators use `AsyncGenerator[T, None]` return type (for `get_db`)
- Async iterators use `AsyncIterator[T]` return type (for adapter `execute`)

**Parameters:**
- Use dataclasses for complex request objects: `CoachRequest` in `backend/app/services/agents/base.py`
- Use Pydantic `BaseModel` for API schemas
- Default values on dataclass fields: `mode: str = "text"`, `hcp_profile: dict | None = None`
- Use modern union syntax: `dict | None` (not `Optional[dict]`)

**Return Values:**
- Route handlers return dicts or Pydantic models
- Generators use `yield` within `async with` context
- Factory methods return class instances: `PaginatedResponse.create()`

## Module Design

**Exports:**
- Use `__all__` in `__init__.py` for explicit public API: `__all__ = ["Base", "TimestampMixin"]`
- Re-export key symbols from submodules in package `__init__.py`

**Barrel Files:**
- `backend/app/models/__init__.py` re-exports `Base` and `TimestampMixin`
- `backend/app/dependencies.py` re-exports `get_db` with `__all__`
- Frontend directories (`components/shared/`, `components/coach/`) are structured for barrel exports but not yet populated

**Singleton Pattern:**
- `Settings`: `@lru_cache` on `get_settings()` in `backend/app/config.py`
- `AdapterRegistry`: `__new__` override for singleton in `backend/app/services/agents/registry.py`

## Configuration Pattern

**Backend Configuration:**
- `pydantic-settings` `BaseSettings` class in `backend/app/config.py`
- Reads from `.env` file via `model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}`
- All settings have defaults (safe for local dev without `.env`)
- Singleton via `@lru_cache` on `get_settings()`
- Access: `settings = get_settings()` at module level

**Frontend Configuration:**
- Vite environment variables (`VITE_*` prefix) for build-time config
- Runtime API base URL: hardcoded `/api/v1` in `frontend/src/api/client.ts`
- Vite dev server proxies `/api` to `http://localhost:8000`

## API Design Conventions

**Route Structure:**
- All routes under `/api/v1/` prefix (configured via `settings.api_prefix`)
- Health check at `/api/health` (outside versioned prefix)
- Static routes before parameterized routes (e.g., `/defaults` before `/{id}`)

**HTTP Status Codes:**
- 200: Successful GET/PUT
- 201: Successful POST (create)
- 204: Successful DELETE
- 404/422/409: Error responses via exception hierarchy

**Response Format:**
- Success: domain-specific JSON or `PaginatedResponse` wrapper
- Error: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
- Pagination: `{"items": [...], "total": N, "page": 1, "page_size": 20, "total_pages": N}`

## Frontend Component Conventions

**State Management:**
- Server state: TanStack Query v5 (no Redux)
- Auth state: lightweight store (planned in `frontend/src/stores/`)
- Agent routing: React context (planned in `frontend/src/contexts/`)
- No inline `useQuery` in components -- use domain-specific hooks from `frontend/src/hooks/`

**Styling:**
- Tailwind CSS v4 utility classes
- Conditional class composition via `cn()` from `frontend/src/lib/utils.ts`
- Design tokens as CSS custom properties, not Tailwind config (v4 `@theme inline` pattern)

**API Layer:**
- Single axios client instance: `frontend/src/api/client.ts`
- Auto-attaches JWT Bearer token from localStorage
- 30-second timeout on all requests
- Domain-specific API modules planned in `frontend/src/api/`

---

*Convention analysis: 2026-03-24*
