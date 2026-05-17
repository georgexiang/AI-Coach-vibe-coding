# Architecture (Detailed)

> Auto-generated from codebase analysis. See `CLAUDE.md` for the concise overview.

## Pattern Overview
- Strict separation between frontend (React SPA) and backend (FastAPI ASGI)
- Backend follows a layered architecture: Router -> Schema -> Service -> Model -> Database
- AI coaching logic is abstracted via an adapter/strategy pattern with a singleton registry
- Communication between frontend and backend is REST + WebSocket over `/api/` prefix
- Frontend proxies API calls through Vite dev server (dev) or nginx reverse proxy (prod)
- Async throughout the backend (async SQLAlchemy, async FastAPI handlers)

## Backend Layers

### Router Layer
- Purpose: Accept HTTP requests, validate input via Pydantic schemas, delegate to services, return responses
- Location: `backend/app/api/`
- Contains: FastAPI router modules, one per domain (auth, sessions, scoring, HCP profiles)
- Depends on: Schema layer, Service layer, Dependencies (`get_db`, `get_current_user`)

### Schema Layer
- Purpose: Define request/response data shapes using Pydantic v2
- Location: `backend/app/schemas/`
- Contains: Pydantic BaseModel subclasses with `ConfigDict(from_attributes=True)`
- Depends on: Nothing (pure data definitions)

### Service Layer
- Purpose: Encapsulate domain business logic, orchestrate AI adapters, handle training session lifecycle
- Location: `backend/app/services/`
- Contains: Service classes/functions, AI coaching adapter framework
- Depends on: Model layer, AI adapter subsystem, external AI SDKs

### AI Adapter Subsystem
- Purpose: Provide a pluggable interface for multiple AI providers (Claude, Azure OpenAI, GPT-4, Mock)
- Location: `backend/app/services/agents/`
- Contains: Abstract base class, adapter registry (singleton), concrete adapter implementations
- Depends on: AI provider SDKs (openai, anthropic)

### Model Layer
- Purpose: Define database tables and relationships via SQLAlchemy 2.0 declarative models
- Location: `backend/app/models/`
- Contains: ORM model classes inheriting from `Base` and using `TimestampMixin`
- Depends on: SQLAlchemy, `backend/app/models/base.py` for `Base` and `TimestampMixin`

### Database Layer
- Purpose: Manage async database connections and sessions
- Location: `backend/app/database.py`
- Pattern: `async with AsyncSessionLocal() as session` with auto-commit/rollback

### Dependencies
- Purpose: Provide FastAPI dependency injection callables
- Location: `backend/app/dependencies.py`
- Contains: `get_db`, `get_current_user`

### Configuration
- Purpose: Centralize application settings using pydantic-settings
- Location: `backend/app/config.py`
- Pattern: pydantic-settings `BaseSettings` with `@lru_cache` singleton accessor `get_settings()`

### Utilities
- Purpose: Shared cross-cutting utilities
- Location: `backend/app/utils/`
- Contains: exceptions.py, pagination.py

## Frontend Layers

### API Client
- Purpose: Typed HTTP client for backend communication
- Location: `frontend/src/api/client.ts`
- Axios instance with JWT interceptor and 401 redirect

### Components
- Purpose: UI components organized by domain and reusability
- Location: `frontend/src/components/`
- Subdirs: `shared/` (reusable), `coach/` (AI coaching)

### State Management
- Server state: TanStack Query v5 hooks in `frontend/src/hooks/`
- Auth state: Lightweight store in `frontend/src/stores/` (JWT + user info in localStorage)
- UI state: React local state + Context in `frontend/src/contexts/`

### Pages
- Purpose: Route-level page components
- Location: `frontend/src/pages/`

## Key Abstractions

### BaseCoachingAdapter
- Strategy pattern interface for swappable AI providers
- Files: `backend/app/services/agents/base.py`, `backend/app/services/agents/adapters/mock.py`
- Pattern: Abstract base class with `execute()` returning `AsyncIterator[CoachEvent]`
- New adapters implement `BaseCoachingAdapter` and register via `AdapterRegistry.register()`

### AdapterRegistry
- Singleton that manages available AI coaching adapters at runtime
- File: `backend/app/services/agents/registry.py`
- Pattern: Singleton with `register()`, `get()`, `list_available()`, `discover()`

### CoachEvent / CoachRequest
- Domain value objects for coaching interactions
- File: `backend/app/services/agents/base.py`
- `CoachEventType` enum: `TEXT`, `AUDIO`, `SCORE`, `SUGGESTION`, `ERROR`, `DONE`

### AppException
- Structured error responses with code, message, and details
- File: `backend/app/utils/exceptions.py`
- Custom HTTPException subclasses with convenience raiser functions

### PaginatedResponse
- Generic paginated response envelope
- File: `backend/app/utils/pagination.py`
- Generic Pydantic model with `create()` class method

### TimestampMixin
- UUID primary key + automatic created_at/updated_at timestamps
- File: `backend/app/models/base.py`
- Fields: `id` (String(36) UUID), `created_at` (server_default=now), `updated_at` (onupdate=now)

## Entry Points
- Backend: `uvicorn app.main:app` (`backend/app/main.py`)
- Frontend: `npm run dev` (Vite dev server) or nginx serving built SPA
- Database: `backend/scripts/init_db.py`, `backend/scripts/seed_data.py`
- Migrations: `backend/alembic/`
- CI: `.github/workflows/ci.yml`

## Error Handling Flow
1. All application errors extend `AppException` -> `HTTPException`
2. Specialized: `NotFoundException` (404), `ValidationException` (422), `ConflictException` (409)
3. Convenience raisers: `not_found()`, `bad_request()` with `-> NoReturn`
4. Global handler in `main.py` converts to JSON: `{"code": "...", "message": "...", "details": {...}}`
5. DB sessions auto-rollback on exception in `get_db()` generator
6. Frontend Axios interceptor handles 401 -> clear token -> redirect `/login`
