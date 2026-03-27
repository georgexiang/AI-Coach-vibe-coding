# Roadmap: AI Coach Platform (BeiGene)

## Overview

This roadmap delivers the AI Coach Platform in 6 phases: foundation and architecture first, then F2F text coaching (the core value loop), scoring & assessment enhancements, dashboards & reporting, training material management, and conference presentation module. Each phase builds on the previous one and delivers a coherent, demonstrable capability. Architecture-first principle applies throughout -- pluggable adapters, config-driven features, and shared components are established in Phase 01 and extended by every subsequent phase.

## Phases

**Phase Numbering:**
- Zero-padded phases (01, 02, 03): Planned milestone work
- Decimal phases (01.1, 02.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 01: Foundation, Auth, and Design System** - Pluggable architecture, authentication, shared UI components, i18n, and responsive app shell
- [x] **Phase 02: F2F Text Coaching and Scoring** - HCP/scenario configuration, text-based coaching simulation, multi-dimensional scoring, and feedback
- [x] **Phase 03: Scoring & Assessment** - Real-time coaching suggestions, post-session reports, customizable scoring rubrics
- [x] **Phase 04: Dashboard & Reporting** - Personal dashboard, group analytics, export (PDF/Excel), training progress tracking
- [x] **Phase 05: Training Material Management** - Document upload, versioning, retention policies, AI knowledge base integration
- [x] **Phase 06: Conference Presentation Module** - One-to-many simulation, live transcription, audience Q&A, presentation scoring (completed 2026-03-25)
- [ ] **Phase 07: Azure AI Service Integration & Voice/Avatar** - All 7 Azure AI modes (OpenAI, Speech STT/TTS, Avatar, Content Understanding, Realtime, Voice Live) with config persistence, connection testing, dynamic switching, and real-time voice/avatar coaching
- [ ] **Phase 09: Integration Testing with Real Azure Services** - Validate Azure services end-to-end with real credentials, E2E demo flow tests, smoke test checklist

## Phase Details

### Phase 01: Foundation, Auth, and Design System
**Goal**: A running application with login, responsive layout shell, shared component library, i18n framework, and pluggable architecture for all AI services -- the scaffold everything else builds on
**Depends on**: Nothing (first phase)
**Requirements**: ARCH-01, ARCH-02, ARCH-03, ARCH-04, ARCH-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, UI-01, UI-02, UI-07, PLAT-01, PLAT-02, PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. User can log in with username/password and see a responsive app shell with sidebar navigation -- session persists across browser refresh
  2. Admin and User roles exist -- admin sees admin routes, user does not
  3. All UI text is externalized via react-i18next and the app can switch between zh-CN and en-US
  4. AI service adapters (LLM, STT, TTS, Avatar) use pluggable provider pattern -- a mock provider works end-to-end without any Azure credentials
  5. Feature toggles, Azure service endpoints, voice mode selection, and region configuration are driven by config (not hardcoded) -- changing config changes behavior without code changes
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md -- Backend JWT auth: User model, login/me endpoints, role-based access, seed data
- [x] 01-02-PLAN.md -- Design tokens + UI component library: Figma Make theme adaptation, 17 shadcn/ui components
- [x] 01-03-PLAN.md -- Pluggable AI adapters + config: STT/TTS/Avatar base+mock, ServiceRegistry, feature toggles, config API
- [x] 01-04-PLAN.md -- Frontend shell: React bootstrap, i18n, login page, user/admin layouts, router with auth guards
- [x] 01-05-PLAN.md -- Integration wiring: auto-register adapters, config context, integration tests, full verification

**UI hint**: yes

### Phase 01.1: UI Figma Alignment (INSERTED)

**Goal:** Align existing frontend with 5 Figma Make generated screens -- login polish, full user dashboard, scenario selection page, F2F training session page, and 11 new shared domain components. All pages use i18n, design tokens, and mock data (backend integration deferred to Phase 2).
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Depends on:** Phase 1
**Plans:** 4/6 plans executed

Plans:
- [x] 01.1-01-PLAN.md -- Install Radix deps, 4 new UI base components (ScrollArea, Tabs, Progress, Textarea), i18n namespaces
- [x] 01.1-02-PLAN.md -- Login page polish: SVG logo, card shadow, auth layout gradient/language switcher/copyright
- [x] 01.1-03-PLAN.md -- 11 shared domain components: StatCard, SessionItem, ActionCard, HCPProfileCard, ChatBubble, ChatInput, etc.
- [x] 01.1-04-PLAN.md -- User dashboard page + scenario selection page + route registration
- [x] 01.1-05-PLAN.md -- F2F training session: 3 coach panels + full-screen training page + route registration
- [x] 01.1-06-PLAN.md -- Build validation + visual verification checkpoint

### Phase 02: F2F Text Coaching and Scoring
**Goal**: An MR can select a scenario, have a text-based F2F conversation with an AI HCP that behaves according to its profile, and receive a multi-dimensional scored feedback report after the session
**Depends on**: Phase 01
**Requirements**: HCP-01, HCP-02, HCP-03, HCP-04, HCP-05, COACH-01, COACH-02, COACH-03, COACH-08, COACH-09, SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, UI-03, UI-05, PLAT-03
**Success Criteria** (what must be TRUE):
  1. Admin can create HCP profiles (personality, specialty, objections, communication style) and training scenarios (product, key messages, difficulty, scoring weights) from the web UI
  2. User can browse and select a training scenario, then start a text-based F2F coaching session with the assigned AI HCP
  3. AI HCP responds in character (personality, knowledge, objections) based on its profile -- conversation feels realistic and contextual
  4. During the session, a side panel shows real-time key message delivery checklist and coaching hints
  5. After session completion, user sees a multi-dimensional scoring report with per-dimension scores, strengths/weaknesses with conversation quotes, and actionable improvement suggestions
**Plans**: 8 plans

Plans:
- [x] 02-01-PLAN.md -- Backend data models, Pydantic schemas, Alembic migration, sse-starlette dependency
- [x] 02-02-PLAN.md -- Frontend TypeScript types, i18n namespaces (coach/admin/scoring), Slider component, recharts install
- [x] 02-03-PLAN.md -- Backend HCP profile + scenario CRUD API routers, service layer, seed data
- [x] 02-04-PLAN.md -- Backend session lifecycle + SSE streaming chat + scoring service + enhanced mock adapter
- [x] 02-05-PLAN.md -- Frontend API client modules + TanStack Query hooks + SSE streaming hook
- [x] 02-06-PLAN.md -- Admin pages: HCP profile management, scenario management, Azure config
- [x] 02-07-PLAN.md -- User pages: scenario selection, F2F coaching session with live chat, scoring feedback with radar chart
- [x] 02-08-PLAN.md -- Integration wiring: router, admin sidebar, Azure config API, full flow verification

**UI hint**: yes

### Phase 03: Scoring & Assessment
**Goal**: Complete the scoring system with real-time coaching suggestions during sessions, detailed post-session reports with strengths/weaknesses/improvement areas, and admin-customizable scoring criteria/rubrics
**Depends on**: Phase 02
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04, SCORE-05, COACH-08, COACH-09
**Success Criteria** (what must be TRUE):
  1. During a coaching session, the system provides real-time suggestions and coaching tips in the side panel based on conversation context
  2. After session completion, user sees a detailed post-session report with strengths, weaknesses, conversation quotes, and actionable improvement areas
  3. Admin can configure customizable scoring rubrics -- defining dimensions, weights, and criteria per scenario type
  4. Scoring results are persisted and queryable for historical trend analysis
  5. All new code has unit tests with >=95% coverage maintained
**Plans**: 4 plans

Plans:
- [x] 03-01-PLAN.md -- Backend services: rubric CRUD, scoring rubric integration, SSE suggestion wiring, report/suggestions/history endpoints, tests
- [x] 03-02-PLAN.md -- Frontend data layer: TypeScript types, API clients, TanStack Query hooks for rubrics/reports/history
- [x] 03-03-PLAN.md -- Frontend pages: admin rubric management, enhanced scoring feedback with full report + PDF, session history
- [x] 03-04-PLAN.md -- Integration wiring: router registration, sidebar nav, seed default rubric, full flow verification

**UI hint**: yes

### Phase 04: Dashboard & Reporting
**Goal**: MRs can track their improvement over time via a personal dashboard, and admins can view organization-level analytics with export capabilities
**Depends on**: Phase 03
**Requirements**: UI-04, UI-06, ANLYT-01, ANLYT-02, ANLYT-03, ANLYT-04, ANLYT-05
**Success Criteria** (what must be TRUE):
  1. User can view a personal dashboard with score overview, recent sessions, and a skill radar chart showing multi-dimensional performance
  2. User can view session history (date, scenario, score, duration) and personal performance trends over time per scoring dimension
  3. Admin can view organization-level analytics including BU comparisons, skill gap heatmaps, and training completion rates
  4. Reports can be exported as PDF/Excel for offline review
  5. All new code has unit tests with >=95% coverage maintained
**Plans**: 6 plans

Plans:
- [x] 04-01-PLAN.md -- Backend foundation: Alembic migration (business_unit), analytics schemas, analytics service, export service, recommendation engine
- [x] 04-02-PLAN.md -- Frontend data layer: TypeScript types, API client, TanStack Query hooks, i18n analytics namespace, file-saver install
- [x] 04-03-PLAN.md -- Backend API: analytics router with 7 endpoints, main.py registration, seed data with BU values
- [x] 04-04-PLAN.md -- Frontend user pages: enhanced dashboard with live stats, session history with skill radar, chart components
- [x] 04-05-PLAN.md -- Frontend admin pages: org analytics dashboard, reports page, BU bar chart, skill gap heatmap, route registration, backend tests
- [x] 04-06-PLAN.md -- Gap closure: seed session data, wire reports pages to live data, date range filtering, PDF print export

**UI hint**: yes

### Phase 05: Training Material Management
**Goal**: Admin can upload, version, and manage training materials (Word/Excel/PDF) organized by product -- materials feed into AI knowledge base for more accurate HCP simulation
**Depends on**: Phase 02
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03
**Success Criteria** (what must be TRUE):
  1. Admin can upload training documents (Word, Excel, PDF) organized by product via the web UI
  2. Uploaded materials support versioning and archiving -- admin can see version history and restore previous versions
  3. Retention policies enable auto-deletion of expired materials per configurable rules
  4. Uploaded materials are indexed and available to the AI knowledge base for enhanced HCP simulation accuracy
  5. All new code has unit tests with >=95% coverage maintained
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md -- Backend foundation: ORM models, Pydantic schemas, storage adapter, text extractor, Alembic migration, new dependencies
- [x] 05-02-PLAN.md -- Backend API: material service, REST router, prompt builder RAG integration, comprehensive tests
- [x] 05-03-PLAN.md -- Frontend: TypeScript types, API client, TanStack Query hooks, admin page with drag-and-drop upload, i18n, route registration

**UI hint**: yes

### Phase 06: Conference Presentation Module
**Goal**: MRs can practice conference presentations to multiple virtual HCP audience members with turn management, live transcription, Q&A, and multi-scenario scoring
**Depends on**: Phase 02
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, COACH-04, COACH-05, COACH-06, COACH-07
**Success Criteria** (what must be TRUE):
  1. User can start a conference presentation session with multiple virtual HCP audience members (one-to-many simulation)
  2. Live transcription displays audio-to-text on screen during the presentation
  3. Virtual HCP audience members ask contextual questions with turn management
  4. Conference presentations are scored using the multi-dimensional scoring system with presentation-specific criteria
  5. All new code has unit tests with >=95% coverage maintained
**Plans**: 6 plans

Plans:
- [x] 06-01-PLAN.md -- Backend foundation: ConferenceAudienceHcp model, session/message extensions, Alembic migration, schemas, TurnManager, voice dependency
- [x] 06-02-PLAN.md -- Frontend data layer: TypeScript types, API client, TanStack Query hooks, multi-speaker SSE hook, i18n conference namespace
- [x] 06-03-PLAN.md -- Backend services + API: conference_service, conference router with SSE, prompt builder extension, Azure STT/TTS adapters
- [x] 06-04-PLAN.md -- Frontend components + page: 11 conference components, extended ChatBubble, full-screen conference session page
- [x] 06-05-PLAN.md -- Integration wiring: route registration, navigation, seed data, admin audience config, full-flow verification
- [x] 06-06-PLAN.md -- Comprehensive backend tests: TurnManager, conference service, API integration, STT/TTS adapters, schemas, models (>=95% coverage)

**UI hint**: yes

### Phase 07: Azure AI Service Integration & Voice/Avatar
**Goal**: All 7 Azure AI service modes (OpenAI, Speech STT/TTS, Avatar, Content Understanding, Realtime, Voice Live) with admin config persistence, real connection testing, dynamic provider switching, region-based availability detection, and real-time voice/avatar coaching sessions
**Depends on**: Phase 01
**Requirements**: PLAT-03, ARCH-05, COACH-04, COACH-05, COACH-07, EXT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. Admin can configure all 7 Azure AI service endpoints and API keys via admin UI
  2. API keys are stored encrypted (Fernet) in the database
  3. Connection testing validates Azure service reachability for all 7 modes
  4. Dynamic provider switching allows runtime change from mock to Azure providers
  5. User can start a voice-enabled coaching session that uses Azure Voice Live API for real-time speech interaction
  6. Azure AI Avatar renders a digital human visual for the HCP during voice coaching sessions
  7. Voice interaction is integrated with the existing coaching session lifecycle
  8. The system shows region-based availability for each service (not a fallback chain — user-selectable modes)
  9. All new code has unit tests with >=95% coverage maintained
**Plans**: 8+ plans (8 completed from original 07+08, new plans TBD)

Plans (completed from original Phase 07):
- [x] 07-01-PLAN.md -- Config data foundation: ServiceConfig model, Fernet encryption, config service, schemas, migration
- [x] 07-02-PLAN.md -- Admin config API routes and frontend config page
- [x] 07-03-PLAN.md -- Connection testing and Azure service validation
- [x] 07-04-PLAN.md -- Dynamic provider switching and runtime reconfiguration

Plans (completed from original Phase 08, executed in 08-* directory):
- [x] 08-01-PLAN.md -- Backend foundation: Alembic migration (session mode), voice_live schemas/service, token broker API, connection tester, tests
- [x] 08-02-PLAN.md -- Frontend data layer: TypeScript types, i18n voice namespace, API client, TanStack Query hooks, audio-processor.js, tests
- [x] 08-03-PLAN.md -- Voice hooks + leaf components: useVoiceLive, useAvatarStream, useAudioHandler, 7 voice UI components, component tests
- [x] 08-04-PLAN.md -- Container components + wiring: VoiceSession container, route registration, admin config Voice Live card, transcript flush, tests

Plans (new — remaining work):
- [ ] 07-05-PLAN.md -- TBD (Content Understanding, Realtime, Voice Live Agent/Model adapters, region capabilities, frontend wiring)

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 01 -> 01.1 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 09

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 01. Foundation, Auth, and Design System | 5/5 | Complete | - |
| 01.1. UI Figma Alignment | 6/6 | Complete | - |
| 02. F2F Text Coaching and Scoring | 8/8 | Complete | - |
| 03. Scoring & Assessment | 4/4 | Complete | - |
| 04. Dashboard & Reporting | 6/6 | Complete | - |
| 05. Training Material Management | 3/3 | Complete | - |
| 06. Conference Presentation Module | 6/6 | Complete | 2026-03-25 |
| 07. Azure AI Service Integration & Voice/Avatar | 8/TBD | In Progress | |
| 09. Integration Testing | 0/2 | Not Started | |

### Phase 09: Integration Testing with Real Azure Services

**Goal:** Validate all Azure service integrations end-to-end with real credentials, polish the demo experience for BeiGene customer presentations, and create automated + manual test suites for ongoing validation
**Depends on:** Phase 07
**Requirements**: COACH-04, COACH-05, COACH-07, PLAT-03, PLAT-05, ARCH-05
**Success Criteria** (what must be TRUE):
  1. Pytest integration tests validate each Azure service adapter with real credentials (OpenAI streaming, Speech STT/TTS round-trip, Voice Live token, Avatar config)
  2. All integration tests skip gracefully when Azure credentials are not configured
  3. Playwright E2E test exercises the full demo pipeline: admin config -> text session -> voice session -> scoring report
  4. Performance assertions verify AI response latency < 3 seconds
  5. Fallback chain verified: avatar -> voice-only -> text-only degrades gracefully
  6. Manual smoke test checklist covers all demo categories for pre-demo preparation
**Plans**: 2 plans

Plans:
- [ ] 09-01-PLAN.md -- Backend pytest integration tests: conftest with skip markers, 4 Azure service test modules (OpenAI, Speech, Voice Live, Avatar)
- [ ] 09-02-PLAN.md -- Playwright E2E demo flow test + pre-demo smoke test checklist
