# Phase 01: Foundation Auth And Design System

> Auto-generated from [`.planning/phases/01-foundation-auth-and-design-system`](../blob/main/.planning/phases/01-foundation-auth-and-design-system)  
> Last synced: 2026-03-29

## Context & Decisions

# Phase 1: Foundation, Auth, and Design System - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

A running application with login, responsive layout shell, shared component library, i18n framework, and pluggable architecture for all AI services — the scaffold everything else builds on. Covers desktop, tablet, mobile, and Teams Tab via responsive web. WeChat Mini Program is deferred to a future phase.

</domain>

<decisions>
## Implementation Decisions

### Component Library Approach
- **D-01:** Adapt Figma Make generated code into the project — extract components from `figma-make/Design System for SaaS/` and `figma-make/Design Login and Layout Shell/`, adapt to match project conventions (path aliases, Tailwind v4 design tokens, i18n). Keep `figma-make/` as reference, not as runtime code.
- **D-02:** Component library is shadcn/ui-based (Radix primitives) — already present in Figma Make exports. Adapt rather than rebuild.
- **D-03:** Components organized as `components/ui/` (generic primitives: Button, Card, Input, Tabs, etc.) + `components/coach/`, `components/admin/` (domain-specific composites). Matches existing directory structure.

### Design Tokens
- **D-04:** Figma Make design tokens take priority over existing `frontend/src/styles/index.css` values — Figma design is the source of truth. Primary Blue #1E40AF, Inter + Noto Sans SC fonts, 8px radius cards.

### Role-based Layouts
- **D-05:** Two layout shells — User gets top-nav layout, Admin gets sidebar layout. Same shared components in both, different arrangements. Adapted from Figma Make Layout Shell code.

### Platform Targets
- **D-06:** Phase 1 delivers responsive web covering desktop, tablet, mobile, and Teams Tab (iframe). WeChat Mini Program requires a separate frontend — deferred to future phase. Backend REST API contracts serve all clients.

### Modular Architecture
- **D-07:** Frontend and backend both fully modular — reusable components, domain-specific hooks, service layer separation. Follow best practices using superpowers skills (TDD, planning, code review).

