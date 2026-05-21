# Conventions (Detailed)

> Auto-generated from codebase analysis. See `CLAUDE.md` for essential coding standards.

## Naming Patterns

### Python
- `snake_case.py` for all module files: `config.py`, `database.py`, `dependencies.py`
- Package `__init__.py` files re-export key symbols with `__all__`
- Test files prefixed with `test_`: `test_health.py`, `test_mock_adapter.py`
- `snake_case` for all functions and methods: `get_settings()`, `get_db()`, `is_available()`
- Async functions use `async def` universally -- no sync alternatives
- Factory/creator class methods: `PaginatedResponse.create()`
- Exception helper functions as shorthand raisers: `not_found()`, `bad_request()`
- `PascalCase` for all classes: `Settings`, `AppException`, `BaseCoachingAdapter`
- Mixins suffixed with `Mixin`: `TimestampMixin`
- Abstract base classes suffixed with `Adapter` or `Base`: `BaseCoachingAdapter`
- Enums use `PascalCase` with `UPPER_CASE` members: `CoachEventType.TEXT`
- `snake_case` for variables and parameters: `session_id`, `scoring_criteria`
- Module-level singletons in lowercase: `settings = get_settings()`, `registry = AdapterRegistry()`
- Constants follow `UPPER_CASE`: `TEST_DATABASE_URL`

### TypeScript
- `camelCase.ts` for utility and API files: `client.ts`, `utils.ts`
- `camelCase.spec.ts` for E2E test files: `health.spec.ts`
- Config files use `kebab-case` with extensions: `vite.config.ts`, `playwright.config.ts`
- `camelCase` for all functions: `cn()`
- Export `default` for singleton API client (`export default apiClient`)
- `PascalCase` for interfaces and types
- Import types with `type` keyword when type-only: `import { type ClassValue } from "clsx"`

### Directories
- `snake_case` for Python packages: `app/services/agents/adapters/`
- `kebab-case` for frontend directories: `src/components/shared/`, `src/components/coach/`

## Code Style

### Python (Ruff)
- Config: `backend/pyproject.toml` `[tool.ruff]` section
- Line length: **100** characters
- Quote style: **double quotes**
- Target version: **Python 3.11**
- Run: `ruff format --check .` (check), `ruff format .` (fix)
- Rule sets enabled: `E` (pycodestyle errors), `F` (pyflakes), `I` (isort), `W` (warnings), `UP` (pyupgrade)
- isort config: `known-first-party = ["app"]`
- Run: `ruff check .` (check), `ruff check --fix .` (fix)

### TypeScript
- No ESLint or Prettier configured -- TypeScript compiler (`tsc -b`) is the sole code quality gate
- `tsconfig.json` enforces strict mode

### CSS
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Design tokens defined via CSS custom properties in `@theme inline` block at `frontend/src/styles/index.css`
- Color scales: `primary`, `success`, `warning`, `danger`, `neutral` (each with numeric stops)
- Typography: `--font-sans` (Inter + Noto Sans SC), `--font-mono` (JetBrains Mono)
- Spacing/radius: `--radius-sm` through `--radius-xl`

## Import Organization
- Use `from X import Y` form (not bare `import X`)
- Use `collections.abc` for abstract types: `from collections.abc import AsyncIterator, AsyncGenerator`
- Use `typing` for type constructs: `from typing import Any, NoReturn, Generic, TypeVar`
- TypeScript: `@/` maps to `./src/` (configured in `tsconfig.json` `paths` and `vite.config.ts` `resolve.alias`)

## Error Handling
- Base: `AppException` extends `HTTPException` -- defined in `backend/app/utils/exceptions.py`
- Subclasses: `NotFoundException(404)`, `ValidationException(422)`, `ConflictException(409)`
- Each carries: `status_code`, `code` (string constant), `message`, `details`
- Use `-> NoReturn` type annotation on functions that always raise
- `not_found(message)` and `bad_request(message)` as shorthand raisers
- Registered on `app` in `backend/app/main.py` via `@app.exception_handler(AppException)`
- Returns structured JSON: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
- `get_db()` in `backend/app/database.py` uses try/except with rollback
- Pattern: `yield session` -> `await session.commit()` on success, `await session.rollback()` on exception
- Axios response interceptor in `frontend/src/api/client.ts`
- 401 responses: clear `access_token` from localStorage, redirect to `/login`
- All other errors: propagate via `Promise.reject(error)` for TanStack Query to handle

## Logging
- SQLAlchemy echo mode controlled by `settings.debug` in `backend/app/database.py`
- No structured logging middleware currently set up

## Comments
- Module-level docstrings on test files: `"""Health check endpoint tests."""`
- Docstrings on abstract base classes and mixins
- Inline `# TODO:` comments for planned but unimplemented work
- Triple double-quoted strings: `"""Description."""`

## Function Design
- ALL backend functions are `async def` -- no sync database or service functions
- Async generators use `AsyncGenerator[T, None]` return type (for `get_db`)
- Async iterators use `AsyncIterator[T]` return type (for adapter `execute`)
- Use dataclasses for complex request objects: `CoachRequest` in `backend/app/services/agents/base.py`
- Use Pydantic `BaseModel` for API schemas
- Use modern union syntax: `dict | None` (not `Optional[dict]`)
- Route handlers return dicts or Pydantic models
- Factory methods return class instances: `PaginatedResponse.create()`

## Module Design
- Use `__all__` in `__init__.py` for explicit public API
- Re-export key symbols from submodules in package `__init__.py`
- `Settings`: `@lru_cache` on `get_settings()` in `backend/app/config.py`
- `AdapterRegistry`: `__new__` override for singleton in `backend/app/services/agents/registry.py`

## Configuration Pattern
- `pydantic-settings` `BaseSettings` class in `backend/app/config.py`
- Reads from `.env` file via `model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}`
- All settings have defaults (safe for local dev without `.env`)
- Singleton via `@lru_cache` on `get_settings()`
- Vite environment variables (`VITE_*` prefix) for build-time config
- Runtime API base URL: hardcoded `/api/v1` in `frontend/src/api/client.ts`
- Vite dev server proxies `/api` to `http://localhost:8000`

## API Design Conventions
- All routes under `/api/v1/` prefix (configured via `settings.api_prefix`)
- Health check at `/api/health` (outside versioned prefix)
- Static routes before parameterized routes (e.g., `/defaults` before `/{id}`)
- 200: Successful GET/PUT, 201: Successful POST (create), 204: Successful DELETE
- 404/422/409: Error responses via exception hierarchy
- Success: domain-specific JSON or `PaginatedResponse` wrapper
- Error: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
- Pagination: `{"items": [...], "total": N, "page": 1, "page_size": 20, "total_pages": N}`

## Frontend Component Conventions
- Server state: TanStack Query v5 (no Redux)
- Auth state: lightweight store in `frontend/src/stores/`
- Agent routing: React context in `frontend/src/contexts/`
- No inline `useQuery` in components -- use domain-specific hooks from `frontend/src/hooks/`
- Tailwind CSS v4 utility classes
- Conditional class composition via `cn()` from `frontend/src/lib/utils.ts`
- Design tokens as CSS custom properties, not Tailwind config (v4 `@theme inline` pattern)
- Single axios client instance: `frontend/src/api/client.ts`
- Auto-attaches JWT Bearer token from localStorage
- 30-second timeout on all requests
