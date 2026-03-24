# Roadmap: AI Coach Platform (BeiGene)

## Overview

This roadmap delivers the AI Coach Platform in 6 phases: foundation and architecture first, then F2F text coaching (the core value loop), scoring & assessment enhancements, dashboards & reporting, training material management, and conference presentation module. Each phase builds on the previous one and delivers a coherent, demonstrable capability. Architecture-first principle applies throughout -- pluggable adapters, config-driven features, and shared components are established in Phase 1 and extended by every subsequent phase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation, Auth, and Design System** - Pluggable architecture, authentication, shared UI components, i18n, and responsive app shell
- [ ] **Phase 2: F2F Text Coaching and Scoring** - HCP/scenario configuration, text-based coaching simulation, multi-dimensional scoring, and feedback
- [ ] **Phase 3: Scoring & Assessment** - Real-time coaching suggestions, post-session reports, customizable scoring rubrics
- [ ] **Phase 4: Dashboard & Reporting** - Personal dashboard, group analytics, export (PDF/Excel), training progress tracking
- [ ] **Phase 5: Training Material Management** - Document upload, versioning, retention policies, AI knowledge base integration
- [ ] **Phase 6: Conference Presentation Module** - One-to-many simulation, live transcription, audience Q&A, presentation scoring

## Phase Details

### Phase 1: Foundation, Auth, and Design System
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

### Phase 2: F2F Text Coaching and Scoring
**Goal**: An MR can select a scenario, have a text-based F2F conversation with an AI HCP that behaves according to its profile, and receive a multi-dimensional scored feedback report after the session
**Depends on**: Phase 1
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
- [ ] 02-08-PLAN.md -- Integration wiring: router, admin sidebar, Azure config API, full flow verification

**UI hint**: yes

### Phase 3: Scoring & Assessment
**Goal**: Complete the scoring system with real-time coaching suggestions during sessions, detailed post-session reports with strengths/weaknesses/improvement areas, and admin-customizable scoring criteria/rubrics
**Depends on**: Phase 2
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
- [ ] 03-04-PLAN.md -- Integration wiring: router registration, sidebar nav, seed default rubric, full flow verification

**UI hint**: yes

### Phase 4: Dashboard & Reporting
**Goal**: MRs can track their improvement over time via a personal dashboard, and admins can view organization-level analytics with export capabilities
**Depends on**: Phase 3
**Requirements**: UI-04, UI-06, ANLYT-01, ANLYT-02, ANLYT-03, ANLYT-04, ANLYT-05
**Success Criteria** (what must be TRUE):
  1. User can view a personal dashboard with score overview, recent sessions, and a skill radar chart showing multi-dimensional performance
  2. User can view session history (date, scenario, score, duration) and personal performance trends over time per scoring dimension
  3. Admin can view organization-level analytics including BU comparisons, skill gap heatmaps, and training completion rates
  4. Reports can be exported as PDF/Excel for offline review
  5. All new code has unit tests with >=95% coverage maintained
**Plans**: TBD
**UI hint**: yes

### Phase 5: Training Material Management
**Goal**: Admin can upload, version, and manage training materials (Word/Excel/PDF) organized by product -- materials feed into AI knowledge base for more accurate HCP simulation
**Depends on**: Phase 2
**Requirements**: CONTENT-01, CONTENT-02, CONTENT-03
**Success Criteria** (what must be TRUE):
  1. Admin can upload training documents (Word, Excel, PDF) organized by product via the web UI
  2. Uploaded materials support versioning and archiving -- admin can see version history and restore previous versions
  3. Retention policies enable auto-deletion of expired materials per configurable rules
  4. Uploaded materials are indexed and available to the AI knowledge base for enhanced HCP simulation accuracy
  5. All new code has unit tests with >=95% coverage maintained
**Plans**: TBD
**UI hint**: yes

### Phase 6: Conference Presentation Module
**Goal**: MRs can practice conference presentations to multiple virtual HCP audience members with turn management, live transcription, Q&A, and multi-scenario scoring
**Depends on**: Phase 2
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, COACH-04, COACH-05, COACH-06, COACH-07
**Success Criteria** (what must be TRUE):
  1. User can start a conference presentation session with multiple virtual HCP audience members (one-to-many simulation)
  2. Live transcription displays audio-to-text on screen during the presentation
  3. Virtual HCP audience members ask contextual questions with turn management
  4. Conference presentations are scored using the multi-dimensional scoring system with presentation-specific criteria
  5. All new code has unit tests with >=95% coverage maintained
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 01.1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Auth, and Design System | 5/5 | Complete | - |
| 01.1. UI Figma Alignment | 6/6 | Complete | - |
| 2. F2F Text Coaching and Scoring | 8/8 | Complete | - |
| 3. Scoring & Assessment | 0/4 | Planning complete | - |
| 4. Dashboard & Reporting | 0/TBD | Not started | - |
| 5. Training Material Management | 0/TBD | Not started | - |
| 6. Conference Presentation Module | 0/TBD | Not started | - |