### Claude's Discretion
- Auth flow: JWT in localStorage (Axios client already configured), python-jose + passlib for backend, simple username/password login, role-based route protection via React Router guards
- App shell: Adapt directly from Figma Make Layout Shell — user top-nav (64px, logo + nav links + language switcher + avatar) and admin sidebar (240px, dark blue #1E293B, collapsible)
- i18n: react-i18next with namespace-based translation files (`common.json`, `auth.json`, etc.), persist language preference in localStorage, zh-CN + en-US from day 1
- Feature toggles: Config-driven via pydantic-settings backend + Vite env vars frontend, mock providers work without Azure credentials
- Responsive breakpoints: Mobile-first, hamburger menu on mobile for both layouts

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System & UI
- `docs/figma-prompts/00-design-system.md` — Component inventory, color scheme, typography, design tokens spec
- `docs/figma-prompts/01-login-and-layout.md` — Login page layout, User shell, Admin shell, responsive specs
- `docs/figma-design-brief.md` — Overall design direction, page inventory, role definitions
- `figma-make/Design System for SaaS/` — Generated shadcn/ui component library (source of truth for component adaptation)
- `figma-make/Design Login and Layout Shell/` — Generated login page and layout shells (source of truth for page adaptation)

### Requirements & Architecture
- `docs/requirements.md` — Full business requirements with acceptance criteria
- `docs/best-practices.md` — Engineering patterns reference
- `docs/capgemini-ai-coach-solution.md` — Reference solution overview (Capgemini AI Coach for AWS, adapted to Azure)

### Existing Code Patterns
- `backend/app/services/agents/base.py` — BaseCoachingAdapter ABC, CoachRequest, CoachEvent (adapter pattern reference)
- `backend/app/services/agents/registry.py` — AdapterRegistry singleton (pluggable provider pattern reference)
- `backend/app/config.py` — pydantic-settings configuration pattern
- `frontend/src/api/client.ts` — Axios client with JWT interceptor (auth integration point)
- `frontend/src/styles/index.css` — Current design tokens (to be updated with Figma Make values)
- `frontend/src/lib/utils.ts` — cn() utility for conditional class composition

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseCoachingAdapter` + `AdapterRegistry` + `MockCoachingAdapter`: Pluggable AI adapter pattern already implemented — extend for STT/TTS/Avatar adapters
- `cn()` utility in `frontend/src/lib/utils.ts`: clsx + tailwind-merge for conditional classes — use in all components
- Axios client with JWT interceptor in `frontend/src/api/client.ts`: Auth token management ready
- `TimestampMixin` in `backend/app/models/base.py`: UUID + timestamps for all ORM models
- `AppException` hierarchy in `backend/app/utils/exceptions.py`: Structured error responses
- `PaginatedResponse` in `backend/app/utils/pagination.py`: Generic pagination envelope

### Established Patterns
- Async everywhere (backend): `async def`, `AsyncSession`, `await` — no sync DB calls
- Tailwind CSS v4 with `@theme inline` design tokens — not Tailwind config file
- Pydantic v2 schemas with `ConfigDict(from_attributes=True)`
- FastAPI dependency injection via `Depends()`

### Integration Points
- `backend/app/main.py`: Router registration (currently empty — add auth, health routers)
- `backend/app/dependencies.py`: `get_current_user` TODO — implement for auth
- `frontend/src/pages/`: Empty — add Login, Dashboard placeholder, Admin pages
- `frontend/src/hooks/`: Empty — add TanStack Query hooks per domain (useAuth, etc.)
- `frontend/src/stores/`: Empty — add auth store (JWT + user info)

</code_context>

<specifics>
## Specific Ideas

- User wants Figma Make as the primary design reference — components generated by Figma Make are the source of truth
- "整套UI需要有组件模块，相同的组件需要复用" — complete UI with component modules, same components reused across the system
- "其他的功能也需要模块化" — all functionality should be modular, not just UI
- "遵循最佳实践，使用superpowers里面的skill" — follow best practices using superpowers skills for development workflow
- Frontend-backend separation is non-negotiable — clean REST API contracts

</specifics>

<deferred>
## Deferred Ideas

- WeChat Mini Program (微信小程序) — requires separate frontend, deferred to post-v1. Backend API supports it via shared REST contracts.
- Teams Bot integration — post-MVP, responsive web + Teams Tab iframe covers initial need
- Per-region theming/branding — not needed for v1, responsive layout handles screen size adaptation

</deferred>

---

*Phase: 01-foundation-auth-and-design-system*
*Context gathered: 2026-03-24*

## Plans (5)

| # | Plan File | Status |
|---|-----------|--------|
| 01-01 | 01-01-PLAN.md | Complete |
| 01-02 | 01-02-PLAN.md | Complete |
| 01-03 | 01-03-PLAN.md | Complete |
| 01-04 | 01-04-PLAN.md | Complete |
| 01-05 | 01-05-PLAN.md | Complete |

## Research

<details><summary>Click to expand research notes</summary>

# Phase 1: Foundation, Auth, and Design System - Research

**Researched:** 2026-03-24
**Domain:** Full-stack foundation (FastAPI auth, React design system, i18n, pluggable AI adapters)
**Confidence:** HIGH

## Summary

Phase 1 establishes the complete application scaffold: backend JWT authentication with User/Admin roles, frontend React SPA with login page and two responsive layout shells (user top-nav, admin sidebar), a shared component library adapted from Figma Make generated code (shadcn/ui + Radix primitives), react-i18next for zh-CN/en-US internationalization, and an extended pluggable adapter pattern for all AI services (LLM, STT, TTS, Avatar).

The project has a strong starting position. The backend already has: async SQLAlchemy with session management, FastAPI with lifespan/CORS/exception handling, a working adapter pattern (`BaseCoachingAdapter` + `AdapterRegistry` + `MockCoachingAdapter`), pydantic-settings configuration, test infrastructure with in-memory SQLite. The frontend has: Vite 6 + Tailwind CSS v4 configured, Axios client with JWT interceptor, `cn()` utility, `@/` path alias. What is missing: all ORM models, schemas, API routers, React entry point (`index.html`, `main.tsx`, `App.tsx`), any pages/components, routing, i18n, and the React app shell itself.

The Figma Make exports in `figma-make/` provide a complete set of shadcn/ui components and layout shells that need adaptation (import paths, design token alignment, i18n integration) rather than writing from scratch. The adaptation work is the largest frontend effort; the backend auth is standard FastAPI/JWT pattern.

**Primary recommendation:** Adapt Figma Make components into `frontend/src/components/ui/`, build backend auth (User model + JWT endpoints + role middleware), wire up React Router with auth guards, integrate react-i18next from day 1, and extend the existing adapter registry pattern to cover STT/TTS/Avatar service categories.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Adapt Figma Make generated code into the project -- extract components from `figma-make/Design System for SaaS/` and `figma-make/Design Login and Layout Shell/`, adapt to match project conventions (path aliases, Tailwind v4 design tokens, i18n). Keep `figma-make/` as reference, not as runtime code.
- **D-02:** Component library is shadcn/ui-based (Radix primitives) -- already present in Figma Make exports. Adapt rather than rebuild.
- **D-03:** Components organized as `components/ui/` (generic primitives: Button, Card, Input, Tabs, etc.) + `components/coach/`, `components/admin/` (domain-specific composites). Matches existing directory structure.
- **D-04:** Figma Make design tokens take priority over existing `frontend/src/styles/index.css` values -- Figma design is the source of truth. Primary Blue #1E40AF, Inter + Noto Sans SC fonts, 8px radius cards.
- **D-05:** Two layout shells -- User gets top-nav layout, Admin gets sidebar layout. Same shared components in both, different arrangements. Adapted from Figma Make Layout Shell code.
- **D-06:** Phase 1 delivers responsive web covering desktop, tablet, mobile, and Teams Tab (iframe). WeChat Mini Program requires a separate frontend -- deferred to future phase. Backend REST API contracts serve all clients.
- **D-07:** Frontend and backend both fully modular -- reusable components, domain-specific hooks, service layer separation.

### Claude's Discretion
- Auth flow: JWT in localStorage (Axios client already configured), python-jose + passlib for backend, simple username/password login, role-based route protection via React Router guards
- App shell: Adapt directly from Figma Make Layout Shell -- user top-nav (64px, logo + nav links + language switcher + avatar) and admin sidebar (240px, dark blue #1E293B, collapsible)
- i18n: react-i18next with namespace-based translation files (`common.json`, `auth.json`, etc.), persist language preference in localStorage, zh-CN + en-US from day 1
- Feature toggles: Config-driven via pydantic-settings backend + Vite env vars frontend, mock providers work without Azure credentials
- Responsive breakpoints: Mobile-first, hamburger menu on mobile for both layouts

### Deferred Ideas (OUT OF SCOPE)
- WeChat Mini Program -- requires separate frontend, deferred to post-v1
- Teams Bot integration -- post-MVP
- Per-region theming/branding -- not needed for v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARCH-01 | Pluggable adapter pattern for all AI services (LLM, STT, TTS, Avatar) | Extend existing `BaseCoachingAdapter` + `AdapterRegistry` to support service categories; create base adapters per service type |
| ARCH-02 | Component-based, configurable features with feature toggles | Backend: pydantic-settings `Settings` class with feature flags; Frontend: Vite env vars + config context |
| ARCH-03 | Backend dependency injection -- any service replaceable with mock | FastAPI `Depends()` pattern already in place; extend with auth dependencies, adapter DI |
| ARCH-04 | Shared design system component library from Figma | Adapt shadcn/ui components from `figma-make/Design System for SaaS/` into `frontend/src/components/ui/` |
| ARCH-05 | Azure service connections configurable per environment | Extend `backend/app/config.py` Settings with per-service config sections; no hardcoded endpoints |
| AUTH-01 | User login with username/password | FastAPI `/api/v1/auth/login` endpoint + User ORM model + passlib bcrypt hashing |
| AUTH-02 | Session persists across browser refresh via JWT | JWT stored in localStorage, Axios interceptor already attaches Bearer token |
| AUTH-03 | Two roles (User/Admin) with role-based route protection | User model `role` field (enum), React Router auth guards, backend role-checking dependency |
| AUTH-04 | Auth module uses DI -- ready for Azure AD/Teams SSO later | Abstract auth interface, concrete username/password implementation, swappable via DI |
| UI-01 | Shared component library (buttons, cards, inputs, charts, navigation) | shadcn/ui components from Figma Make adapted with project conventions |
| UI-02 | Login page and app layout shell from Figma | Adapt `figma-make/Design Login and Layout Shell/` -- Login.tsx, UserLayout.tsx, AdminLayout.tsx |
| UI-07 | All UI text externalized via react-i18next (zh-CN + en-US) | react-i18next with namespace JSON files, `useTranslation` hook in all components |
| PLAT-01 | i18n framework integrated from day 1 | react-i18next + i18next + i18next-browser-languagedetector; namespace files per domain |
| PLAT-02 | Responsive web design (desktop, tablet, mobile, Teams Tab) | Tailwind responsive utilities, mobile-first, Figma Make layouts already have responsive patterns |
| PLAT-04 | Per-region deployment -- single codebase, per-region config | pydantic-settings per-environment `.env` files; `region` config field; conditional service selection |
| PLAT-05 | Voice interaction mode configurable per deployment and session | Config field `voice_mode: text_only | stt_tts | realtime | voice_live`; feature toggle pattern |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Key directives that constrain all implementation:

- **Async everywhere** in backend: `async def`, `await`, `AsyncSession` -- no sync DB calls
- **Pydantic v2** schemas with `model_config = ConfigDict(from_attributes=True)`
- **Route ordering**: Static paths before parameterized paths
- **Create returns 201**, Delete returns 204
- **Service layer** holds business logic; routers only handle HTTP
- **No raw SQL** -- SQLAlchemy ORM or Alembic migrations only
- **TypeScript strict mode**: `strict: true`, no `any`, no unused variables, `noUncheckedIndexedAccess: true`
- **TanStack Query hooks** per domain, no inline `useQuery`
- **`@/` path alias** for all imports from `src/`
- **`cn()` utility** for conditional class composition
- **No Redux** -- TanStack Query for server state, lightweight store for auth
- **Conventional commits**: `feat:`, `fix:`, `docs:`, `test:`
- **NEVER modify DB schema without Alembic migration**
- **All routes under `/api/v1/` prefix**
- **Structured error responses**: `{"code": "ERROR_CODE", "message": "...", "details": {...}}`
- **Pre-commit checks**: `ruff check .`, `ruff format --check .`, `pytest -v` (backend); `npx tsc -b`, `npm run build` (frontend)
- **Ruff**: line-length 100, double quotes, target py311
- **Docker**: multi-stage builds, `python:3.11-slim` backend, `node:20-slim` build + `nginx:alpine` serve frontend

## Standard Stack

### Core (Backend -- Already in pyproject.toml)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | >=0.115.0 (installed: 0.115.0) | ASGI web framework | Already configured with lifespan, CORS, exception handler |
| SQLAlchemy 2.0 (async) | >=2.0.35 | ORM with AsyncSession | Already configured with aiosqlite |
| Alembic | >=1.13.0 | Database migrations | Required by CLAUDE.md -- never modify schema without migration |
| python-jose[cryptography] | >=3.3.0 (installed: 3.3.0) | JWT token creation/verification | Standard FastAPI auth library |
| passlib[bcrypt] | >=1.7.4 (installed: 1.7.4) | Password hashing | bcrypt is the standard for password storage |
| pydantic-settings | >=2.5.0 (installed: 2.5.2) | Environment-based configuration | Already configured in `backend/app/config.py` |
| pytest + pytest-asyncio | >=8.3.0 / >=0.24.0 | Testing | Already configured with in-memory SQLite fixtures |

### Core (Frontend -- Already in package.json unless noted)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.3.0 | UI framework | Already in package.json |
| React Router DOM | ^7.0.0 (latest: 7.13.2) | Client-side routing | Already in package.json, Figma Make uses same |
| TanStack Query | ^5.60.0 | Server state management | Already in package.json, CLAUDE.md mandates |
| Axios | ^1.7.0 | HTTP client | Already configured with JWT interceptor |
| Tailwind CSS v4 | ^4.0.0 | Utility-first CSS | Already configured with @tailwindcss/vite plugin |
| lucide-react | ^0.460.0 | Icons | Already in package.json, Figma Make uses same |

### New Dependencies Required

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-i18next | 16.6.2 (latest) | React i18n hooks/components | All UI text externalization (PLAT-01, UI-07) |
| i18next | 25.10.5 (latest) | Core i18n framework | Required peer dependency of react-i18next |
| i18next-browser-languagedetector | 8.2.1 (latest) | Auto-detect browser language | Initial language selection |
| i18next-http-backend | 3.0.2 (latest) | Load translations from JSON files | Lazy-load namespace translation files |
| @radix-ui/react-slot | 1.2.4 (latest) | Slot component for composition | Required by shadcn/ui Button (asChild pattern) |
| @radix-ui/react-dropdown-menu | 2.1.16 (latest) | Dropdown menu primitive | User menu, language switcher |
| @radix-ui/react-dialog | 1.1.15 (latest) | Dialog/modal primitive | Used by shadcn/ui Sheet, Dialog |
| @radix-ui/react-avatar | (latest) | Avatar primitive | User avatar in nav |
| @radix-ui/react-label | (latest) | Form label primitive | Form components |
| @radix-ui/react-separator | (latest) | Separator primitive | UI dividers |
| @radix-ui/react-tooltip | (latest) | Tooltip primitive | Icon tooltips |
| @radix-ui/react-navigation-menu | (latest) | Navigation menu primitive | Top nav component |
| @radix-ui/react-checkbox | (latest) | Checkbox primitive | Login "Remember me" |
| @radix-ui/react-select | (latest) | Select primitive | Language switcher dropdown |
| @radix-ui/react-switch | (latest) | Switch/toggle primitive | Feature toggles UI |
| class-variance-authority | 0.7.1 (latest) | Variant class generation | shadcn/ui Button, Badge variant patterns |
| sonner | 2.0.7 (latest) | Toast notifications | User feedback (login success/error) |
| vaul | 1.1.2 (latest) | Drawer component | Mobile responsive sheet/drawer |

**Installation (frontend new deps):**
```bash
cd frontend
npm install react-i18next i18next i18next-browser-languagedetector i18next-http-backend
npm install @radix-ui/react-slot @radix-ui/react-dropdown-menu @radix-ui/react-dialog @radix-ui/react-avatar @radix-ui/react-label @radix-ui/react-separator @radix-ui/react-tooltip @radix-ui/react-navigation-menu @radix-ui/react-checkbox @radix-ui/react-select @radix-ui/react-switch
npm install class-variance-authority sonner vaul
```

**Note:** Only install Radix primitives actually used by Phase 1 components. The full Figma Make package.json lists many more (accordion, tabs, popover, etc.) -- add those in later phases when their components are needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| python-jose | PyJWT | python-jose already in pyproject.toml and handles JWS/JWE; PyJWT is lighter but would be a needless change |
| localStorage JWT | httpOnly cookie | Cookies are more secure (XSS-resistant) but Axios client already configured for localStorage; CONTEXT.md locks this decision |
| react-i18next | next-intl, FormatJS | react-i18next is the de-facto React i18n library with namespace support; CONTEXT.md locks this choice |
| Radix UI primitives | Headless UI, Ark UI | Figma Make already generates shadcn/ui (Radix-based) components; switching would mean rewriting all components |

## Architecture Patterns

### Recommended Project Structure (Phase 1 additions)

```
backend/
  app/
    api/
      __init__.py
      auth.py               # POST /login, POST /refresh, GET /me
    models/
      __init__.py
      base.py               # (exists) Base + TimestampMixin
      user.py               # NEW: User ORM model
    schemas/
      __init__.py
      auth.py               # NEW: LoginRequest, TokenResponse, UserResponse
      user.py               # NEW: UserCreate, UserUpdate, UserRead
    services/
      auth.py               # NEW: authenticate_user, create_token, hash_password
      agents/
        base.py             # (exists) BaseCoachingAdapter
        registry.py          # (exists) AdapterRegistry
        adapters/
          mock.py            # (exists) MockCoachingAdapter
        stt/
          base.py            # NEW: BaseSTTAdapter (speech-to-text)
          mock.py            # NEW: MockSTTAdapter
        tts/
          base.py            # NEW: BaseTTSAdapter (text-to-speech)
          mock.py            # NEW: MockTTSAdapter
        avatar/
          base.py            # NEW: BaseAvatarAdapter
          mock.py            # NEW: MockAvatarAdapter
    dependencies.py          # (extend) get_current_user, require_role("admin")
    config.py                # (extend) feature flags, voice mode, region config

frontend/
  public/
    locales/
      en-US/
        common.json          # Shared UI text
        auth.json            # Login page text
        nav.json             # Navigation labels
      zh-CN/
        common.json
        auth.json
        nav.json
  src/
    components/
      ui/                    # Adapted from figma-make/Design System for SaaS/
        button.tsx
        card.tsx
        input.tsx
        label.tsx
        badge.tsx
        separator.tsx
        dropdown-menu.tsx
        avatar.tsx
        checkbox.tsx
        select.tsx
        switch.tsx
        tooltip.tsx
        skeleton.tsx
        sheet.tsx
        dialog.tsx
        form.tsx
        sonner.tsx           # Toast
        index.ts             # Barrel export
      shared/
        language-switcher.tsx
        loading-state.tsx
        empty-state.tsx
      layouts/
        user-layout.tsx      # Adapted from figma-make UserLayout
        admin-layout.tsx     # Adapted from figma-make AdminLayout
        auth-layout.tsx      # Login page wrapper
    pages/
      login.tsx              # Adapted from figma-make Login
      user/
        dashboard.tsx        # Placeholder
      admin/
        dashboard.tsx        # Placeholder
      not-found.tsx
    hooks/
      use-auth.ts            # TanStack Query: login mutation, refresh, me query
    stores/
      auth-store.ts          # JWT token + user info in localStorage
    contexts/
      auth-context.tsx       # AuthProvider + useAuth hook
    types/
      auth.ts                # User, LoginRequest, TokenResponse types
      config.ts              # FeatureFlags, AppConfig types
    i18n/
      index.ts               # i18next init + config
      types.ts               # Type-safe namespace keys (optional)
    lib/
      utils.ts               # (exists) cn()
      config.ts              # Runtime feature flag reader
    router/
      index.tsx              # Route definitions with auth guards
      auth-guard.tsx         # ProtectedRoute, AdminRoute components
    App.tsx                  # Root component: providers (Query, i18n, Auth, Router)
    main.tsx                 # ReactDOM.createRoot entry point
  index.html                 # Vite HTML entry
```

### Pattern 1: JWT Authentication Flow

**What:** Standard FastAPI JWT auth with role-based access control
**When to use:** All authenticated endpoints

Backend flow:
```python
# backend/app/services/auth.py
from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
```

Backend dependency:
```python
# backend/app/dependencies.py
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.api_prefix}/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Decode JWT, query user from DB, raise 401 if invalid
    ...

