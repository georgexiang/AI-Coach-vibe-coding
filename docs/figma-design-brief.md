# AI Coach Platform — Figma Design Brief

> BeiGene (百济神州) AI Coach Platform for Medical Representative Training
> Target: Web App (responsive — desktop, tablet, mobile, Teams Tab)

---

## Design Direction

- **Style**: Professional medical/pharma SaaS — clean, trustworthy, modern
- **Color scheme**: Blue/white primary (medical professional feel), accent colors for scoring dimensions
- **Typography**: Inter or Noto Sans SC (supports Chinese + European languages)
- **Layout**: Desktop-first responsive, sidebar navigation for admin, top-nav for user
- **i18n ready**: All text in components, no hardcoded strings, RTL-aware spacing
- **Reference**: pdf/images/ (Capgemini reference — mobile-first, adapt to web)

---

## User Roles

| Role | Access | Description |
|------|--------|-------------|
| **MR (User)** | Training pages, history, reports | Medical Representative — does training |
| **Admin** | Full access + configuration | Manages scenarios, HCPs, users, Azure services |

---

## Page Inventory (17 pages)

### A. Common Pages

#### A1. Login Page
- Logo + product name
- Email/password login form
- Language switcher (🌐 CN / EN)
- "Remember me" checkbox
- Clean, centered card layout

#### A2. Layout Shell
- **User layout**: Top navigation bar (logo, nav links, user avatar, language switcher, logout)
- **Admin layout**: Left sidebar navigation + top bar (breadcrumb, user info)
- Responsive: sidebar collapses to hamburger on mobile

---

### B. MR (User) Pages

#### B1. Dashboard / Home
**Purpose**: Training overview and quick actions

Content:
- Welcome message with user name
- Training progress summary cards:
  - Total sessions completed
  - Average score (radar chart mini)
  - Sessions this week
  - Improvement trend (up/down arrow)
- Quick action buttons:
  - "Start F2F Training" (primary CTA)
  - "Start Conference Training"
  - "View Reports"
- Recent sessions list (last 5, with score badge)
- Upcoming/recommended scenarios

#### B2. Scenario Selection
**Purpose**: Choose training scenario before starting

Content:
- Scenario cards in grid layout, each showing:
  - HCP avatar/portrait
  - HCP name, specialty, hospital
  - Personality tags (e.g., "Skeptical", "Detail-oriented")
  - Product/therapeutic area
  - Difficulty level badge
  - "Start Training" button
- Filter bar: Product line, Difficulty, HCP specialty
- Search box
- Tabs: "F2F Training" / "Conference Training"

#### B3. F2F HCP Coaching (Core Page)
**Purpose**: 1-on-1 real-time conversation with digital HCP

Layout (3-column on desktop):
- **Left panel** (collapsible):
  - Scenario briefing card
  - HCP profile summary (name, specialty, personality, background)
  - Key messages checklist (MR should deliver these)
  - Scoring criteria preview
- **Center panel** (main):
  - Chat message area (bubbles — MR on right, HCP on left)
  - HCP avatar display area (placeholder for Azure AI Avatar video)
  - Input area at bottom:
    - Text input field
    - Voice input button (microphone icon, with recording state)
    - Audio/Text toggle switch
    - Send button
  - Real-time transcription display (when using voice)
- **Right panel** (collapsible):
  - Real-time coaching hints (AI suggestions during conversation)
  - Key message delivery tracker (checked off as delivered)
  - Timer (session duration)

Top bar: "End Session" button, session info

Mobile: Single column, panels become expandable drawers

#### B4. Conference Presentation Mode
**Purpose**: 1-to-many presentation training with virtual HCP audience

