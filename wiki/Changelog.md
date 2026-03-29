# Changelog

## v1.0.0 — Complete AI Coach Platform (2026-03-29)

### Added
- **Phase 07: Azure Service Integration** — Admin Azure config persistence, real connection testing, dynamic mock/Azure provider switching
- **Phase 08: Voice & Avatar Demo** — Azure Voice Live Agent with Avatar for real-time voice coaching with digital HCP
- **Phase 09: Integration Testing** — Unified AI Foundry config, 7 interaction modes (text/voice/avatar/conference/realtime/content-understanding/model-mode), agent mode runtime, integration tests
- **Phase 10: UI Polish** — 5-color accent theme system with dark/light mode, page transitions, breadcrumbs, grouped admin sidebar, Figma-audited spacing/typography, BeiGene demo seed data
- 921+ backend tests, frontend TypeScript strict compilation
- Live deployment on Azure Container Apps (East Asia region)

### Deployment
- Frontend: https://ai-coach-frontend.mangoforest-104bd67e.eastasia.azurecontainerapps.io
- Backend: https://ai-coach-backend.mangoforest-104bd67e.eastasia.azurecontainerapps.io

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