def require_role(role: str):
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role != role:
            raise AppException(403, "FORBIDDEN", "Insufficient permissions")
        return user
    return role_checker
```

### Pattern 2: React Auth Guard with Router

**What:** Role-based route protection using React Router layout routes
**When to use:** All protected pages

```typescript
// router/auth-guard.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function ProtectedRoute() {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { user } = useAuthStore();
  if (user?.role !== "admin") return <Navigate to="/user/dashboard" replace />;
  return <Outlet />;
}
```

### Pattern 3: i18n with Namespace-Based Translation Files

**What:** react-i18next initialized with lazy-loaded namespace JSON files
**When to use:** All UI text

```typescript
// src/i18n/index.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en-US",
    supportedLngs: ["en-US", "zh-CN"],
    defaultNS: "common",
    ns: ["common", "auth", "nav"],
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
```

Usage in components:
```typescript
import { useTranslation } from "react-i18next";

function LoginPage() {
  const { t } = useTranslation("auth");
  return <h1>{t("title")}</h1>; // Reads from auth.json
}
```

### Pattern 4: Pluggable Service Adapter Extension

**What:** Extend existing `BaseCoachingAdapter` pattern to STT, TTS, Avatar service categories
**When to use:** All AI service integrations

```python
# backend/app/services/agents/stt/base.py
from abc import ABC, abstractmethod

class BaseSTTAdapter(ABC):
    """Abstract base for Speech-to-Text adapters."""
    name: str = ""

    @abstractmethod
    async def transcribe(self, audio_data: bytes, language: str = "zh-CN") -> str:
        """Transcribe audio to text."""
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        ...
```

Each service category (STT, TTS, Avatar) follows the same `Base + Registry + Mock` pattern as the existing coaching adapter. The `AdapterRegistry` can be extended to a `ServiceRegistry` that manages multiple registries by category.

### Pattern 5: Feature Toggle Configuration

**What:** Config-driven feature availability using pydantic-settings + Vite env vars
**When to use:** All optional features (Avatar, voice modes, etc.)

```python
# backend/app/config.py (additions)
class Settings(BaseSettings):
    # ... existing fields ...

    # Feature toggles
    feature_avatar_enabled: bool = False
    feature_voice_enabled: bool = False
    feature_realtime_voice_enabled: bool = False

    # Voice mode: "text_only" | "stt_tts" | "realtime" | "voice_live"
    default_voice_mode: str = "text_only"

    # Region
    region: str = "global"  # "global" | "china" | "eu"

    # Azure Avatar (optional premium)
    azure_avatar_endpoint: str = ""
    azure_avatar_key: str = ""
