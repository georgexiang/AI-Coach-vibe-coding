# Changelog

## v0.2.0 — Core Training Module (2026-03-24)

### Added
- Auth system: JWT login, user roles (Admin, MR), token refresh
- Database models: User, HCPProfile, Scenario, CoachingSession, SessionMessage, SessionScore, ScoreDetail
- API routers: auth, hcp-profiles, scenarios, sessions, scoring, config, azure-config
- Pydantic v2 schemas for all API endpoints
- Service layer: auth, hcp-profile, scenario, session, scoring services
- AI coaching adapter framework: BaseCoachingAdapter + Mock adapter
- HCP Profile CRUD with admin controls
- Scenario management with scoring weights and key messages
- Session lifecycle: create → in_progress → completed → scored
- Multi-dimensional scoring with breakdown details
- 269 backend test cases across 25 test files
- 13 Playwright E2E tests
- 114 React components (shared UI + coach components)
- Frontend pages: login, dashboard, training, scenarios, profiles
- TanStack Query hooks for all API domains
- i18n support (en-US language switcher)
- README.md with project overview and setup guide

### Fixed
- bcrypt version pinned to <4.1 for passlib 1.7.4 compatibility
- Wiki sync workflow: graceful handling when wiki not initialized

## v0.1.0 — Project Foundation (2026-03-24)

### Added
- Project structure with backend (FastAPI) + frontend (React + Vite + Tailwind)
- CI/CD pipeline (ci.yml) with backend tests, frontend checks, E2E tests, Azure deployment
- Wiki auto-sync workflow
- GitHub Project sync workflow
- CLAUDE.md engineering handbook
- Requirements extraction from solution document
- Best practices document from reference projects
- Docker multi-stage builds + docker-compose
- Testing infrastructure (pytest + Playwright)
- UI prototype screenshots preserved for design reference
