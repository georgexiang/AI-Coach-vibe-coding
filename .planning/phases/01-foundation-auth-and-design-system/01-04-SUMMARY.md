---
phase: 01-foundation-auth-and-design-system
plan: 04
subsystem: ui
tags: [react, i18n, react-router, tanstack-query, auth-store, responsive, layouts]

# Dependency graph
requires:
  - phase: 01-foundation-auth-and-design-system
    provides: "Design tokens and 17 shadcn/ui components (plan 02)"
provides:
  - "React SPA entry points (index.html, main.tsx, App.tsx)"
  - "i18n framework with zh-CN and en-US translations (3 namespaces)"
  - "Auth store with JWT persistence via useSyncExternalStore"
  - "TanStack Query hooks for login and user profile"
  - "Router with auth guards (ProtectedRoute, AdminRoute, GuestRoute)"
  - "Login page with form, error handling, and i18n"
  - "User layout (top-nav 64px, responsive hamburger)"
  - "Admin layout (240px sidebar, collapsible, dark theme)"
  - "Shared components: LanguageSwitcher, LoadingState, EmptyState"
affects: [01-05-integration, phase-2-f2f-coaching]

# Tech tracking
tech-stack:
  added: [i18next, react-i18next, i18next-browser-languagedetector, i18next-http-backend]
  patterns: [useSyncExternalStore for auth state, TanStack Query hooks per domain, route guards via wrapper components, i18n namespace separation]

key-files:
  created:
    - frontend/index.html
    - frontend/src/main.tsx
    - frontend/src/App.tsx
    - frontend/src/i18n/index.ts
    - frontend/src/types/auth.ts
    - frontend/src/types/config.ts
    - frontend/src/stores/auth-store.ts
    - frontend/src/lib/config.ts
    - frontend/src/hooks/use-auth.ts
    - frontend/src/router/index.tsx
    - frontend/src/router/auth-guard.tsx
    - frontend/src/components/layouts/auth-layout.tsx
    - frontend/src/components/layouts/user-layout.tsx
    - frontend/src/components/layouts/admin-layout.tsx
    - frontend/src/components/shared/language-switcher.tsx
    - frontend/src/components/shared/loading-state.tsx
    - frontend/src/components/shared/empty-state.tsx
    - frontend/src/pages/login.tsx
    - frontend/src/pages/user/dashboard.tsx
    - frontend/src/pages/admin/dashboard.tsx
    - frontend/src/pages/not-found.tsx
    - frontend/public/locales/en-US/auth.json
    - frontend/public/locales/en-US/common.json
    - frontend/public/locales/en-US/nav.json
    - frontend/public/locales/zh-CN/auth.json
    - frontend/public/locales/zh-CN/common.json
    - frontend/public/locales/zh-CN/nav.json
    - frontend/src/vite-env.d.ts
  modified:
    - .gitignore

key-decisions:
  - "Used useSyncExternalStore for auth store instead of React Context -- simpler, no provider wrapper needed"
  - "Separated i18n into 3 namespaces (common, auth, nav) for lazy loading and domain separation"
  - "Admin layout uses dark sidebar (bg-sidebar #1E293B) matching UI-SPEC contract"
  - "Mobile responsive via Sheet component overlay for both user hamburger menu and admin sidebar"

patterns-established:
  - "Auth guard pattern: ProtectedRoute/AdminRoute/GuestRoute as wrapper components with Outlet"
  - "i18n namespace pattern: useTranslation('namespace') per component domain"
  - "Layout shell pattern: layout components render Outlet for nested routes"
  - "Feature flags pattern: Vite env vars as build-time fallback config"

requirements-completed: [UI-02, UI-07, PLAT-01, PLAT-02]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 1 Plan 4: Frontend Shell Summary

**React SPA with i18n (zh-CN/en-US), JWT auth store, login page, responsive user top-nav and admin sidebar layouts, route guards by role**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T06:14:00Z
- **Completed:** 2026-03-24T06:22:44Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 29

## Accomplishments
- Bootstrapped React SPA with Vite entry points, QueryClientProvider, and Suspense boundary
- Integrated i18next with HTTP backend, browser language detection, and 3 namespaces across zh-CN and en-US
- Built auth store using useSyncExternalStore with JWT persistence to localStorage
- Created TanStack Query hooks for login mutation and user profile query
- Implemented router with createBrowserRouter and three auth guard types (protected, admin, guest)
- Built login page with Card form, error handling, loading state, and full i18n
- Created user layout with 64px top-nav, responsive hamburger menu via Sheet component
- Created admin layout with 240px collapsible dark sidebar, 8 nav items with lucide icons
- Added shared components: LanguageSwitcher (dropdown), LoadingState (skeleton), EmptyState