```

Frontend reads config from backend API and/or Vite env vars:
```typescript
// Environment-specific via Vite
const FEATURE_FLAGS = {
  avatarEnabled: import.meta.env.VITE_FEATURE_AVATAR === "true",
  voiceEnabled: import.meta.env.VITE_FEATURE_VOICE === "true",
};
```

### Pattern 6: Figma Make Component Adaptation

**What:** Copy shadcn/ui components from `figma-make/` to `frontend/src/components/ui/`, adapt imports
**When to use:** All UI components in Phase 1

Adaptation checklist per component:
1. Copy `.tsx` file from `figma-make/Design System for SaaS/src/app/components/ui/`
2. Change `import { cn } from "./utils"` to `import { cn } from "@/lib/utils"`
3. Verify Tailwind v4 CSS variable names match project `index.css` (align with Figma Make `theme.css`)
4. Add i18n where component has user-visible text
5. Ensure TypeScript strict compliance (`noUnusedLocals`, `noUnusedParameters`)
6. Export from barrel `index.ts`

### Anti-Patterns to Avoid

- **Inline translations:** Never hardcode Chinese/English strings in components. Always use `t("key")` from react-i18next.
- **Sync database calls:** All backend functions must be `async def`. Never use synchronous SQLAlchemy patterns.
- **Direct role checks in components:** Use `AdminRoute`/`ProtectedRoute` guards at the router level, not `{user.role === "admin" && <Component />}` in components.
- **Hardcoded Azure endpoints:** All service URLs, keys, and regions must come from `Settings` -- never inline strings.
- **Custom cn() in UI components:** Figma Make components have their own `utils.ts` with an identical `cn()`. Replace all imports to use the project's `@/lib/utils`.
- **Installing all Radix packages at once:** Only install Radix primitives needed by Phase 1 components. The Figma Make package.json lists 20+ Radix packages, but many are for later phases.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt wrapper | `passlib.context.CryptContext(schemes=["bcrypt"])` | Timing-safe comparison, automatic salt, migration support |
| JWT tokens | Manual token string building | `python-jose` `jwt.encode()` / `jwt.decode()` | Standard JOSE claims, expiry handling, algorithm verification |
| Form validation (frontend) | Custom validation logic | react-hook-form (already in Figma deps) or native HTML5 validation | Error state management, field-level validation, accessibility |
| Component variants | Conditional className strings | `class-variance-authority` (`cva()`) | Type-safe variants, consistent pattern, used by all shadcn/ui |
| Toast notifications | Custom toast component | `sonner` | Stacking, auto-dismiss, accessible, already in Figma deps |
| Dropdown menus | Custom `useState` + positioning | `@radix-ui/react-dropdown-menu` | Focus management, keyboard navigation, screen reader support |
| Language detection | Manual `navigator.language` parsing | `i18next-browser-languagedetector` | Checks localStorage, navigator, querystring, cookie in priority order |
| Mobile drawer/sheet | Custom sliding panel | `vaul` (Drawer) or Radix `Sheet` | Touch gestures, backdrop, animation, accessibility |
| Date/time formatting | Custom formatters | `Intl.DateTimeFormat` or `date-fns` | Locale-aware formatting for zh-CN and en-US |

**Key insight:** Every UI primitive (dropdown, dialog, tooltip, checkbox) must come from Radix UI via the shadcn/ui wrappers. Building custom versions loses accessibility (focus trapping, keyboard nav, ARIA attributes) and wastes time when the Figma Make exports already provide these.

## Common Pitfalls

### Pitfall 1: Figma Make cn() Import Path Mismatch
**What goes wrong:** Figma Make components import `cn` from `"./utils"` (relative path). Project convention uses `"@/lib/utils"`.
**Why it happens:** Figma Make generates self-contained apps with local utility files.
**How to avoid:** When adapting each component, search-and-replace `from "./utils"` with `from "@/lib/utils"`. Delete `components/ui/utils.ts` -- use only `lib/utils.ts`.
**Warning signs:** TypeScript compilation errors about missing `./utils` module.

### Pitfall 2: Tailwind v4 Design Token Naming Collision
**What goes wrong:** Figma Make's `theme.css` uses shadcn/ui naming (`--background`, `--foreground`, `--primary`, `--card`) while the existing project `index.css` uses `--color-primary-500` etc. Both use `@theme inline` but with different variable names.
**Why it happens:** Two design token systems were created independently.
**How to avoid:** Replace the existing `frontend/src/styles/index.css` with the Figma Make `theme.css` as the foundation (per decision D-04), then layer in the medical-themed color values (primary blue #1E40AF, etc.) and font stacks (Inter + Noto Sans SC). The shadcn/ui semantic naming (`--primary`, `--card`, `--muted`) is required for all adapted components to work.
**Warning signs:** Components render with wrong colors or no styling; Tailwind classes like `bg-primary` don't match expected blue.

### Pitfall 3: i18next Namespace Not Loaded Before Render
**What goes wrong:** Components using `useTranslation("auth")` show raw keys (`auth.title`) instead of translated text.
**Why it happens:** With `i18next-http-backend`, namespace JSON files load asynchronously. If the component renders before the namespace loads, it shows keys.
**How to avoid:** Wrap the app with `<Suspense fallback={<LoadingState />}>` and configure i18next to work with React Suspense: `react: { useSuspense: true }`. Or preload critical namespaces in i18n init.
**Warning signs:** Flash of translation keys on page load, especially on slow networks.

### Pitfall 4: FastAPI Route Order -- Static Before Parameterized
**What goes wrong:** `GET /api/v1/users/me` matches `GET /api/v1/users/{id}` instead.
**Why it happens:** FastAPI matches routes in declaration order. If `/{id}` is declared before `/me`, "me" is treated as an id.
**How to avoid:** Always declare static routes (`/me`, `/refresh`, `/defaults`) before parameterized routes (`/{id}`). This is documented in CLAUDE.md Gotcha #3.
**Warning signs:** 404 or wrong handler executing for `/me`, `/refresh` endpoints.

### Pitfall 5: bcrypt Version Incompatibility
**What goes wrong:** `passlib` with `bcrypt>=4.1.0` raises `AttributeError: module 'bcrypt' has no attribute '__about__'`.
**Why it happens:** passlib has not been updated to support bcrypt 4.1+. The internal version check code accesses `bcrypt.__about__.__version__` which was removed.
**How to avoid:** Pin `bcrypt<4.1.0` in pyproject.toml, or use `passlib[bcrypt]` which typically manages this. If issues arise, use `bcrypt==4.0.1` explicitly. Alternatively, use `CryptContext(schemes=["bcrypt"], deprecated="auto")` which handles this gracefully in current passlib releases.
**Warning signs:** Import errors or AttributeError when hashing passwords.

### Pitfall 6: SQLite ALTER COLUMN Limitation in Alembic
**What goes wrong:** Alembic migration fails with `OperationalError` when trying to alter a column in SQLite.
**Why it happens:** SQLite does not support `ALTER COLUMN`. CLAUDE.md Gotcha #1.
**How to avoid:** Use Alembic batch operations for SQLite: `with op.batch_alter_table('users') as batch_op: batch_op.alter_column(...)`. Configure Alembic env.py with `render_as_batch=True` for SQLite.
**Warning signs:** Migration errors in development (SQLite); no issue in production (PostgreSQL).

### Pitfall 7: CORS Missing Frontend Dev Port
**What goes wrong:** Login API calls from frontend fail silently with no error in network tab.
**Why it happens:** CORS not configured for the frontend dev server port. CLAUDE.md Gotcha #6.
**How to avoid:** Ensure `cors_origins` in Settings includes `http://localhost:5173`. The Vite dev proxy at `/api` should bypass CORS, but direct API calls need it. Already configured in `config.py` default value.
**Warning signs:** Browser console shows CORS errors; API requests blocked.

### Pitfall 8: Alembic env.py Missing Model Imports
**What goes wrong:** `alembic revision --autogenerate` generates empty migrations -- no table changes detected.
**Why it happens:** Alembic env.py does not import ORM model modules, so `Base.metadata` has no tables registered. CLAUDE.md Gotcha #7.
**How to avoid:** In `alembic/env.py`, import all model modules: `from app.models.user import User`. Or import the models package `__init__.py` that re-exports them all.
**Warning signs:** Auto-generated migration has no `op.create_table()` calls despite new models.

## Code Examples

### User ORM Model

```python
# backend/app/models/user.py
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), default="")
    role: Mapped[str] = mapped_column(String(20), default="user")  # "user" or "admin"
    is_active: Mapped[bool] = mapped_column(default=True)
    preferred_language: Mapped[str] = mapped_column(String(10), default="zh-CN")
```

### Auth Pydantic Schemas

```python
# backend/app/schemas/auth.py
from pydantic import BaseModel, ConfigDict

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    preferred_language: str
```

### Auth Router

```python
# backend/app/api/auth.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.services.auth import authenticate_user, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, request.username, request.password)
    token = create_access_token(data={"sub": user.id, "role": user.role})
    return TokenResponse(access_token=token)

@router.get("/me", response_model=UserResponse)
async def get_me(user = Depends(get_current_user)):
    return user
```

### Frontend Auth Store (Lightweight)

```typescript
// src/stores/auth-store.ts
interface AuthState {
  token: string | null;
  user: User | null;
}

// Simple store using module-level state + subscription pattern
// Or use zustand if preferred -- but keep lightweight per CLAUDE.md
let state: AuthState = {
  token: localStorage.getItem("access_token"),
  user: null,
};

const listeners = new Set<() => void>();

export function useAuthStore() {
  // React 18 useSyncExternalStore pattern
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function setAuth(token: string, user: User) {
  localStorage.setItem("access_token", token);
  state = { token, user };
  listeners.forEach((l) => l());
}

export function clearAuth() {
  localStorage.removeItem("access_token");
  state = { token: null, user: null };
  listeners.forEach((l) => l());
}
```

### i18n Translation File Structure

```json
// public/locales/en-US/auth.json
{
  "title": "AI Coach",
  "email": "Email",
  "password": "Password",
  "rememberMe": "Remember me",
  "signIn": "Sign In",
  "signingIn": "Signing in...",
  "loginFailed": "Invalid username or password",
  "copyright": "2026 AI Coach Platform"
}
```

```json
// public/locales/zh-CN/auth.json
{
  "title": "AI 教练",
  "email": "邮箱",
  "password": "密码",
  "rememberMe": "记住我",
  "signIn": "登录",
  "signingIn": "登录中...",
  "loginFailed": "用户名或密码错误",
  "copyright": "2026 AI 教练平台"
}
```

### Adapted Button Component (from Figma Make)