Layout:
- **Main area**:
  - Presentation content display (slides/content area)
  - Virtual audience panel (multiple HCP avatars with names/specialties)
  - Live transcription overlay (MR's speech → text)
- **Bottom panel**:
  - Audio input controls (microphone, mute)
  - Presentation controls (next slide, previous)
- **Side panel** (collapsible):
  - Audience questions queue (HCPs ask questions in real-time)
  - Objection suggestions (AI-generated typical objections)
  - Response hints
- **Status bar**: Time elapsed, slides progress, audience engagement indicator

#### B5. Scoring & Feedback (Post-Session)
**Purpose**: Multi-dimensional evaluation after training session

Layout:
- **Overall score** header: Large number + grade (A/B/C) + trend vs last session
- **Radar chart**: 5-6 dimensions visualized
  - Key message delivery
  - Objection handling
  - Communication skills
  - Product knowledge
  - Scientific information
  - (Optional) Emotional intelligence
- **Dimension breakdown cards**: For each dimension:
  - Score (number + bar)
  - Strengths (green highlights with specific quotes)
  - Weaknesses (orange highlights with specific quotes)
  - Improvement suggestions (actionable tips)
- **Conversation replay**: Annotated transcript with scoring markers
- **Action buttons**: "Try Again", "Share with DM", "Export PDF", "Back to Dashboard"

#### B6. Session History
**Purpose**: Review past training sessions

Content:
- Table/list view with columns:
  - Date & time
  - Scenario name + HCP name
  - Mode (F2F / Conference)
  - Overall score + dimension mini-bars
  - Duration
  - Actions: View details, Replay
- Filters: Date range, Mode, Score range, Product
- Sort by: Date, Score, Duration
- Pagination

#### B7. Personal Reports
**Purpose**: MR's personal training analytics

Content:
- Time period selector (week/month/quarter/year)
- Score trend line chart (over time)
- Dimension comparison radar chart (current vs previous period)
- Training frequency bar chart
- Strengths & weaknesses summary
- Recommended focus areas
- Export buttons: PDF, Excel

---

### C. Admin Pages

#### C1. Admin Dashboard
**Purpose**: Organization-wide training overview

Content:
- Summary stats cards:
  - Total MRs trained
  - Average organization score
  - Active sessions right now
  - Completion rate
- Score distribution chart (histogram)
- Top performers list
- MRs needing attention (low scores)
- Training activity heatmap (by week/day)
- BU/region filter

#### C2. User Management
**Purpose**: Manage MR accounts and roles

Content:
- User table: Name, Email, Role (MR/DM/Admin), BU, Region, Last active, Status
- Actions: Add user, Edit, Deactivate, Reset password
- Bulk import (CSV upload)
- Role assignment
- Filter by: BU, Region, Role, Status

#### C3. HCP Configuration
**Purpose**: Configure virtual HCP profiles

Content:
- HCP profile list (cards or table)
- HCP profile editor form:
  - **Portrait section**: Avatar image upload/selection
  - **Identity**: Name, specialty, hospital, title
  - **Personality settings**:
    - Personality type (dropdown: Skeptical, Friendly, Busy, Detail-oriented, etc.)
    - Emotional state slider (Neutral ↔ Resistant)
    - Communication style (Direct ↔ Indirect)
  - **Knowledge background**:
    - Medical expertise areas (multi-select tags)
    - Current prescribing habits (text)
    - Concerns and perspectives (text)
  - **Interaction rules**:
    - Typical objections (editable list)
    - Key topics to probe (editable list)
    - Difficulty level (Easy/Medium/Hard)
- Preview button: Quick chat test with configured HCP

#### C4. Scenario Management
**Purpose**: Create and manage training scenarios

Content:
- Scenario list with status (Active/Draft/Archived)
- Scenario editor:
  - Name, description
  - Associated product/therapeutic area
  - Assigned HCP profile (select from configured HCPs)
  - Training mode: F2F / Conference / Both
  - Key messages MR should deliver (editable checklist)
  - Scoring criteria configuration:
    - Weight per dimension (sliders, total = 100%)
    - Pass threshold
  - Conference-specific: Slide content upload, audience size
  - Tags/categories
- Clone scenario button
- Assign to MR groups

#### C5. Training Material Management
**Purpose**: Upload and manage training documents

Content:
- File browser / document list:
  - Name, type (PDF/Word/Excel), size, uploaded date, uploaded by
  - Version history (expandable)
- Upload area (drag & drop)
- Folder organization (by product, by therapeutic area)
- Document preview panel
- Retention policy settings
- Bulk actions: Archive, Delete, Move

#### C6. Organization Reports & Analytics
**Purpose**: Organization-wide training analytics

Content:
- Filters: BU, Region, Product, Time period
- Group performance comparison (bar charts by BU/region)
- Score trends across organization
- Training completion rates
- Skill gap analysis (which dimensions are weak org-wide)
- Individual MR drill-down
- Export: PDF report, Excel data dump

#### C7. Azure Service Configuration
**Purpose**: Configure Azure PaaS service connections

Content:
- **Service cards** (each expandable):
  - **Azure OpenAI**:
    - Endpoint URL, API Key, Deployment name
    - Model selection (GPT-4o, GPT-4o-mini)
    - Temperature, max tokens defaults
    - Connection test button (✓/✗ status)
  - **Azure OpenAI Realtime**:
    - Endpoint, API Key, Deployment name
    - Realtime model configuration
    - WebSocket endpoint
    - Connection test
  - **Azure Speech Services**:
    - Region, Subscription key
    - STT language config (zh-CN, en-US, etc.)
    - TTS voice selection (with preview play button)
    - Connection test
  - **Azure AI Avatar**:
    - Endpoint, API Key
    - Avatar style selection (with preview thumbnails)
    - Video quality settings
    - Connection test
  - **Azure Content Understanding**:
    - Endpoint, API Key
    - Analysis features toggle (document, image, video)
    - Connection test
  - **Database (PostgreSQL)**:
    - Connection string (masked)
    - Connection pool settings
    - Health check status
- Global settings: Default timeout, retry policy
- "Test All Connections" button at top

#### C8. System Settings
**Purpose**: Global platform configuration

Content:
- **Language settings**:
  - Default language
  - Available languages list (enable/disable)
  - Translation management (key-value pairs or file upload)
- **Data retention**:
  - Voice record retention period (days)
  - Session data retention
  - Auto-archive settings
- **Notification settings**:
  - Email templates
  - Training reminders
- **Branding**:
  - Logo upload
  - Platform name
  - Theme colors

---

## Shared Components Needed

| Component | Usage | Notes |
|-----------|-------|-------|
| **ScoreCard** | Dashboard, Reports | Number + label + trend arrow |
| **RadarChart** | Scoring, Reports | 5-6 dimension radar |
| **ChatBubble** | F2F Coaching | Left (HCP) / Right (MR), supports text + audio indicator |
| **HCPProfileCard** | Scenario selection, Config | Avatar + name + specialty + tags |
| **AudioControls** | F2F, Conference | Mic button with recording state, waveform |
| **DimensionBar** | Scoring detail | Score bar with label + color coding |
| **DataTable** | History, Users, Materials | Sortable, filterable, paginated |
| **ServiceConfigCard** | Azure config | Expandable card with form + test button |
| **FormField** | All forms | Input/Select/Slider/Toggle with label + validation |
| **LanguageSwitcher** | Layout shell | Dropdown with flag icons |
| **StatusBadge** | Throughout | Active/Inactive/Draft/Error states |
| **BreadcrumbNav** | Admin pages | Path navigation |
| **EmptyState** | Lists, tables | Illustration + message when no data |
| **LoadingState** | API calls | Skeleton screens / spinners |

---

## Key Interactions to Prototype

1. **F2F Training Flow**: Scenario selection → Briefing → Chat/Voice conversation → End session → Scoring
2. **Voice input**: Tap mic → Recording animation → Transcription appears → HCP responds
3. **Avatar toggle**: Switch between text-only chat and avatar video mode
4. **Admin HCP config**: Create HCP → Set personality sliders → Test chat → Save
5. **Azure service setup**: Enter credentials → Test connection → Status indicator

---

## Responsive Breakpoints

| Breakpoint | Layout |
|------------|--------|
| Desktop (≥1280px) | Full layout, multi-column panels |
| Tablet (768-1279px) | Collapsible sidebars, 2-column where possible |
| Mobile (≤767px) | Single column, bottom sheet for panels, drawer navigation |

---

## File Structure for Figma

Suggested Figma page organization:
```
📄 Cover
📄 Design System (Colors, Typography, Components)
📄 A. Common (Login, Layout Shell)
📄 B. User Pages (Dashboard, Scenarios, F2F, Conference, Scoring, History, Reports)
📄 C. Admin Pages (Dashboard, Users, HCPs, Scenarios, Materials, Reports, Azure Config, Settings)
📄 D. Mobile Adaptations
📄 E. Interaction Flows
```

---

*Generated: 2026-03-24 | Project: AI Coach Platform for BeiGene*