## Task Commits

Each task was committed atomically:

1. **Task 1: Frontend bootstrap (index.html, main.tsx, App.tsx), i18n, types, auth store, hooks, config** - `e071a0e` (feat)
2. **Task 2: Router with auth guards, login page, layout shells, placeholder pages** - `8d97444` (feat)
3. **Task 3: Verify frontend shell, layouts, i18n, and responsive design** - checkpoint:human-verify (approved)

## Files Created/Modified
- `frontend/index.html` - Vite HTML entry with Google Fonts preconnect
- `frontend/src/main.tsx` - React entry point with createRoot and StrictMode
- `frontend/src/App.tsx` - Root component with QueryClientProvider, RouterProvider, Toaster
- `frontend/src/i18n/index.ts` - i18next initialization with HTTP backend and language detection
- `frontend/src/types/auth.ts` - User, LoginRequest, TokenResponse interfaces
- `frontend/src/types/config.ts` - FeatureFlags and AppConfig interfaces
- `frontend/src/stores/auth-store.ts` - Auth store with useSyncExternalStore and localStorage
- `frontend/src/lib/config.ts` - Feature flags from Vite env vars
- `frontend/src/hooks/use-auth.ts` - useLogin, useMe, useLogout hooks
- `frontend/src/router/index.tsx` - createBrowserRouter with nested routes
- `frontend/src/router/auth-guard.tsx` - ProtectedRoute, AdminRoute, GuestRoute guards
- `frontend/src/components/layouts/auth-layout.tsx` - Centered gradient layout with language switcher
- `frontend/src/components/layouts/user-layout.tsx` - Top-nav layout with responsive hamburger
- `frontend/src/components/layouts/admin-layout.tsx` - Collapsible dark sidebar layout
- `frontend/src/components/shared/language-switcher.tsx` - i18n language toggle dropdown
- `frontend/src/components/shared/loading-state.tsx` - Full-page loading skeleton
- `frontend/src/components/shared/empty-state.tsx` - Empty state with customizable text
- `frontend/src/pages/login.tsx` - Login form with Card, validation, error display
- `frontend/src/pages/user/dashboard.tsx` - Placeholder user dashboard
- `frontend/src/pages/admin/dashboard.tsx` - Placeholder admin dashboard
- `frontend/src/pages/not-found.tsx` - 404 page with home link
- `frontend/public/locales/en-US/*.json` - English translations (auth, common, nav)
- `frontend/public/locales/zh-CN/*.json` - Chinese translations (auth, common, nav)

## Decisions Made
- Used useSyncExternalStore for auth store -- simpler than React Context, no provider needed, direct localStorage sync
- Separated i18n into 3 namespaces (common, auth, nav) for lazy loading and clear domain boundaries
- Admin layout dark sidebar (#1E293B) per UI-SPEC contract, collapses to 64px icon-only mode
- Mobile responsive via Sheet component overlay for both user hamburger menu and admin sidebar

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Known Stubs

- `frontend/src/pages/user/dashboard.tsx` - Placeholder page with EmptyState, will be populated in Phase 2
- `frontend/src/pages/admin/dashboard.tsx` - Placeholder page with EmptyState, will be populated in Phase 2
- `frontend/src/lib/config.ts` - Feature flags read from Vite env vars, backend config integration deferred to plan 05

These stubs are intentional -- they serve as navigation targets for the layout shell and will be replaced with real content in Phase 2. They do not prevent this plan's goal (working frontend shell with login, layouts, i18n, route guards) from being achieved.

## Next Phase Readiness
- Frontend shell complete -- login, layouts, routing, and i18n all functional
- Ready for Plan 05 (integration wiring) to connect frontend config to backend
- Ready for Phase 2 to build actual page content within the layout shells

## Self-Check: PASSED

- All 27 created files verified present on disk
- Commit e071a0e (Task 1) verified in git log
- Commit 8d97444 (Task 2) verified in git log

---
*Phase: 01-foundation-auth-and-design-system*
*Completed: 2026-03-24*