```typescript
// src/components/ui/button.tsx
// Adapted from figma-make/Design System for SaaS/src/app/components/ui/button.tsx
// Changes: import path for cn(), removed data-slot (optional)
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";  // CHANGED: was "./utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

// ... rest identical to Figma Make version
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind CSS v3 config file | Tailwind CSS v4 `@theme inline` CSS vars | Jan 2025 | Design tokens in CSS, not JS config |
| shadcn/ui v0 (class merger) | shadcn/ui latest (data-slot pattern) | 2025 | Components use `data-slot` attributes for CSS targeting |
| React Router v6 | React Router v7 | Late 2024 | `Component` prop instead of `element`, `createBrowserRouter` |
| passlib + bcrypt 3.x | passlib + bcrypt 4.x | 2024 | Potential version incompatibility (see Pitfall 5) |
| i18next JSON v3 format | i18next JSON v4 format | 2023 | Flat keys preferred over nested objects |
| OAuth2PasswordRequestForm | Custom LoginRequest schema | Current | Either works; custom schema is cleaner for non-form-based API clients |

**Deprecated/outdated:**
- `@app.on_event("startup")` / `@app.on_event("shutdown")`: Replaced by `lifespan` asynccontextmanager in FastAPI (already used in project)
- `Optional[X]`: Use `X | None` syntax (Python 3.10+, project targets 3.11)
- `tailwind.config.js`: Not used in Tailwind CSS v4; all config via CSS `@theme inline`

## Open Questions

1. **Alembic env.py does not exist yet**
   - What we know: The `backend/alembic/` directory exists with a `versions/` subdirectory but no `env.py`, `alembic.ini`, or script template
   - What's unclear: Whether Alembic was initialized and files were deleted, or it was never initialized
   - Recommendation: Run `alembic init alembic` to generate the configuration, then customize `env.py` to use async engine and import all models. Also create `alembic.ini` in the backend root.

2. **Frontend entry point files missing**
   - What we know: `index.html`, `src/main.tsx`, `src/App.tsx` do not exist. The frontend has no runnable app yet.
   - What's unclear: Whether there was a deliberate decision to defer these or they were simply never created
   - Recommendation: Create these as part of the first task. They are prerequisite to all other frontend work.

3. **Auth store implementation choice**
   - What we know: CLAUDE.md says "lightweight store for auth, no Redux". Options: React Context, zustand, useSyncExternalStore, or simple module state.
   - What's unclear: Whether to add zustand as a dependency or use a zero-dependency approach
   - Recommendation: Use React Context + `useState` for the auth provider since it is the simplest zero-dependency approach. If more stores are needed in later phases, add zustand then.

4. **Seed data for development**
   - What we know: `backend/scripts/seed_data.py` is referenced in CLAUDE.md Quick Start but does not exist. Phase 1 needs at least one admin and one user account for development/testing.
   - What's unclear: What the seed data format should look like
   - Recommendation: Create `seed_data.py` that inserts a default admin (admin/admin123) and user (user/user123) with hashed passwords.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python | Backend | Yes | 3.11.9 | -- |
| Node.js | Frontend | Yes | 23.11.0 | -- |
| npm | Frontend deps | Yes | 11.8.0 | -- |
| pip | Backend deps | Yes | 24.0 | -- |
| Docker | Optional dev | Not checked | -- | Local dev without Docker |
| PostgreSQL | Production DB | Not needed for dev | -- | SQLite + aiosqlite |

**Missing dependencies with no fallback:** None -- all required tools are available.

**Missing dependencies with fallback:** Docker is not checked but is not required for local development (SQLite is the dev database).

## Sources

### Primary (HIGH confidence)
- Project codebase: `backend/app/config.py`, `backend/app/main.py`, `backend/app/services/agents/` -- existing patterns verified by direct code reading
- Figma Make exports: `figma-make/Design System for SaaS/`, `figma-make/Design Login and Layout Shell/` -- component structure and dependencies verified
- `figma-make/Design System for SaaS/package.json` -- dependency versions verified against npm registry
- `CLAUDE.md` -- all project constraints and coding conventions
- `docs/figma-prompts/00-design-system.md`, `docs/figma-prompts/01-login-and-layout.md` -- design specifications

### Secondary (MEDIUM confidence)
- npm registry: Package versions verified via `npm view` for react-i18next (16.6.2), i18next (25.10.5), i18next-browser-languagedetector (8.2.1), i18next-http-backend (3.0.2), @radix-ui/react-slot (1.2.4), class-variance-authority (0.7.1), react-router-dom (7.13.2), sonner (2.0.7), vaul (1.1.2), tailwind-merge (3.5.0)
- pip installed packages: Verified python-jose (3.3.0), passlib (1.7.4), FastAPI (0.115.0), pydantic-settings (2.5.2)

### Tertiary (LOW confidence)
- bcrypt version incompatibility with passlib: Based on training data knowledge of a known issue in 2024. Should verify current state of passlib compatibility before implementation. If issues arise, pin bcrypt version.
- Web search was unavailable during research. All library API patterns are based on training knowledge and should be verified against official documentation during implementation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All libraries already in project dependencies or verified via npm/pip registries. No speculative recommendations.
- Architecture: HIGH -- Patterns extend existing codebase patterns (adapter, DI, config). Figma Make components inspected directly.
- Pitfalls: MEDIUM -- Some pitfalls from training data (bcrypt compat), others verified from CLAUDE.md gotchas. Web search unavailable for latest community reports.
- Code examples: MEDIUM -- Based on standard library patterns and existing code. Should be validated against latest API docs during implementation.

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (30 days -- stable ecosystem, no fast-moving dependencies)

</details>

## UI Specification

<details><summary>Click to expand UI spec</summary>

# Phase 1 -- UI Design Contract

> Visual and interaction contract for the foundation phase: login page, responsive app shell (user + admin layouts), shared component library, and i18n. Generated by gsd-ui-researcher, verified by gsd-ui-checker.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | manual shadcn/ui adaptation (no `components.json`) |
| Preset | not applicable -- components adapted from `figma-make/Design System for SaaS/` |
| Component library | Radix UI primitives via shadcn/ui wrappers |
| Icon library | lucide-react ^0.460.0 |
| Font | Inter (EN) + Noto Sans SC (CN), loaded via Google Fonts |

**Source:** CONTEXT.md D-01, D-02; RESEARCH.md Standard Stack; Figma Make `fonts.css`

**Note:** No `components.json` exists because the project adapts pre-generated Figma Make shadcn/ui components into `frontend/src/components/ui/` rather than using `npx shadcn add`. All Radix primitives are installed as direct npm dependencies. The registry safety gate for `npx shadcn` preset automation does not apply.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding between icon and label |
| sm | 8px | Compact element spacing, input internal padding |
| md | 16px | Default element spacing, card internal padding |
| lg | 24px | Section padding inside cards and panels |
| xl | 32px | Layout gaps between cards, sidebar section breaks |
| 2xl | 48px | Major section breaks, page-level vertical rhythm |
| 3xl | 64px | Top-nav height (64px), page top/bottom margin |

Exceptions:
- Top-nav bar height: 64px (matches `3xl` token) -- source: Figma prompt A2
- Admin top-bar height: 56px (7 * 8px, consistent with 8-point scale) -- source: Figma prompt A3
- Admin sidebar width: 240px (30 * 8px) -- source: CONTEXT.md Claude's Discretion
- Login card width: 480px (60 * 8px) -- source: Figma prompt A1
- Mobile touch target minimum: 44px (WCAG 2.5.5 conformance)

**Source:** Figma prompts 00/01; CONTEXT.md Claude's Discretion (sidebar 240px, top-nav 64px)

---

## Typography

| Role | Size | Weight | Line Height | CSS Variable |
|------|------|--------|-------------|--------------|
| Body | 16px (1rem) | 400 (normal) | 1.5 | `--text-base` / `--font-weight-normal` |
| Label | 16px (1rem) | 500 (medium) | 1.5 | `--text-base` / `--font-weight-medium` |
| Heading (h3) | 18px (1.125rem) | 500 (medium) | 1.5 | `--text-lg` / `--font-weight-medium` |
| Display (h1) | 24px (1.5rem) | 500 (medium) | 1.5 | `--text-2xl` / `--font-weight-medium` |

Font stack: `'Inter', 'Noto Sans SC', sans-serif`

The Figma Make theme.css uses Tailwind's default text size scale (`--text-base`, `--text-lg`, `--text-xl`, `--text-2xl`) and declares only two font weights: 400 and 500. All heading levels, labels, and buttons use weight 500. Body text and inputs use weight 400. Line height is uniformly 1.5 across all roles.

**Sizes declared (4 total):** 16px, 18px, 20px (h2), 24px (h1)
**Weights declared (2 total):** 400 (normal), 500 (medium)

**Source:** Figma Make `theme.css` lines 166-206; Figma prompt 00 (Inter + Noto Sans SC)

---

## Color

### Primary Palette (Light Mode)

| Role | Value | Tailwind Class | Usage |
|------|-------|----------------|-------|
| Dominant (60%) | `#FFFFFF` | `bg-background` | Page background, content surfaces |
| Secondary (30%) | `#F8FAFC` | `bg-muted` / custom | Main content area background, card hover states |
| Accent (10%) | `#1E40AF` | `bg-primary` | Primary CTA buttons, active nav indicators, links |
| Destructive | `#EF4444` | `bg-destructive` | Delete actions, error states, danger badges |

### Full Token Map (from Figma Make theme.css)

| Token | Light Value | Dark Value | Usage |
|-------|-------------|------------|-------|
| `--background` | `#FFFFFF` | `oklch(0.145 0 0)` | Page background |
| `--foreground` | `oklch(0.145 0 0)` (near-black) | `oklch(0.985 0 0)` | Primary text |
| `--card` | `#FFFFFF` | `oklch(0.145 0 0)` | Card surfaces |
| `--primary` | `#1E40AF` | `#3B82F6` | Primary actions |
| `--primary-foreground` | `#FFFFFF` | `oklch(0.205 0 0)` | Text on primary |
| `--secondary` | `#475569` | `#64748B` | Secondary text, tags |
| `--muted` | `#ECECF0` | `oklch(0.269 0 0)` | Muted backgrounds |
| `--muted-foreground` | `#717182` | `oklch(0.708 0 0)` | Placeholder text |
| `--accent` | `#E9EBEF` | `oklch(0.269 0 0)` | Hover backgrounds |
| `--destructive` | `#EF4444` | `oklch(0.396 0.141 25.723)` | Destructive actions |
| `--border` | `rgba(0,0,0,0.1)` | `oklch(0.269 0 0)` | All borders |
| `--input-background` | `#F3F3F5` | -- | Input field backgrounds |
| `--ring` | `oklch(0.708 0 0)` | `oklch(0.439 0 0)` | Focus rings |

### Scoring Semantic Colors (used in later phases, defined now)

| Token | Value | Usage |
|-------|-------|-------|
| `--strength` | `#22C55E` | Scoring: strengths (green) |
| `--weakness` | `#F97316` | Scoring: weaknesses (orange) |
| `--improvement` | `#A855F7` | Scoring: improvement areas (purple) |

### Admin Sidebar Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--sidebar` | `#1E293B` (dark blue) | Admin sidebar background |
| `--sidebar-foreground` | near-white | Sidebar text |
| `--sidebar-primary` | `#1E40AF` | Active sidebar item |
| `--sidebar-primary-foreground` | `#FFFFFF` | Active sidebar item text |

### Accent Reserved For (explicit list)

The accent color `#1E40AF` (primary blue) is reserved ONLY for:
1. Primary CTA buttons ("Sign In", main action per page)
2. Active navigation indicator (underline or background highlight)
3. Text links that navigate (not all interactive elements)
4. Focus ring on form inputs (via `--ring` token)
5. Active sidebar menu item background (admin layout)
6. Logo mark color

