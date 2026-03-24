# Roadmap: AI Coach Platform (BeiGene)

## Overview

This roadmap delivers the AI Coach Platform in 4 phases following the critical path: foundation and architecture first, then F2F text coaching with scoring (the core value loop), then voice/avatar/conference extensions, and finally dashboards and analytics. Each phase builds on the previous one and delivers a coherent, demonstrable capability. Architecture-first principle applies throughout -- pluggable adapters, config-driven features, and shared components are established in Phase 1 and extended by every subsequent phase.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation, Auth, and Design System** - Pluggable architecture, authentication, shared UI components, i18n, and responsive app shell
- [ ] **Phase 2: F2F Text Coaching and Scoring** - HCP/scenario configuration, text-based coaching simulation, multi-dimensional scoring, and feedback
- [ ] **Phase 3: Voice, Avatar, and Conference Mode** - Voice interaction (STT/TTS/Realtime), AI Avatar, conference presentation mode, and content management
- [ ] **Phase 4: Dashboards, Analytics, and Reports** - MR dashboard, session history, performance trends, org analytics, and training recommendations

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
- [ ] 01-01-PLAN.md -- Backend JWT auth: User model, login/me endpoints, role-based access, seed data
- [ ] 01-02-PLAN.md -- Design tokens + UI component library: Figma Make theme adaptation, 17 shadcn/ui components
- [ ] 01-03-PLAN.md -- Pluggable AI adapters + config: STT/TTS/Avatar base+mock, ServiceRegistry, feature toggles, config API
- [ ] 01-04-PLAN.md -- Frontend shell: React bootstrap, i18n, login page, user/admin layouts, router with auth guards
- [ ] 01-05-PLAN.md -- Integration wiring: auto-register adapters, config context, integration tests, full verification

**UI hint**: yes

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
**Plans**: TBD
**UI hint**: yes

### Phase 3: Voice, Avatar, and Conference Mode
**Goal**: F2F coaching supports voice interaction (STT input, TTS output) with optional AI Avatar visual, and a conference presentation mode allows MRs to present to multiple virtual HCPs
**Depends on**: Phase 2
**Requirements**: COACH-04, COACH-05, COACH-06, COACH-07, CONTENT-01, CONTENT-02, CONTENT-03, CONF-01, CONF-02, CONF-03, CONF-04
**Success Criteria** (what must be TRUE):
  1. User can speak into the microphone during F2F coaching and the system recognizes speech (Azure STT) and sends it as text to the AI HCP -- works in both Chinese and English
  2. AI HCP responses are spoken aloud via Azure TTS with natural-sounding voices -- GPT Realtime API is available as a configurable premium option for sub-1s latency
  3. When AI Avatar is enabled and available, a digital human visual renders for the HCP -- when disabled or unavailable, the system falls back gracefully to TTS-only
  4. User can start a conference presentation session with multiple virtual HCP audience members who ask questions with turn management, and the session is scored using the same multi-dimensional system
  5. Admin can upload training materials (PDF, Word, Excel) organized by product -- uploaded materials feed into the AI knowledge base for more accurate HCP simulation
**Plans**: TBD
**UI hint**: yes

### Phase 4: Dashboards, Analytics, and Reports
**Goal**: MRs can track their improvement over time via a personal dashboard, and admins can view organization-level analytics -- the system recommends next training scenarios based on performance
**Depends on**: Phase 3
**Requirements**: UI-04, UI-06, ANLYT-01, ANLYT-02, ANLYT-03, ANLYT-04, ANLYT-05
**Success Criteria** (what must be TRUE):
  1. User can view a personal dashboard with score overview, recent sessions, and a skill radar chart showing multi-dimensional performance
  2. User can view session history (date, scenario, score, duration) and personal performance trends over time per scoring dimension
  3. Admin can view organization-level analytics including BU comparisons, skill gap heatmaps, and training completion rates
  4. System recommends next training scenarios based on the user's scoring history and identified weaknesses
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation, Auth, and Design System | 0/5 | Planning complete | - |
| 2. F2F Text Coaching and Scoring | 0/TBD | Not started | - |
| 3. Voice, Avatar, and Conference Mode | 0/TBD | Not started | - |
| 4. Dashboards, Analytics, and Reports | 0/TBD | Not started | - |