It is NOT used for: card borders, section backgrounds, badges (use `--secondary` or `--muted` instead), or general hover states (use `--accent` #E9EBEF instead).

**Source:** Figma Make `theme.css`; CONTEXT.md D-04 (Figma tokens are source of truth); Figma prompt 00 (color scheme)

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius` (base) | 10px (0.625rem) | Reference value from Figma Make theme.css |
| `--radius-sm` | 6px (`--radius` - 4px) | Buttons, inputs, small elements |
| `--radius-md` | 8px (`--radius` - 2px) | Cards, dialogs, popovers |
| `--radius-lg` | 10px (`--radius`) | Large containers, sheets |
| `--radius-xl` | 14px (`--radius` + 4px) | Hero sections, modals |

**Note:** Figma prompt 00 specifies "8px cards, 6px buttons, 4px inputs". The Figma Make theme.css calculates from a 10px base. The effective values are: cards use `--radius-md` (8px), buttons use `--radius-sm` (6px). Input radius should use `--radius-sm` (6px) to match the Figma spec closely, though the prompt says 4px -- defer to the generated code which uses 6px.

**Source:** Figma Make `theme.css` lines 134-137; Figma prompt 00

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| Card shadow | `0 1px 3px rgba(0,0,0,0.1)` | Cards, dropdown menus |
| Nav shadow | `0 1px 3px rgba(0,0,0,0.1)` | Top-nav bottom edge |
| Elevated | `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)` | Modals, popovers |

**Source:** Figma prompt 00 ("shadows: subtle 0 1px 3px rgba(0,0,0,0.1)")

---

## Layout Contract

### Login Page

| Property | Value |
|----------|-------|
| Viewport | 1440x900 desktop reference, responsive down to 375px mobile |
| Background | Subtle gradient: light blue to white |
| Card width | 480px centered, full-width on mobile with 16px horizontal padding |
| Card content | Logo + "AI Coach" title, email input, password input (with show/hide toggle), "Remember me" checkbox, full-width "Sign In" button |
| Language switcher | Bottom-right corner of viewport |
| Footer | "2026 AI Coach Platform" centered below card |

### User Layout Shell

| Property | Value |
|----------|-------|
| Top-nav height | 64px, white background, bottom shadow |
| Top-nav left | Logo + "AI Coach" |
| Top-nav center | Nav links: Dashboard, Training, History, Reports |
| Top-nav right | Language switcher, notification bell, user avatar + name dropdown |
| Content area | Below nav, `#F8FAFC` background |
| Footer | Minimal, copyright only |
| Mobile (<768px) | Hamburger menu replaces nav links, opens as sheet/drawer |

### Admin Layout Shell

| Property | Value |
|----------|-------|
| Sidebar width | 240px, collapsed to ~64px (icon-only) |
| Sidebar bg | `#1E293B` (dark blue) |
| Sidebar top | Logo + "AI Coach Admin" |
| Sidebar items | Dashboard, Users, HCP Profiles, Scenarios, Materials, Reports, Azure Services, Settings (each with lucide icon) |
| Sidebar bottom | Collapse/expand toggle button |
| Top-bar height | 56px, white background |
| Top-bar content | Breadcrumb path (left), user info (right) |
| Content area | Right of sidebar, `#F8FAFC` background |
| Mobile (<768px) | Sidebar hidden, hamburger menu opens sidebar as overlay sheet |

### Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| mobile | < 640px | Single column, hamburger menu, full-width cards |
| tablet | 640px - 1023px | Sidebar collapsed or overlay, 2-column grid where applicable |
| desktop | >= 1024px | Full layout, sidebar expanded, multi-column content |
| wide | >= 1440px | Max-width container centered, reference design width |

**Source:** Figma prompts A1/A2/A3; CONTEXT.md D-05, Claude's Discretion (responsive breakpoints)

---

## Copywriting Contract

All copy is delivered via react-i18next translation keys. The table below defines the canonical English copy; Chinese translations live in `public/locales/zh-CN/` namespace files.

### Auth Namespace (`auth.json`)

| Element | Key | English Copy | Chinese Copy |
|---------|-----|-------------|--------------|
| Page title | `auth.title` | AI Coach | AI 教练 |
| Email label | `auth.email` | Email | 邮箱 |
| Password label | `auth.password` | Password | 密码 |
| Remember me | `auth.rememberMe` | Remember me | 记住我 |
| **Primary CTA** | `auth.signIn` | **Sign In** | **登录** |
| Loading state | `auth.signingIn` | Signing in... | 登录中... |
| Login error | `auth.loginFailed` | Invalid username or password. Please try again. | 用户名或密码错误，请重试。 |
| Footer | `auth.copyright` | 2026 AI Coach Platform | 2026 AI 教练平台 |

### Navigation Namespace (`nav.json`)

| Element | Key | English Copy | Chinese Copy |
|---------|-----|-------------|--------------|
| User nav: Dashboard | `nav.dashboard` | Dashboard | 仪表板 |
| User nav: Training | `nav.training` | Training | 训练 |
| User nav: History | `nav.history` | History | 历史记录 |
| User nav: Reports | `nav.reports` | Reports | 报告 |
| Admin nav: Users | `nav.users` | Users | 用户管理 |
| Admin nav: HCP Profiles | `nav.hcpProfiles` | HCP Profiles | HCP 档案 |
| Admin nav: Scenarios | `nav.scenarios` | Scenarios | 场景管理 |
| Admin nav: Materials | `nav.materials` | Materials | 资料管理 |
| Admin nav: Azure Services | `nav.azureServices` | Azure Services | Azure 服务 |
| Admin nav: Settings | `nav.settings` | Settings | 系统设置 |

### Common Namespace (`common.json`)

| Element | Key | English Copy | Chinese Copy |
|---------|-----|-------------|--------------|
| Empty state heading | `common.emptyState.title` | Nothing here yet | 暂无内容 |
| Empty state body | `common.emptyState.body` | Content will appear here once data is available. | 数据可用后将在此显示。 |
| Error state heading | `common.error.title` | Something went wrong | 出现错误 |
| Error state body | `common.error.body` | An unexpected error occurred. Please refresh the page or try again later. | 发生意外错误。请刷新页面或稍后重试。 |
| Loading | `common.loading` | Loading... | 加载中... |
| Language: Chinese | `common.lang.zhCN` | Chinese | 中文 |
| Language: English | `common.lang.enUS` | English | English |
| Logout | `common.logout` | Sign Out | 退出登录 |
| Profile | `common.profile` | Profile | 个人资料 |

### Destructive Actions (Phase 1)

There are no destructive actions in Phase 1. The login page and layout shell do not include delete or irreversible operations. Logout is not destructive (session can be re-established by logging in again).

**Source:** RESEARCH.md code examples (i18n translation files); Figma prompts A1/A2/A3 (layout labels)

---

## Component Inventory (Phase 1)

### UI Primitives (adapted from Figma Make)

These components are copied from `figma-make/Design System for SaaS/src/app/components/ui/` and adapted per RESEARCH.md Pattern 6 (import path fix, TypeScript strict compliance, barrel export).

| Component | Figma Make Source | Radix Dependency | Phase 1 Usage |
|-----------|-------------------|------------------|---------------|
| `button.tsx` | Yes | `@radix-ui/react-slot` | Login CTA, nav actions |
| `card.tsx` | Yes | None | Login card wrapper, dashboard placeholders |
| `input.tsx` | Yes | None | Email/password fields |
| `label.tsx` | Yes | `@radix-ui/react-label` | Form field labels |
| `checkbox.tsx` | Yes | `@radix-ui/react-checkbox` | "Remember me" |
| `avatar.tsx` | Yes | `@radix-ui/react-avatar` | User avatar in nav |
| `dropdown-menu.tsx` | Yes | `@radix-ui/react-dropdown-menu` | User menu, language switcher |
| `select.tsx` | Yes | `@radix-ui/react-select` | Language selector fallback |
| `separator.tsx` | Yes | `@radix-ui/react-separator` | Visual dividers |
| `tooltip.tsx` | Yes | `@radix-ui/react-tooltip` | Icon-only button tooltips |
| `sheet.tsx` | Yes | `@radix-ui/react-dialog` | Mobile nav drawer |
| `dialog.tsx` | Yes | `@radix-ui/react-dialog` | Future use (included for completeness) |
| `switch.tsx` | Yes | `@radix-ui/react-switch` | Feature toggle UI |
| `skeleton.tsx` | Yes | None | Loading states |
| `badge.tsx` | Yes | None | Status indicators |
| `sonner.tsx` | Yes | None (sonner lib) | Toast notifications |
| `form.tsx` | Yes | None (react-hook-form) | Form validation wrapper |

### Shared Components (new, project-specific)

| Component | Purpose | Location |
|-----------|---------|----------|
| `language-switcher.tsx` | Dropdown to switch zh-CN / en-US, persists to localStorage | `components/shared/` |
| `loading-state.tsx` | Full-page or inline loading with skeleton pattern | `components/shared/` |
| `empty-state.tsx` | Illustration + message + optional action button | `components/shared/` |

### Layout Components (adapted from Figma Make)

| Component | Purpose | Location |
|-----------|---------|----------|
| `user-layout.tsx` | Top-nav + content area for MR users | `components/layouts/` |
| `admin-layout.tsx` | Sidebar + top-bar + content area for admins | `components/layouts/` |
| `auth-layout.tsx` | Centered card on gradient background for login | `components/layouts/` |

---

## Interaction States

### Button States

| State | Visual |
|-------|--------|
| Default | `bg-primary text-primary-foreground` (#1E40AF white text) |
| Hover | `bg-primary/90` (10% transparent) |
| Focus | 3px ring using `--ring` token |
| Disabled | `opacity-50 pointer-events-none` |
| Loading | Text replaced with "Signing in..." + spinner, button disabled |

### Input States

| State | Visual |
|-------|--------|
| Default | `bg-input-background` (#F3F3F5), transparent border |
| Focus | Border becomes `--ring` color, 3px ring |
| Error | Border becomes `--destructive` (#EF4444), error message below in destructive color |
| Disabled | `opacity-50` |

### Navigation States

| State | Visual |
|-------|--------|
| Default link | `text-foreground` weight 400 |
| Hover link | `text-primary` (#1E40AF) |
| Active link | `text-primary font-medium` with underline indicator (user) or background highlight (admin sidebar) |

### Toast Notification

| Type | Visual |
|------|--------|
| Success | Green left border, check icon, auto-dismiss 4 seconds |
| Error | Red left border, X icon, persists until dismissed |
| Info | Blue left border, info icon, auto-dismiss 4 seconds |

---

## Accessibility Contract

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | All text meets WCAG AA (4.5:1 minimum). #1E40AF on white = 7.1:1 (passes AAA). #717182 on white = 4.6:1 (passes AA). |
| Focus indicators | 3px ring on all interactive elements via Radix primitives |
| Keyboard navigation | Full keyboard support via Radix UI primitives (tab order, arrow keys in menus, Escape to close) |
| Screen reader | Semantic HTML (nav, main, aside, header), ARIA labels on icon-only buttons, Radix handles dialog/menu ARIA |
| Touch targets | Minimum 44px height on mobile for all interactive elements |
| Language | `lang` attribute on `<html>` updated by i18next language detector |
| Reduced motion | Respect `prefers-reduced-motion` for transitions and animations |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (manual adaptation) | button, card, input, label, checkbox, avatar, dropdown-menu, select, separator, tooltip, sheet, dialog, switch, skeleton, badge, sonner, form | not required -- source is `figma-make/` local directory, code inspected directly |
| Third-party registries | none | not applicable |

**Note:** Because components are adapted from local Figma Make exports (not fetched from a remote registry at install time), the registry vetting gate for third-party code does not apply. The Figma Make source code was generated by Figma and lives in the project repository under `figma-make/`.

---

## Dark Mode

The Figma Make theme.css includes a complete `.dark` class variant. Phase 1 does NOT implement dark mode toggle UI, but the design tokens are defined for both modes. Dark mode support can be added in a future phase by adding a theme toggle component that applies the `.dark` class to the document root.

**Phase 1 scope:** Light mode only. Dark mode tokens are preserved in the theme CSS but not exposed to the user.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending

</details>

## Verification

<details><summary>Click to expand verification report</summary>

# Phase 1: Foundation, Auth, and Design System -- Verification Report

**Phase Goal:** A running application with login, responsive layout shell, shared component library, i18n framework, and pluggable architecture for all AI services -- the scaffold everything else builds on
**Verified:** 2026-03-24T14:45:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can log in with username/password and see a responsive app shell with sidebar navigation -- session persists across browser refresh | VERIFIED | Login page (`pages/login.tsx`) uses `useLogin` mutation -> POST /auth/login -> JWT stored in localStorage via `auth-store.ts` using `useSyncExternalStore`. Router guards (`auth-guard.tsx`) check token for ProtectedRoute, redirect to /login without. User layout has 64px top-nav with responsive Sheet hamburger, admin layout has 240px collapsible sidebar. 51 backend tests pass including login+me flow. |
| 2 | Admin and User roles exist -- admin sees admin routes, user does not | VERIFIED | User model has `role` field (user/admin). `require_role("admin")` dependency in `dependencies.py`. `AdminRoute` guard checks `user?.role !== "admin"` and redirects to `/user/dashboard`. Router nests admin routes under AdminRoute wrapper. Integration test `test_admin_can_access_admin_endpoint_user_cannot` passes. |
| 3 | All UI text is externalized via react-i18next and the app can switch between zh-CN and en-US | VERIFIED | i18n initialized in `i18n/index.ts` with `initReactI18next`, HTTP backend, 3 namespaces (common, auth, nav). 6 locale JSON files present (en-US and zh-CN for each namespace). Login page uses `useTranslation("auth")`, layouts use `useTranslation("nav")` and `useTranslation("common")`. LanguageSwitcher calls `i18n.changeLanguage()`. Zero hardcoded UI strings found in page/layout components. |
| 4 | AI service adapters (LLM, STT, TTS, Avatar) use pluggable provider pattern -- a mock provider works end-to-end without any Azure credentials | VERIFIED | Base ABCs exist: `BaseSTTAdapter`, `BaseTTSAdapter`, `BaseAvatarAdapter`, `BaseCoachingAdapter`. Mock implementations in each category. `ServiceRegistry` manages 4 categories with `register(category, adapter)`. Mock adapters auto-registered in `main.py` lifespan. 21 adapter tests + 6 full-stack tests pass. Config API returns `available_adapters` dict with mock in each category. |
| 5 | Feature toggles, Azure service endpoints, voice mode selection, and region configuration are driven by config (not hardcoded) -- changing config changes behavior without code changes | VERIFIED | `config.py` Settings class has: `feature_avatar_enabled`, `feature_voice_enabled`, `feature_realtime_voice_enabled`, `feature_conference_enabled` (all bool, default False), `default_voice_mode` (text_only), `region` (global), `azure_avatar_endpoint`, `azure_content_endpoint`, `default_llm_provider` etc. All read from .env via pydantic-settings. GET /api/v1/config/features returns current flags. Frontend `ConfigProvider` fetches and exposes via `useConfig()`. UserLayout shows mic icon conditionally on `voice_enabled`. `.env.example` documents all options. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/models/user.py` | User ORM model with role field | VERIFIED | 21 lines, `class User(Base, TimestampMixin)`, role field, hashed_password, preferred_language |
| `backend/app/services/auth.py` | Auth business logic | VERIFIED | verify_password, get_password_hash, create_access_token, authenticate_user -- all substantive implementations |
| `backend/app/api/auth.py` | Auth REST endpoints | VERIFIED | router with /login, /me, /refresh endpoints |
| `backend/app/dependencies.py` | Auth dependencies for DI | VERIFIED | get_current_user, require_role, OAuth2PasswordBearer -- 54 lines |
| `backend/app/main.py` | App with router registration and adapter startup | VERIFIED | auth_router + config_router registered, mock adapters registered in lifespan |
| `backend/app/config.py` | Extended Settings with feature flags | VERIFIED | 65 lines, feature toggles, region, voice mode, Azure configs, default providers |
| `backend/app/services/agents/registry.py` | ServiceRegistry multi-category | VERIFIED | 48 lines, register/get/list_category/discover_category/list_all_categories |
| `backend/app/services/agents/stt/base.py` | BaseSTTAdapter ABC | VERIFIED | transcribe(), is_available(), get_supported_languages() |
| `backend/app/services/agents/tts/base.py` | BaseTTSAdapter ABC | VERIFIED | synthesize(), is_available(), list_voices() |
| `backend/app/services/agents/avatar/base.py` | BaseAvatarAdapter ABC | VERIFIED | create_session(), send_text(), close_session(), is_available() |
| `backend/app/services/agents/stt/mock.py` | MockSTTAdapter | VERIFIED | Returns deterministic transcriptions |
| `backend/app/services/agents/tts/mock.py` | MockTTSAdapter | VERIFIED | Returns fake audio bytes |
| `backend/app/services/agents/avatar/mock.py` | MockAvatarAdapter | VERIFIED | Returns mock session data |
| `backend/app/api/config.py` | Config API endpoint | VERIFIED | GET /features with FeatureFlags and ConfigResponse schemas |
| `backend/scripts/seed_data.py` | Seed data script | VERIFIED | Creates admin + user1 accounts idempotently |
| `backend/alembic/env.py` | Alembic async config | VERIFIED | render_as_batch, imports models |
| `backend/tests/test_full_stack.py` | Integration tests | VERIFIED | 6 tests covering auth+config+adapters flow |
| `frontend/src/styles/index.css` | Design tokens | VERIFIED | 216 lines, --primary: #1E40AF, --sidebar: #1E293B, @theme inline, @custom-variant dark |
| `frontend/src/components/ui/button.tsx` | Button with cva variants | VERIFIED | buttonVariants with 6 variants + 4 sizes |
| `frontend/src/components/ui/index.ts` | Barrel export | VERIFIED | Exports all 17 components |
| `frontend/index.html` | Vite entry | VERIFIED | div#root, Google Fonts |
| `frontend/src/main.tsx` | React entry | VERIFIED | createRoot, imports i18n and styles |
| `frontend/src/App.tsx` | Root component | VERIFIED | QueryClientProvider, ConfigProvider, RouterProvider, Toaster |
| `frontend/src/i18n/index.ts` | i18n init | VERIFIED | initReactI18next, fallbackLng en-US, zh-CN, 3 namespaces |
| `frontend/src/stores/auth-store.ts` | Auth store | VERIFIED | useSyncExternalStore, localStorage, setAuth/clearAuth |
| `frontend/src/hooks/use-auth.ts` | Auth hooks | VERIFIED | useLogin (mutation), useMe (query), useLogout |
| `frontend/src/hooks/use-config.ts` | Feature flag hook | VERIFIED | useFeatureFlags via apiClient.get(/config/features) |
| `frontend/src/contexts/config-context.tsx` | Config context | VERIFIED | ConfigProvider, useConfig, defaults when unauthenticated |
| `frontend/src/router/index.tsx` | Router | VERIFIED | createBrowserRouter with GuestRoute, ProtectedRoute, AdminRoute nesting |
| `frontend/src/router/auth-guard.tsx` | Auth guards | VERIFIED | ProtectedRoute/AdminRoute/GuestRoute with Navigate redirects |
| `frontend/src/components/layouts/user-layout.tsx` | User top-nav | VERIFIED | 189 lines, 64px header, nav links with i18n, Sheet for mobile, avatar dropdown |
| `frontend/src/components/layouts/admin-layout.tsx` | Admin sidebar | VERIFIED | 245 lines, 240px->64px collapsible, #1E293B, 8 nav items with icons, mobile Sheet |
| `frontend/src/components/shared/language-switcher.tsx` | Language switcher | VERIFIED | DropdownMenu with i18n.changeLanguage() |
| `frontend/src/pages/login.tsx` | Login page | VERIFIED | 133 lines, Card form, useLogin mutation, i18n, error display, password toggle |
| `frontend/public/locales/en-US/auth.json` | English auth translations | VERIFIED | signIn, password, loginFailed etc. |
| `frontend/public/locales/zh-CN/auth.json` | Chinese auth translations | VERIFIED | Contains Chinese translations |
| `frontend/public/locales/en-US/nav.json` | English nav translations | VERIFIED | dashboard, training, history, etc. |
| `frontend/public/locales/zh-CN/nav.json` | Chinese nav translations | VERIFIED | Chinese nav translations |
| `frontend/public/locales/en-US/common.json` | English common translations | VERIFIED | logout, profile, emptyState, etc. |
| `frontend/public/locales/zh-CN/common.json` | Chinese common translations | VERIFIED | Chinese common translations |

All 17 UI components exist in `frontend/src/components/ui/`: button, card, input, label, checkbox, avatar, dropdown-menu, select, separator, tooltip, sheet, dialog, switch, skeleton, badge, sonner, form.

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api/auth.py` | `services/auth.py` | `authenticate_user import` | WIRED | `from app.services.auth import authenticate_user, create_access_token` |
| `dependencies.py` | `models/user.py` | `User query in get_current_user` | WIRED | `from app.models.user import User` + `select(User).where(User.id == user_id)` |
| `main.py` | `api/auth.py` | `router include` | WIRED | `app.include_router(auth_router, prefix=settings.api_prefix)` |
| `main.py` | `api/config.py` | `router include` | WIRED | `app.include_router(config_router, prefix=settings.api_prefix)` |
| `main.py` | `registry` | `lifespan registers mocks` | WIRED | `registry.register("llm/stt/tts/avatar", Mock*Adapter())` |
| `stt/mock.py` | `stt/base.py` | `inheritance` | WIRED | `class MockSTTAdapter(BaseSTTAdapter)` |
| `api/config.py` | `config.py` | `reads Settings` | WIRED | `from app.config import get_settings` + uses all feature flags |
| `App.tsx` | `i18n/index.ts` | `i18n init import` | WIRED | `import "@/i18n"` in main.tsx (bootstraps before render) |
| `auth-guard.tsx` | `auth-store.ts` | `useAuthStore` | WIRED | `import { useAuthStore } from "@/stores/auth-store"` |
| `login.tsx` | `use-auth.ts` | `useLogin mutation` | WIRED | `import { useLogin } from "@/hooks/use-auth"` + `loginMutation.mutate()` |
| `use-auth.ts` | `api/client.ts` | `apiClient POST` | WIRED | `apiClient.post<TokenResponse>("/auth/login")` |
| `App.tsx` | `config-context.tsx` | `ConfigProvider wraps app` | WIRED | `<ConfigProvider>` wraps `<RouterProvider>` |
| `use-config.ts` | `api/client.ts` | `apiClient GET` | WIRED | `apiClient.get<AppConfig>("/config/features")` |
| `user-layout.tsx` | `config-context.tsx` | `useConfig for voice_enabled` | WIRED | `import { useConfig } from "@/contexts/config-context"` + conditional mic icon |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend tests pass | `cd backend && python3 -m pytest tests/ -v` | 51 passed, 0 failed | PASS |
| TypeScript strict mode | `cd frontend && npx tsc -b` | No errors | PASS |
| Frontend Vite build | `cd frontend && npm run build` | Built in 1.62s, produces dist/ | PASS |
| Ruff format check | `cd backend && ruff format --check .` | 44 files already formatted | PASS |
| Ruff lint check | `cd backend && ruff check .` | 5 errors (pre-existing in files from before Phase 1) | INFO (see Anti-Patterns) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-----------|-------------|--------|----------|
| AUTH-01 | 01-01 | User can log in with username/password | SATISFIED | POST /login endpoint, seed users, login page with form |
| AUTH-02 | 01-01, 01-05 | Session persists via JWT | SATISFIED | JWT in localStorage, useMe query on mount restores user |
| AUTH-03 | 01-01 | Two roles (user/admin) with route protection | SATISFIED | User.role field, require_role(), AdminRoute guard |
| AUTH-04 | 01-01 | Auth uses DI, ready for Azure AD later | SATISFIED | get_current_user dependency, OAuth2PasswordBearer, swappable |
| ARCH-01 | 01-03, 01-05 | Pluggable adapter pattern for all AI services | SATISFIED | BaseSTT/TTS/Avatar ABCs, ServiceRegistry, mock implementations |
| ARCH-02 | 01-03, 01-05 | Component-based, feature toggles | SATISFIED | Feature flags in Settings, Config API, ConfigProvider in frontend |
| ARCH-03 | 01-01 | Backend uses dependency injection | SATISFIED | FastAPI Depends for get_db, get_current_user, require_role |
| ARCH-04 | 01-02 | Shared design system from Figma | SATISFIED | 17 shadcn/ui components adapted from Figma Make, barrel export |
| ARCH-05 | 01-03 | Azure connections configurable per environment | SATISFIED | Settings has azure_openai_endpoint, azure_speech_key, azure_avatar_endpoint etc., all from .env |
| UI-01 | 01-02 | Shared component library | SATISFIED | 17 components in components/ui/ with design tokens |
| UI-02 | 01-04 | Login page and app layout shell | SATISFIED | Login page, user top-nav layout, admin sidebar layout |
| UI-07 | 01-04 | All UI text externalized via react-i18next | SATISFIED | i18n init, 6 locale files, useTranslation in all components |
| PLAT-01 | 01-04 | i18n framework integrated, zh-CN + en-US | SATISFIED | react-i18next with HTTP backend, 3 namespaces, language switcher |
| PLAT-02 | 01-04 | Responsive web design | SATISFIED | Mobile hamburger via Sheet, sidebar collapse, responsive nav |
| PLAT-04 | 01-03 | Per-region deployment supported | SATISFIED | `region: str = "global"` in Settings, configurable via .env |
| PLAT-05 | 01-03 | Voice mode configurable per deployment | SATISFIED | `default_voice_mode: str = "text_only"` in Settings, configurable via .env |

All 16 requirement IDs from the phase are accounted for and satisfied.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/services/agents/adapters/mock.py` | 15-17 | F541: f-string without placeholders | INFO | Pre-existing file from before Phase 1 plans. Cosmetic -- no functional impact. |
| `backend/app/services/agents/base.py` | 7 | UP042: Should use StrEnum instead of str+Enum | INFO | Pre-existing file from before Phase 1 plans. Style upgrade suggestion. |
| `backend/tests/test_schema_integrity.py` | 11 | F401: Unused import (sqlalchemy.inspect) | INFO | Pre-existing test file. No functional impact. |
| `frontend/src/pages/user/dashboard.tsx` | - | Placeholder page with EmptyState | INFO | Intentional -- these are navigation targets for the layout shell. Real content added in Phase 2. Does not block Phase 1 goal. |
| `frontend/src/pages/admin/dashboard.tsx` | - | Placeholder page with EmptyState | INFO | Same as above -- intentional placeholder. |

**Note:** The 5 ruff lint errors are all in files that pre-date Phase 1 execution (created in initial project setup commit `2ed79ab`). They are not regressions introduced by Phase 1. The Plan 05 SUMMARY explicitly documents this: "Pre-existing ruff lint warnings in files from prior plans -- out of scope."

### Human Verification Required

### 1. Visual Inspection of Login Page and Layouts

**Test:** Start backend (`cd backend && python scripts/seed_data.py && uvicorn app.main:app --reload --port 8000`) and frontend (`cd frontend && npm run dev`). Navigate to http://localhost:5173.
**Expected:** Login page shows centered card on gradient background with email/password fields, show/hide toggle, remember me checkbox, Sign In button, and copyright footer. Language switcher in bottom-right corner.
**Why human:** Visual appearance, gradient rendering, and component spacing cannot be verified programmatically.

### 2. Admin Sidebar Layout

**Test:** Login with admin/admin123 credentials.
**Expected:** Redirected to admin dashboard. Left sidebar with dark blue (#1E293B) background, 8 nav items with icons, AI Coach Admin header, collapse toggle. Clicking collapse narrows sidebar to icon-only (64px) with tooltips.
**Why human:** Sidebar collapse animation, dark theme rendering, tooltip positioning require visual inspection.

### 3. User Top-Nav Layout

**Test:** Log out, login with user1/user123 credentials.
**Expected:** Redirected to user dashboard. Top navigation bar at 64px height with logo, nav links (Dashboard, Training, History, Reports), language switcher, bell icon, and avatar dropdown with sign out option.
**Why human:** Navigation bar alignment, active link highlighting, dropdown menu behavior require visual inspection.

### 4. Responsive Design

**Test:** Resize browser to mobile width (<640px).
**Expected:** Hamburger menu replaces nav links. Clicking hamburger opens Sheet drawer with nav items.
**Why human:** Responsive breakpoints and Sheet overlay behavior require real viewport testing.

### 5. i18n Language Switching

**Test:** Click language switcher globe icon. Select Chinese.
**Expected:** All visible text changes to Chinese (login labels, nav items, button text). Refreshing the page maintains the language choice.
**Why human:** Complete text coverage across all visible components requires visual confirmation.

### Gaps Summary

No gaps found. All 5 success criteria from ROADMAP.md are verified through code inspection and automated tests. All 16 requirement IDs are accounted for with implementation evidence. Backend tests (51/51) pass, frontend TypeScript compiles clean under strict mode, and Vite production build succeeds. The 5 ruff lint warnings are pre-existing in files from the initial project skeleton (before Phase 1 plans) and do not affect Phase 1 deliverables.

The dashboard placeholder pages are intentional (documented as known stubs in Plan 04 SUMMARY) -- they serve as navigation targets for the layout shell and will be populated with real content in Phase 2.

All 5 SUMMARY.md files exist and are complete:
- 01-01-SUMMARY.md (JWT auth, 10min, 16 files)
- 01-02-SUMMARY.md (Design tokens + UI components, 12min, 22 files)
- 01-03-SUMMARY.md (AI adapters + config, 7min, 15 files)
- 01-04-SUMMARY.md (Frontend shell, 8min, 29 files)
- 01-05-SUMMARY.md (Integration wiring, 6min, 6 files)

---

_Verified: 2026-03-24T14:45:00Z_
_Verifier: Claude (gsd-verifier)_

</details>

