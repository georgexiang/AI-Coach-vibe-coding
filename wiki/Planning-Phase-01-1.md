# Phase 01.1: Ui Figma Figma Make Ui Sceenshot Figma Make

> Auto-generated from [`.planning/phases/01.1-ui-figma-figma-make-ui-sceenshot-figma-make`](../blob/main/.planning/phases/01.1-ui-figma-figma-make-ui-sceenshot-figma-make)  
> Last synced: 2026-04-02

## Plans (6)

| # | Plan File | Status |
|---|-----------|--------|
| 01.1-01 | 01.1-01-PLAN.md | Complete |
| 01.1-02 | 01.1-02-PLAN.md | Complete |
| 01.1-03 | 01.1-03-PLAN.md | Complete |
| 01.1-04 | 01.1-04-PLAN.md | Complete |
| 01.1-05 | 01.1-05-PLAN.md | Complete |
| 01.1-06 | 01.1-06-PLAN.md | Complete |

## Research

<details><summary>Click to expand research notes</summary>

# Phase 01.1: UI Figma Alignment - Research

**Researched:** 2026-03-24
**Domain:** Frontend UI alignment with Figma Make generated code and screenshots
**Confidence:** HIGH

## Summary

This phase bridges the gap between the existing Phase 1 frontend (functional but using placeholder UI) and the Figma designs represented by 5 Figma Make generated code packages plus their screenshot targets. The existing frontend has a solid foundation: JWT auth, i18n, layouts, design tokens, and 17 shadcn/ui base components. However, the current pages (login, user dashboard, admin dashboard) are minimal placeholder implementations showing EmptyState components instead of the rich, data-driven UIs shown in the Figma designs.

The Figma Make code provides complete, self-contained React implementations for each screen -- these serve as visual and structural references but must NOT be copied verbatim. They use different routing (`react-router` vs `react-router-dom`), lack i18n, lack real auth integration, and use hardcoded mock data instead of TanStack Query hooks. The implementation strategy is: extract visual patterns and component structures from figma-make, adapt them to the existing project conventions (i18n, auth store, design tokens, barrel exports, path aliases), and fill in the placeholder pages with Figma-matching content.

**Primary recommendation:** Treat figma-make code as a visual reference library. For each of the 5 screens, adapt the component structure and Tailwind classes into the existing project's patterns -- using the project's design tokens, i18n keys, auth store, and UI component library.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-01 | Shared component library based on Figma "Design System for SaaS" | Design System figma-make contains 16+ domain components (ScoreCard, HCPProfileCard, ChatBubble, etc.) that should be added to `frontend/src/components/shared/` |
| UI-02 | Login page and app layout shell from Figma "Design Login and Layout Shell" | Login page exists but needs visual polish to match screenshot; layouts exist and closely match figma already |
| UI-03 | F2F HCP Training page from Figma design | New 3-panel page (LeftPanel, CenterPanel, RightPanel) -- needs new route, page component, and sub-components |
| UI-04 | MR Dashboard from Figma design | Replace current EmptyState user dashboard with StatCards, SessionItems, ActionCards per Figma screenshot |
| UI-05 | Scenario Selection page from Figma design | New page at `/user/training` showing HCP scenario cards with filters |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

### Coding Standards Affecting This Phase
- **TypeScript `strict: true`** -- no `any` types, no unused variables
- **TanStack Query hooks** per domain, no inline `useQuery` in components
- **Path alias `@/`** for all imports from `src/`
- **Barrel exports** for component directories (`index.ts`)
- **`cn()` utility** for conditional class composition
- **No Redux** -- TanStack Query for server state, lightweight store for auth
- **react-i18next** for all user-facing text -- must support zh-CN and en-US
- **Conventional commits** encouraged
- **Pre-commit checks**: `npx tsc -b` and `npm run build` must pass

### Design Token System (Already Established)
- Tailwind CSS v4 with `@theme inline` pattern
- Colors: `--primary: #1E40AF`, `--strength`, `--weakness`, `--improvement`, chart colors 1-5
- Sidebar: `--sidebar: #1E293B` with dark theme
- Fonts: Inter + Noto Sans SC + JetBrains Mono
- Radius: sm/md/lg/xl based on `--radius: 0.625rem`

## Screen-by-Screen Gap Analysis

### Screen 1: Login Page
**Figma target:** Centered card with gradient background, AI Coach logo (blue rounded square with lightbulb icon), email/password fields, remember me checkbox, sign-in button, copyright footer, language switcher in top-right corner.

**Current state:** Login page exists at `frontend/src/pages/login.tsx`. Uses Card component, has email/password/remember-me/sign-in. Uses i18n correctly, integrates with real auth via `useLogin()` mutation.

**Gaps:**
| Gap | Figma Shows | Current Has | Fix |
|-----|------------|-------------|-----|
| Logo icon | Blue gradient square with lightbulb SVG | Plain "AI" text in primary square | Replace with matching SVG icon |
| Background | `bg-gradient-to-br from-blue-50 via-white to-blue-50` | AuthLayout has `from-blue-50 to-white` | Add `via-white` to gradient |
| Language switcher position | Fixed top-right with flag emoji | Bottom-right Globe icon dropdown | Move LanguageSwitcher to top-right in AuthLayout |
| Card shadow | `shadow-xl rounded-2xl` | Default Card styling | Add shadow and rounding classes |
| Copyright | Fixed bottom center | Inside form at bottom | Move to AuthLayout footer |

**Assessment:** Minor visual adjustments. Structural match is good. Keep existing auth integration.

### Screen 2: Design System for SaaS (Component Library)
**Figma target:** Showcase page demonstrating all domain-specific components -- ScoreCard, HCPProfileCard, ServiceConfigCard, RadarChart, DimensionBar, DataTable, StatusBadge, FormField, ChatBubble, ChatInput, EmptyState, LoadingState, AudioControls, LanguageSwitcher, AdminSidebar, TopNav.

**Current state:** Only EmptyState, LanguageSwitcher, and LoadingState exist in `frontend/src/components/shared/`. Base shadcn/ui components (17) exist in `frontend/src/components/ui/`.

**New components needed for frontend/src/components/shared/:**
1. `score-card.tsx` -- Score display with trend and sparkline
2. `hcp-profile-card.tsx` -- HCP avatar, specialty, difficulty badge, personality tags
3. `session-item.tsx` -- Training session row with avatar, score, time
4. `stat-card.tsx` -- Dashboard stat with icon, value, trend, progress bar
5. `action-card.tsx` -- Gradient start-training card
6. `recommended-scenario.tsx` -- Recommended practice scenario
7. `chat-bubble.tsx` -- Left/right aligned chat message
8. `chat-input.tsx` -- Message input with voice and send buttons
9. `dimension-bar.tsx` -- Score bar with label and percentage
10. `status-badge.tsx` -- Colored status indicator (Active/Draft/Error/Pending)
11. `mini-charts.tsx` -- SVG mini radar and trend charts

**Components needed later (Phase 2+, not this phase):**
- RadarChart (requires recharts -- needed for scoring/dashboard in Phase 2/4)
- DataTable (complex -- belongs in Phase 2 admin pages)
- ServiceConfigCard (Phase 2 admin config)
- AudioControls (Phase 3 voice features)
- FormField (Phase 2 admin forms)

### Screen 3: F2F HCP Training Page
**Figma target:** Full-screen 3-panel layout: Left panel (280px, scenario briefing + HCP profile + key messages + scoring criteria), Center panel (flexible, avatar display area + chat messages + input area with text/audio toggle), Right panel (260px, AI coach hints + message tracker + session stats). Top bar with timer and End Session button.

**Current state:** No training page exists. Route placeholder comment in router: `// Phase 2+: training, history, reports`.

**New files needed:**
- `frontend/src/pages/user/training-session.tsx` -- Main 3-panel page
- `frontend/src/components/coach/left-panel.tsx` -- Scenario/HCP info
- `frontend/src/components/coach/center-panel.tsx` -- Chat + avatar area
- `frontend/src/components/coach/right-panel.tsx` -- Coaching hints/stats

**Route:** `/user/training/session` or `/user/training/:sessionId` (the training list page is Scenario Selection, the session page is this)

**Key structural decisions:**
- This is a full-screen layout (not inside the standard UserLayout with nav bar) per Figma -- it has its own top bar with timer
- Collapsible left/right panels with chevron toggles
- Input mode toggle (Text/Audio) at bottom
- Avatar area with toggle switch

### Screen 4: Medical Representative Dashboard
**Figma target:** User dashboard with top nav, 4 stat cards in a row (Sessions Completed, Average Score, This Week, Improvement), left section with Recent Training Sessions (5 items with avatar, name, specialty, mode badge, score, time), right section with Start Training cards (F2F HCP Training gradient blue, Conference Training gradient purple) and Recommended Scenario.

**Current state:** Exists at `frontend/src/pages/user/dashboard.tsx` but just shows a Card with EmptyState.

**Fix:** Replace EmptyState content with the full dashboard layout using mock data. Components needed: StatCard, SessionItem, ActionCard, RecommendedScenario, MiniCharts.

### Screen 5: Scenario Selection Page
**Figma target:** Page titled "Select Training Scenario" with tab navigation (F2F Training / Conference Training), filter row (All Products, All Difficulties, All Specialties dropdowns + Search input), then a 3-column grid of HCP scenario cards showing avatar photo, doctor name (Chinese), specialty badge, hospital, personality tags, product, difficulty badge, and "Start Training" button.

**Current state:** No scenario selection page exists. The route `/user/training` is not yet registered.

**New files needed:**
- `frontend/src/pages/user/training.tsx` -- Scenario selection page

**Components reused:** HCPProfileCard (from shared components), Badge, Select, Input, Tabs

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | ^18.3.0 | UI library | Already in project |
| React Router DOM | ^7.0.0 | Routing | Already in project |
| Tailwind CSS | ^4.0.0 | Styling | Already in project |
| TanStack Query | ^5.60.0 | Server state | Already in project |
| Lucide React | ^0.460.0 | Icons | Already in project |
| react-i18next | ^16.6.2 | i18n | Already in project |

### New Dependencies Needed
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @radix-ui/react-scroll-area | ^1.2.10 | Scrollable areas in F2F chat | F2F Training page center panel |
| @radix-ui/react-tabs | ^1.1.13 | Tab navigation | Scenario Selection page, Design System showcase |
| @radix-ui/react-progress | ^1.1.8 | Progress bars | StatCard progress indicator on dashboard |
| recharts | ^3.8.0 | Radar/trend charts | RadarChart component (deferred to Phase 2/4 -- only MiniCharts SVG needed now) |

**Note:** recharts is used in the figma-make RadarChart component but is NOT needed for Phase 01.1. The dashboard uses simple SVG MiniCharts (no recharts dependency). Recharts should be added in Phase 2 or Phase 4 when actual scoring/analytics pages are built.

**Installation (Phase 01.1 only):**
```bash
cd frontend
npm install @radix-ui/react-scroll-area @radix-ui/react-tabs @radix-ui/react-progress
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts for mini charts | SVG inline (figma-make pattern) | SVG is lighter, sufficient for mini indicators |
| New ScrollArea component | Native CSS overflow-y-auto | ScrollArea gives styled scrollbar matching design system |

## Architecture Patterns

### Recommended Project Structure (Additions)
```
frontend/src/
├── components/
│   ├── shared/              # Existing + new domain components
│   │   ├── empty-state.tsx       # Existing
│   │   ├── language-switcher.tsx # Existing
│   │   ├── loading-state.tsx     # Existing
│   │   ├── score-card.tsx        # NEW: Score display with trend
│   │   ├── hcp-profile-card.tsx  # NEW: HCP scenario card
│   │   ├── session-item.tsx      # NEW: Training session row
│   │   ├── stat-card.tsx         # NEW: Dashboard stat card
│   │   ├── action-card.tsx       # NEW: Start training CTA
│   │   ├── recommended-scenario.tsx # NEW: Recommended practice
│   │   ├── chat-bubble.tsx       # NEW: Chat message bubble
│   │   ├── chat-input.tsx        # NEW: Chat input + voice
│   │   ├── dimension-bar.tsx     # NEW: Score dimension bar
│   │   ├── status-badge.tsx      # NEW: Status indicator
│   │   └── mini-charts.tsx       # NEW: SVG mini visualizations
│   ├── coach/               # NEW: F2F training session components
│   │   ├── left-panel.tsx        # Scenario/HCP info panel
│   │   ├── center-panel.tsx      # Chat + avatar area
│   │   └── right-panel.tsx       # Coaching hints panel
│   └── ui/                  # Existing shadcn/ui base components
│       ├── scroll-area.tsx       # NEW: Radix ScrollArea
│       ├── tabs.tsx              # NEW: Radix Tabs
│       ├── progress.tsx          # NEW: Radix Progress
│       ├── textarea.tsx          # NEW: Textarea (needed for chat)
│       └── ... (existing 17 components)
├── pages/
│   ├── login.tsx                 # UPDATE: Visual polish
│   ├── user/
│   │   ├── dashboard.tsx         # UPDATE: Full Figma dashboard
│   │   ├── training.tsx          # NEW: Scenario selection page
│   │   └── training-session.tsx  # NEW: F2F training session page
│   └── admin/
│       └── dashboard.tsx         # UPDATE: Placeholder for now
```

### Pattern 1: Figma-to-Project Adaptation
**What:** Take figma-make component code as visual reference, rewrite using project conventions.
**When to use:** Every component from figma-make.
**Example:**

Figma-make uses:
```tsx
// figma-make pattern (DO NOT COPY)
import { Card } from './ui/card';
<div className="text-3xl font-bold text-gray-900">{value}</div>
```

Project adaptation:
```tsx
// Project pattern (USE THIS)
import { Card, CardContent } from "@/components/ui";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

<div className={cn("text-3xl font-bold text-foreground")}>{value}</div>
```

Key differences to enforce:
1. Imports use `@/` path alias, not relative paths
2. Use design token colors (`text-foreground`) not Tailwind raw colors (`text-gray-900`) where tokens exist
3. All user-visible text through `useTranslation()` hooks
4. Component files use kebab-case naming
5. Use `cn()` for conditional classes

### Pattern 2: Mock Data for UI-Only Phase
**What:** Use static mock data objects inside page components for display purposes.
**When to use:** This phase is UI-only -- no backend API calls for dashboard/scenario data.
**Example:**
```tsx
// Mock data at top of page component
const mockSessions = [
  { id: "1", hcpName: "Dr. Sarah Mitchell", specialty: "Cardiology", mode: "F2F" as const, score: 85, timeAgo: "2 hours ago" },
  // ...
];

// Render with mock data (will be replaced by TanStack Query hooks in Phase 2)
{mockSessions.map((session) => (
  <SessionItem key={session.id} {...session} />
))}
```

### Pattern 3: Route Registration
**What:** Add new routes to the existing router following established patterns.
**When to use:** Adding training and training-session routes.
**Example:**
```tsx
// In frontend/src/router/index.tsx
{
  path: "/user",
  element: <UserLayout />,
  children: [
    { path: "dashboard", element: <UserDashboard /> },
    { path: "training", element: <ScenarioSelection /> },
    { path: "training/session", element: <TrainingSession /> },
  ],
},
```

Note: TrainingSession page may use its own full-screen layout (no UserLayout wrapper) since the Figma shows it as a standalone 3-panel screen without the standard top nav. This should be a separate route at the ProtectedRoute level, not nested under UserLayout.

### Anti-Patterns to Avoid
- **Copying figma-make code verbatim:** The generated code uses different routing lib, no i18n, hardcoded text, different import paths
- **Using raw Tailwind colors instead of design tokens:** Use `text-primary` not `text-blue-600`, `bg-destructive` not `bg-red-500`
- **Adding recharts dependency for mini charts:** Use inline SVG per figma-make MiniCharts pattern -- recharts is overkill for this phase
- **Skipping i18n for "temporary" mock data:** Even mock data labels should use i18n keys -- this prevents technical debt
- **Creating components in figma-make structure:** Components go in `frontend/src/components/shared/` or `frontend/src/components/coach/`, NOT in `src/app/components/`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scrollable areas | CSS overflow with custom scrollbar | @radix-ui/react-scroll-area | Consistent cross-browser scrollbar styling |
| Tab navigation | Custom tab state management | @radix-ui/react-tabs | Accessible, keyboard-navigable tabs |
| Progress bars | Custom div-based progress | @radix-ui/react-progress | Accessible with aria-valuenow |
| Dropdown filters | Custom select elements | Existing @radix-ui/react-select | Already installed, matches design system |
| Chat message alignment | Complex flexbox logic | figma-make ChatBubble pattern | The figma-make pattern with cn() is clean and correct |

## Common Pitfalls

### Pitfall 1: Figma-Make Import Path Mismatch
**What goes wrong:** Copying figma-make code that uses `import { Card } from './ui/card'` instead of `import { Card } from '@/components/ui'`.
**Why it happens:** Figma Make generates standalone projects with different directory structure.
**How to avoid:** Every import must be rewritten to use `@/` alias and the project's barrel exports.
**Warning signs:** Build fails with "Module not found" errors.

### Pitfall 2: Missing i18n for User-Facing Text
**What goes wrong:** Hardcoded English text from figma-make code lands in the final components.
**Why it happens:** Figma Make code has no i18n -- all text is inline strings.
**How to avoid:** Create new i18n namespace `dashboard.json` and `training.json` for new page strings. Add both en-US and zh-CN translations.
**Warning signs:** Text not updating when language is switched.

### Pitfall 3: Design Token vs Raw Color Inconsistency
**What goes wrong:** Some components use `text-gray-900` while others use `text-foreground`, creating inconsistent dark mode behavior.
**Why it happens:** Figma-make code mixes raw Tailwind colors with design token references inconsistently.
**How to avoid:** Map figma-make colors to design tokens: `text-gray-900` -> `text-foreground`, `bg-blue-600` -> `bg-primary`, `text-gray-600` -> `text-muted-foreground`, `bg-green-600` -> `text-strength`.
**Warning signs:** Colors look wrong in dark mode (if ever enabled).

### Pitfall 4: Training Session Layout Conflict
**What goes wrong:** F2F Training session page renders inside UserLayout, getting double navigation bars.
**Why it happens:** The training session page is a full-screen 3-panel layout that should NOT be inside UserLayout.
**How to avoid:** Register the training session route at the ProtectedRoute level, not as a child of UserLayout.
**Warning signs:** Squished layout, nav bar visible during training session.

### Pitfall 5: TypeScript Strict Mode Failures
**What goes wrong:** Figma-make code uses implicit types, `any` patterns, and nullable access without checks.
**Why it happens:** Figma Make generates code targeting a relaxed TypeScript config.
**How to avoid:** Add explicit interfaces for all props. Use optional chaining. The project has `noUncheckedIndexedAccess: true` which catches array index access issues.
**Warning signs:** `tsc -b` fails with type errors.

### Pitfall 6: New Radix Components Missing from Barrel Export
**What goes wrong:** New UI components (ScrollArea, Tabs, Progress, Textarea) are created but not exported from `@/components/ui/index.ts`.
**Why it happens:** Forgetting to update the barrel export file.
**How to avoid:** After creating each new UI component file, immediately add it to `frontend/src/components/ui/index.ts`.
**Warning signs:** Import errors when using `import { Tabs } from '@/components/ui'`.

## Code Examples

### Adapting Figma-Make StatCard to Project Pattern
```tsx
// frontend/src/components/shared/stat-card.tsx
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: { value: string; direction: "up" | "down" };
  chart?: React.ReactNode;
  progress?: { current: number; total: number };
}

export function StatCard({ label, value, icon: Icon, trend, chart, progress }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          {Icon && (
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-5 text-primary" />
            </div>
          )}
          {chart}
        </div>
        <div className="text-3xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {trend && (
          <div className={cn("mt-3 flex items-center gap-1 text-sm font-medium",
            trend.direction === "up" ? "text-strength" : "text-destructive"
          )}>
            {trend.value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### New i18n Namespace Structure
```json
// frontend/public/locales/en-US/dashboard.json
{
  "welcome": "Welcome back, {{name}}!",
  "overview": "Here's your training overview",
  "sessionsCompleted": "Sessions Completed",
  "averageScore": "Average Score",
  "thisWeek": "This Week",
  "improvement": "Improvement",
  "recentSessions": "Recent Training Sessions",
  "viewAll": "View All",
  "startTraining": "Start Training",
  "f2fTraining": "F2F HCP Training",
  "f2fDescription": "Practice 1-on-1 with digital HCP",
  "conferenceTraining": "Conference Training",
  "conferenceDescription": "Practice department presentation",
  "recommendedScenario": "Recommended Scenario",
  "start": "Start"
}
```

### Route Registration Pattern
```tsx
// Addition to frontend/src/router/index.tsx
import ScenarioSelection from "@/pages/user/training";
import TrainingSession from "@/pages/user/training-session";

// Inside ProtectedRoute children:
{
  path: "/user",
  element: <UserLayout />,
  children: [
    { path: "dashboard", element: <UserDashboard /> },
    { path: "training", element: <ScenarioSelection /> },
  ],
},
// Training session as separate full-screen route (not inside UserLayout)
{
  path: "/user/training/session",
  element: <TrainingSession />,
},
```

## Figma-to-Design-Token Color Mapping

| Figma-Make Color | Design Token | Usage |
|-----------------|-------------|-------|
| `text-gray-900` | `text-foreground` | Primary text |
| `text-gray-600` | `text-muted-foreground` | Secondary text |
| `text-gray-500` | `text-muted-foreground` | Tertiary text |
| `bg-gray-50` / `bg-[#F8FAFC]` | `bg-muted` | Page backgrounds |
| `bg-white` | `bg-card` or `bg-background` | Card backgrounds |
| `border-gray-200` | `border-border` | Borders |
| `bg-blue-600` | `bg-primary` | Primary actions |
| `text-blue-600` | `text-primary` | Active nav items |
| `bg-green-600` | `text-strength` | Success/positive |
| `bg-red-600` | `text-destructive` | Error/destructive |
| `bg-orange-600` | `text-weakness` | Warning/weakness |
| `bg-purple-600` | `text-improvement` | Improvement |
| `bg-[#1E293B]` | `bg-sidebar` | Admin sidebar |

## Component Inventory: What Exists vs What's Needed

### UI Base Components (frontend/src/components/ui/)
| Component | Exists | Needed By | Action |
|-----------|--------|-----------|--------|
| Button | YES | All screens | -- |
| Card | YES | All screens | -- |
| Input | YES | Login, Scenario filters | -- |
| Label | YES | Forms | -- |
| Checkbox | YES | Login, Training panel | -- |
| Avatar | YES | All screens | -- |
| Badge | YES | Scenario cards | -- |
| Dialog | YES | -- | -- |
| DropdownMenu | YES | Layouts | -- |
| Select | YES | Scenario filters | -- |
| Separator | YES | -- | -- |
| Tooltip | YES | Admin sidebar | -- |
| Sheet | YES | Mobile nav | -- |
| Switch | YES | Avatar toggle | -- |
| Skeleton | YES | Loading states | -- |
| Form | YES | -- | -- |
| Sonner | YES | -- | -- |
| ScrollArea | NO | F2F chat area | CREATE |
| Tabs | NO | Scenario page, Design System | CREATE |
| Progress | NO | StatCard progress bar | CREATE |
| Textarea | NO | F2F chat input | CREATE |

### Shared Components (frontend/src/components/shared/)
| Component | Exists | Source Reference | Action |
|-----------|--------|-----------------|--------|
| EmptyState | YES | Design System figma-make | UPDATE (add icon/action props) |
| LanguageSwitcher | YES | Design System figma-make | KEEP |
| LoadingState | YES | Design System figma-make | KEEP |
| ScoreCard | NO | Design System for SaaS | CREATE |
| HCPProfileCard | NO | Design System for SaaS | CREATE |
| SessionItem | NO | MR Dashboard | CREATE |
| StatCard | NO | MR Dashboard | CREATE |
| ActionCard | NO | MR Dashboard | CREATE |
| RecommendedScenario | NO | MR Dashboard | CREATE |
| ChatBubble | NO | Design System for SaaS | CREATE |
| ChatInput | NO | Design System for SaaS | CREATE |
| DimensionBar | NO | Design System for SaaS | CREATE |
| StatusBadge | NO | Design System for SaaS | CREATE |
| MiniCharts | NO | MR Dashboard | CREATE |

## i18n Namespace Plan

Current namespaces: `common`, `auth`, `nav`

New namespaces needed:
| Namespace | Purpose | Key Count (est.) |
|-----------|---------|-----------------|
| `dashboard` | User dashboard page strings | ~15 keys |
| `training` | Scenario selection + session page strings | ~30 keys |

Both en-US and zh-CN translations required for each.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Figma-make uses `react-router` v7 (new import path) | Project uses `react-router-dom` v7 | Same version, different import | Must use `react-router-dom` imports |
| Figma-make generates standalone apps | Project has integrated auth/i18n/query | N/A | All figma code must be adapted |
| Figma-make uses inline text | Project uses react-i18next | Phase 1 decision | All text must be i18n keys |

## Open Questions

1. **F2F Training Session Route Nesting**
   - What we know: The Figma shows a full-screen 3-panel layout without the standard nav bar
   - What's unclear: Should training session be a completely separate route outside UserLayout, or should it be a special "full-screen" mode within UserLayout that hides the nav?
   - Recommendation: Separate route at ProtectedRoute level (simpler, cleaner)

2. **Mock Data vs Backend Integration Timing**
   - What we know: This phase is UI-only alignment, Phase 2 adds real backend data
   - What's unclear: Should mock data be in separate files for easy removal, or inline in components?
   - Recommendation: Mock data as const arrays at top of page components, with `// TODO: Replace with TanStack Query hook in Phase 2` comments

3. **Scenario Selection Page Data Source**
   - What we know: The Figma shows Chinese doctor names with specialty/hospital/personality
   - What's unclear: Whether to show the same specific mock HCPs as in Figma or generic placeholders
   - Recommendation: Match the Figma mock data closely (Dr. Wang Wei, Dr. Li Na, etc.) for visual fidelity review

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build/dev | YES | v23.11.0 | -- |
| npm | Package install | YES | 11.8.0 | -- |
| TypeScript | Type checking | YES | ^5.6.0 (devDep) | -- |
| Vite | Build tool | YES | ^6.0.0 (devDep) | -- |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Sources

### Primary (HIGH confidence)
- Figma-make generated code: 5 directories analyzed in full
- Figma-make screenshots: 5 PNG files visually inspected
- Existing frontend source: All files in `frontend/src/` reviewed
- `frontend/package.json`: Current dependency list verified
- `frontend/src/styles/index.css`: Current design tokens verified
- npm registry: Versions verified for @radix-ui/react-scroll-area (1.2.10), @radix-ui/react-tabs (1.1.13), @radix-ui/react-progress (1.1.8), recharts (3.8.0)

### Secondary (MEDIUM confidence)
- CLAUDE.md project conventions: All coding standards extracted and applied to research
- Phase 1 decisions from STATE.md: Design token source, routing patterns, auth patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Existing project dependencies well documented, new deps verified against npm
- Architecture: HIGH - Existing patterns established in Phase 1, figma-make code fully analyzed
- Pitfalls: HIGH - Based on concrete comparison between figma-make code and project conventions
- Component inventory: HIGH - Every file in both codebases enumerated and compared

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- no fast-moving dependencies)

</details>

## UI Specification

<details><summary>Click to expand UI spec</summary>

# Phase 01.1 — UI Design Contract

> Visual and interaction contract for Figma alignment phase. Generated by gsd-ui-researcher, verified by gsd-ui-checker.
>
> **Phase goal:** Align existing frontend with 5 Figma Make generated screens. Maintain visual consistency with Figma screenshots and ensure functional completeness. All new components use the existing design token system established in Phase 1.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | manual (shadcn components installed manually, no components.json) |
| Preset | not applicable |
| Component library | Radix UI (via 17 existing shadcn/ui components + 4 new) |
| Icon library | lucide-react ^0.460.0 |
| Font | Inter + Noto Sans SC (sans), JetBrains Mono (mono) |

**Note:** 17 shadcn/ui base components already exist in `frontend/src/components/ui/`. This phase adds 4 new base components (ScrollArea, Tabs, Progress, Textarea) and 11 shared domain components.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, inline padding, tight label spacing |
| sm | 8px | Compact element spacing, badge padding, gap between form fields and labels |
| md | 16px | Default element spacing, card content padding (p-4), grid gap on mobile |
| lg | 24px | Section padding (p-6), card padding on desktop, grid gap on desktop |
| xl | 32px | Layout gaps, main content padding (py-8) |
| 2xl | 48px | Major section breaks, logo-to-form spacing on login |
| 3xl | 64px | Page-level spacing (not used in this phase) |

Exceptions:
- F2F Training left panel width: 280px (per Figma)
- F2F Training right panel width: 260px (per Figma)
- F2F Training top bar height: 56px (h-14)
- F2F Training avatar display area height: 240px (h-[240px])
- Chat input minimum height: 44px (min-h-[44px], touch target)
- Mic/Send buttons: 44px (h-11 w-11, touch target)
- Login card max width: 480px (max-w-[480px])
- Dashboard max width: 1440px (max-w-[1440px])

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Caption | 12px (text-xs) | 400 (normal) | 1.5 |
| Body | 16px (text-base) | 400 (normal) | 1.5 |
| Heading | 20px (text-xl) | 600 (semibold) | 1.2 |
| Display | 30px (text-3xl) | 600 (semibold) | 1.2 |

**Font stack:** `'Inter', 'Noto Sans SC', sans-serif` (already configured as `--font-sans`)

**Weight rules (2 weights only):**
- 400 (normal): Body text, captions, form inputs, descriptions, placeholders, secondary labels, nav items (non-active)
- 600 (semibold): All emphasis -- page titles (h1), section headings (h2), panel headers, stat values, buttons, form labels, card section titles, active nav items, badge text

**Size usage by screen:**
- Login: Title at 30px semibold, labels at 12px semibold, input text at 16px normal, button at 16px semibold
- Dashboard: Stat values at 30px semibold, section titles at 20px semibold, session text at 16px normal, trend labels at 12px normal
- Scenario Selection: Page title at 30px semibold, doctor names at 16px semibold, specialties at 12px normal
- F2F Training: Panel headers at 16px semibold, card titles at 12px semibold, card body at 12px normal
- Chat messages: 16px normal, timestamps at 12px normal

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#FFFFFF` (--background) | Page backgrounds, card surfaces, center chat panel |
| Secondary (30%) | `#F8FAFC` (bg-slate-50 / bg-muted) | Left/right panels (F2F), page background (dashboard bg-gray-50), input backgrounds |
| Accent (10%) | `#1E40AF` (--primary) | Sign In button, Start Training buttons, active nav items, icon backgrounds, primary badges |
| Destructive | `#EF4444` (--destructive) | End Session button, recording indicator, error messages |

**Accent reserved for:**
1. Primary CTA buttons (Sign In, Start Training)
2. Active navigation link indicators
3. Icon background tints (bg-primary/10 on stat cards)
4. Chat bubbles from HCP (bg-blue-500)
5. Input mode toggle active state
6. Progress bar fill
7. Badge highlighting for "F2F" mode indicator

**Semantic colors (already established):**
| Token | Value | Usage |
|-------|-------|-------|
| --strength | `#22C55E` | Positive trends, delivered message status, score >= 80 |
| --weakness | `#F97316` | Warning indicators, "Hard" difficulty badge |
| --improvement | `#A855F7` | Improvement trends, Conference Training gradient, "Medium" difficulty badge |
| --destructive | `#EF4444` | End Session, error states, score < 60 |

**Difficulty badge color mapping:**
| Difficulty | Background | Text |
|------------|-----------|------|
| Easy | `bg-green-100` | `text-green-700` |
| Medium | `bg-orange-100` | `text-orange-700` |
| Hard | `bg-red-100` | `text-red-700` |

**Mode badge color mapping:**
| Mode | Background | Text |
|------|-----------|------|
| F2F | `bg-blue-100` | `text-blue-700` |
| Conference | `bg-purple-100` | `text-purple-700` |

**Figma-to-Design-Token color mapping (executor must follow):**
| Figma-Make Raw Color | Project Token | Usage |
|---------------------|---------------|-------|
| `text-gray-900` | `text-foreground` | Primary text |
| `text-gray-700` | `text-foreground` | Form labels |
| `text-gray-600` | `text-muted-foreground` | Secondary text, descriptions |
| `text-gray-500` | `text-muted-foreground` | Tertiary text, placeholders |
| `bg-gray-50` / `bg-[#F8FAFC]` | `bg-muted` | Page backgrounds |
| `bg-white` | `bg-card` or `bg-background` | Card backgrounds |
| `border-gray-200` | `border-border` | Borders, dividers |
| `bg-blue-600` / `bg-blue-500` | `bg-primary` | Primary actions, HCP chat bubbles |
| `text-blue-600` | `text-primary` | Active nav items, links |
| `bg-green-600` / `text-green-600` | `text-strength` | Success, positive trends |
| `bg-red-600` / `text-red-600` | `text-destructive` | Error, destructive actions |
| `bg-slate-900` | `bg-slate-900` (keep raw) | Avatar display area dark background |
| `bg-slate-50` | `bg-muted` | Side panel backgrounds |
| `border-slate-200` | `border-border` | Panel borders |

---

## Copywriting Contract

All text must go through react-i18next. Two new i18n namespaces required: `dashboard` and `training`.

| Element | en-US Copy | zh-CN Copy | i18n Key |
|---------|-----------|-----------|----------|
| Login primary CTA | Sign In | 登录 | `auth:signIn` (exists) |
| Dashboard welcome | Welcome back, {{name}}! | 欢迎回来, {{name}}! | `dashboard:welcome` |
| Dashboard subtitle | Here's your training overview | 这是您的培训概览 | `dashboard:overview` |
| Sessions stat label | Sessions Completed | 已完成场次 | `dashboard:sessionsCompleted` |
| Average score label | Average Score | 平均分数 | `dashboard:averageScore` |
| This week label | This Week | 本周 | `dashboard:thisWeek` |
| Improvement label | Improvement | 提升幅度 | `dashboard:improvement` |
| Recent sessions heading | Recent Training Sessions | 最近培训记录 | `dashboard:recentSessions` |
| View all link | View All | 查看全部 | `dashboard:viewAll` |
| Start training heading | Start Training | 开始培训 | `dashboard:startTraining` |
| F2F training title | F2F HCP Training | 面对面HCP培训 | `dashboard:f2fTraining` |
| F2F training desc | Practice 1-on-1 with digital HCP | 与数字化HCP进行一对一练习 | `dashboard:f2fDescription` |
| Conference training title | Conference Training | 学术会议培训 | `dashboard:conferenceTraining` |
| Conference training desc | Practice department presentation | 练习科室学术报告 | `dashboard:conferenceDescription` |
| Recommended heading | Recommended Scenario | 推荐场景 | `dashboard:recommendedScenario` |
| Start button (action cards) | Start Training | 开始培训 | `common:startTraining` |
| Start button (recommended) | Start Training | 开始培训 | `common:startTraining` |
| Scenario page title | Select Training Scenario | 选择培训场景 | `training:selectScenario` |
| F2F Training tab | F2F Training | 面对面培训 | `training:f2fTraining` |
| Conference Training tab | Conference Training | 学术会议培训 | `training:conferenceTraining` |
| All Products filter | All Products | 全部产品 | `training:allProducts` |
| All Difficulties filter | All Difficulties | 全部难度 | `training:allDifficulties` |
| All Specialties filter | All Specialties | 全部科室 | `training:allSpecialties` |
| Search placeholder | Search... | 搜索... | `training:search` |
| Start Training (card CTA) | Start Training | 开始培训 | `training:startTraining` |
| Training Panel header | Training Panel | 培训面板 | `training:trainingPanel` |
| Coaching Panel header | Coaching Panel | 教练面板 | `training:coachingPanel` |
| Scenario Briefing | Scenario Briefing | 场景简报 | `training:scenarioBriefing` |
| HCP Profile | HCP Profile | HCP档案 | `training:hcpProfile` |
| Key Messages | Key Messages | 关键信息 | `training:keyMessages` |
| Scoring Criteria | Scoring Criteria | 评分标准 | `training:scoringCriteria` |
| AI Coach Hints | AI Coach Hints | AI教练提示 | `training:aiCoachHints` |
| Message Tracker | Message Tracker | 信息追踪 | `training:messageTracker` |
| Session Stats | Session Stats | 会话统计 | `training:sessionStats` |
| End Session | End Session | 结束会话 | `training:endSession` |
| Type your message | Type your message... | 输入您的消息... | `training:typeMessage` |
| Input Mode label | Input Mode: | 输入模式: | `training:inputMode` |
| Text mode | Text | 文字 | `training:textMode` |
| Audio mode | Audio | 语音 | `training:audioMode` |
| Avatar toggle | Avatar | 虚拟形象 | `training:avatar` |
| Azure AI Avatar label | Azure AI Avatar | Azure AI 虚拟形象 | `training:azureAiAvatar` |
| Avatar Disabled | Avatar Disabled | 虚拟形象已关闭 | `training:avatarDisabled` |
| Duration label | Duration: | 时长: | `training:duration` |
| Word Count label | Word Count: | 字数: | `training:wordCount` |

**Empty state (kept from Phase 1):**
- Heading: "No data yet" / "暂无数据" (`common:noData`)
- Body: "Complete your first training session to see results here" / "完成您的第一次培训后即可查看结果" (`common:noDataDescription`)

**Error state:**
- Heading: "Something went wrong" / "出现错误" (`common:errorTitle`)
- Body: "Please try again or contact support if the problem persists" / "请重试，如问题持续请联系技术支持" (`common:errorDescription`)

**Destructive action:**
- End Session: Browser `confirm()` dialog with message "Are you sure you want to end this training session?" / "确定要结束本次培训吗？" (`training:endSessionConfirm`)

---

## Visual Focal Points

Each screen declares one primary focal point -- the element the user's eye should land on first.

| Screen | Focal Point | How Achieved |
|--------|-------------|-------------|
| Login | Sign In button | Only accent-colored element on the page; all other elements are neutral/white |
| Dashboard | 4 StatCards row | Top-of-page placement, accent-tinted icon backgrounds (bg-primary/10), large 30px stat values |
| Scenario Selection | HCP card grid | Cards dominate visual area; accent "Start Training" button on each card draws scanning |
| F2F Training | Center chat panel | Widest panel (flex-1), white background contrasts with muted side panels; avatar area provides visual weight at top |

---

## Accessibility: Icon-Only Action Labels

All icon-only interactive elements must declare `aria-label` and render a visible `Tooltip` on hover/focus.

| Element | Icon | aria-label (en-US) | aria-label (zh-CN) | i18n Key |
|---------|------|--------------------|--------------------|----------|
| Mic button (idle) | `Mic` | Start voice recording | 开始语音录制 | `training:ariaStartRecording` |
| Mic button (recording) | `MicOff` | Stop voice recording | 停止语音录制 | `training:ariaStopRecording` |
| Send button | `Send` | Send message | 发送消息 | `training:ariaSendMessage` |
| Left panel collapse | `ChevronLeft` | Collapse training panel | 折叠培训面板 | `training:ariaCollapseLeft` |
| Left panel expand | `ChevronRight` | Expand training panel | 展开培训面板 | `training:ariaExpandLeft` |
| Right panel collapse | `ChevronRight` | Collapse coaching panel | 折叠教练面板 | `training:ariaCollapseRight` |
| Right panel expand | `ChevronLeft` | Expand coaching panel | 展开教练面板 | `training:ariaExpandRight` |
| Password visibility | `Eye` / `EyeOff` | Show password / Hide password | 显示密码 / 隐藏密码 | `auth:ariaShowPassword` / `auth:ariaHidePassword` |
| Language switcher | `Globe` | Switch language | 切换语言 | `common:ariaSwitchLanguage` |

---

## Component Inventory

### New UI Base Components (frontend/src/components/ui/)

| Component | Radix Dependency | Source Reference |
|-----------|-----------------|-----------------|
| `scroll-area.tsx` | @radix-ui/react-scroll-area | F2F Training chat area |
| `tabs.tsx` | @radix-ui/react-tabs | Scenario Selection page |
| `progress.tsx` | @radix-ui/react-progress | Dashboard StatCard |
| `textarea.tsx` | none (HTML textarea) | F2F Training chat input |

### New Shared Domain Components (frontend/src/components/shared/)

| Component | Props Interface | Visual Reference |
|-----------|----------------|-----------------|
| `stat-card.tsx` | `{ label: string; value: string/number; icon?: LucideIcon; trend?: { value: string; direction: "up"/"down" }; chart?: ReactNode; progress?: { current: number; total: number } }` | Dashboard screenshot: 4 stat cards in top row |
| `session-item.tsx` | `{ hcpName: string; specialty: string; mode: "F2F"/"Conference"; score: number; timeAgo: string; avatar?: string }` | Dashboard screenshot: Recent Training Sessions list |
| `action-card.tsx` | `{ title: string; description: string; icon: LucideIcon; gradient: "blue"/"purple"; onStart: () => void }` | Dashboard screenshot: F2F HCP Training / Conference Training gradient cards |
| `recommended-scenario.tsx` | `{ hcpName: string; difficulty: string }` | Dashboard screenshot: Recommended Scenario card |
| `mini-charts.tsx` | exports `MiniRadarChart` and `MiniTrendChart` (no props, inline SVG) | Dashboard screenshot: mini visualizations in stat cards |
| `hcp-profile-card.tsx` | `{ name: string; nameZh?: string; specialty: string; hospital: string; personality: string[]; difficulty: "Easy"/"Medium"/"Hard"; product: string; avatar?: string; onStartTraining: () => void }` | Scenario Selection screenshot: HCP cards with photos |
| `chat-bubble.tsx` | `{ sender: "hcp"/"mr"; text: string; timestamp: Date }` | F2F Training screenshot: chat messages |
| `chat-input.tsx` | `{ onSend: (text: string) => void; inputMode: "text"/"audio"; onMicClick: () => void; recordingState: "idle"/"recording"/"processing"; disabled?: boolean }` | F2F Training screenshot: message input area |
| `dimension-bar.tsx` | `{ label: string; value: number; maxValue?: number }` | Design System screenshot: scoring dimension bars |
| `status-badge.tsx` | `{ status: "delivered"/"in-progress"/"pending"; label: string }` | F2F Training screenshot: message tracker items |
| `score-card.tsx` | `{ score: number; label: string; trend?: { value: string; direction: "up"/"down" }; chart?: ReactNode }` | Design System screenshot: score display cards |

### New Coach Components (frontend/src/components/coach/)

| Component | Props Interface | Visual Reference |
|-----------|----------------|-----------------|
| `left-panel.tsx` | `{ isCollapsed: boolean; onToggleCollapse: () => void; keyMessages: KeyMessage[]; onToggleKeyMessage: (id: string) => void }` | F2F Training screenshot: left 280px panel with scenario briefing, HCP profile, key messages, scoring criteria |
| `center-panel.tsx` | `{ sessionTime: string; onEndSession: () => void; messages: Message[]; onSendMessage: (text: string) => void }` | F2F Training screenshot: center panel with avatar area, chat, input |
| `right-panel.tsx` | `{ isCollapsed: boolean; onToggleCollapse: () => void; messageStatuses: MessageStatus[]; sessionTime: string; wordCount: number }` | F2F Training screenshot: right 260px panel with AI hints, message tracker, session stats |

### Pages to Create/Update

| Page | File Path | Action | Visual Reference |
|------|-----------|--------|-----------------|
| Login | `frontend/src/pages/login.tsx` | UPDATE: Logo SVG, card shadow, language switcher position, copyright position | Login_Page.png |
| Auth Layout | `frontend/src/components/layouts/auth-layout.tsx` | UPDATE: Gradient via-white, language switcher to top-right, copyright footer | Login_Page.png |
| User Dashboard | `frontend/src/pages/user/dashboard.tsx` | REPLACE: Full dashboard with StatCards, SessionItems, ActionCards per Figma | Medical Representative Dashboard_Page.png |
| Scenario Selection | `frontend/src/pages/user/training.tsx` | CREATE: Tab navigation, filters, 3-column HCP card grid | Scenario Selection Page.png |
| F2F Training Session | `frontend/src/pages/user/training-session.tsx` | CREATE: Full-screen 3-panel layout with collapsible side panels | F2F HCP Training Page.png |

---

## Layout Contracts

### Login Page Layout
- Full viewport, centered card
- Background: `bg-gradient-to-br from-blue-50 via-white to-blue-50`
- Card: `max-w-[480px] bg-white rounded-2xl shadow-xl p-8`
- Logo: 64x64 blue gradient square with lightbulb SVG icon, rounded-2xl
- Language switcher: fixed top-6 right-6, white bg, shadow-sm, rounded-lg
- Copyright: fixed bottom-6, centered, text-xs text-muted-foreground

### User Dashboard Layout
- Inside existing UserLayout (with top nav)
- Max width: 1440px, centered, px-6 py-8
- Row 1: 4-column grid of StatCards, gap-6, mb-6
- Row 2: 5-column grid -- left 3 cols (Recent Sessions), right 2 cols (Start Training + Recommended)
- Cards: `bg-white rounded-lg p-6 shadow-sm border border-gray-200` (mapped to `bg-card rounded-lg p-6 shadow-sm border border-border`)

### Scenario Selection Page Layout
- Inside existing UserLayout (with top nav)
- Page title: text-3xl font-semibold, mb-4
- Tabs: F2F Training | Conference Training, mb-6
- Filter row: 3 Select dropdowns + Search Input, gap-4, mb-8
- Card grid: 3-column on desktop, 2-column tablet, 1-column mobile, gap-6
- HCP cards: centered avatar (96px circle), name semibold, specialty badge, hospital, personality tags, product, difficulty badge, full-width "Start Training" button

### F2F Training Session Layout
- Full-screen (`h-screen w-screen overflow-hidden flex`)
- NOT inside UserLayout -- separate route at ProtectedRoute level
- Left panel: 280px width, bg-slate-50, border-r, collapsible to 48px (w-12)
- Center panel: flex-1, bg-white, vertical flex (top bar 56px + avatar 240px + chat flex-1 + input area)
- Right panel: 260px width, bg-slate-50, border-l, collapsible to 48px (w-12)
- Top bar: h-14, border-b, timer left, End Session button right (destructive variant)

---

## Interaction Contracts

### Login Page
- Email/password fields: focus ring-2 ring-blue-500
- Password visibility toggle: Eye/EyeOff icon button, `aria-label` per accessibility table above
- Remember me: Checkbox component
- Submit: Loading state with Loader2 spinner + "Signing in..." text
- Error: Red text below form on auth failure

### User Dashboard
- Stat cards: Static display (no interaction in this phase)
- Recent sessions: Clickable rows with chevron-right, hover bg-gray-50
- Action cards (F2F / Conference): "Start Training" button navigates to `/user/training`
- Recommended scenario: "Start Training" button navigates to training session
- View All link: Navigates to session history (placeholder/no-op in this phase)

### Scenario Selection Page
- Tab switching: F2F Training / Conference Training tabs filter the grid
- Filters: All Products, All Difficulties, All Specialties dropdowns + search input (client-side filtering of mock data)
- HCP cards: "Start Training" button navigates to `/user/training/session`
- Card hover: shadow-md transition

### F2F Training Session Page
- Left panel collapse: ChevronLeft toggle (with `aria-label` and Tooltip per accessibility table), collapses to 48px strip
- Right panel collapse: ChevronRight toggle (with `aria-label` and Tooltip per accessibility table), collapses to 48px strip
- Session timer: Auto-incrementing mm:ss display
- Avatar toggle: Switch component enables/disables avatar display area
- Chat: Auto-scroll to bottom on new messages
- Text input: Textarea with Enter to send, Shift+Enter for newline
- Input mode toggle: Text/Audio pill buttons
- Mic button: Idle (blue) -> Recording (red pulse) -> Processing (yellow) -> Idle; `aria-label` updates per state (see accessibility table)
- Send button: Disabled when input empty or in audio mode; `aria-label` per accessibility table
- End Session: Destructive button triggers confirm dialog
- HCP response: Simulated 1.5s delay with typing indicator (three bouncing dots)
- Key messages: Checkbox toggles in left panel

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (manual) | ScrollArea, Tabs, Progress, Textarea | not required -- standard Radix primitives |
| Third-party | none | not applicable |

**New Radix dependencies to install:**
```bash
cd frontend && npm install @radix-ui/react-scroll-area @radix-ui/react-tabs @radix-ui/react-progress
```

**No third-party registries.** All components are either existing shadcn/ui primitives or custom domain components built on top of them.

---

## i18n Namespace Plan

| Namespace | File | Key Count | Status |
|-----------|------|-----------|--------|
| `common` | `public/locales/{lang}/common.json` | ~8 new keys (including startTraining, aria labels) | UPDATE |
| `auth` | `public/locales/{lang}/auth.json` | ~2 new keys (aria labels) | UPDATE |
| `nav` | `public/locales/{lang}/nav.json` | 0 new keys | EXISTS |
| `dashboard` | `public/locales/{lang}/dashboard.json` | ~15 keys | CREATE |
| `training` | `public/locales/{lang}/training.json` | ~37 keys (including aria labels) | CREATE |

Both `en-US` and `zh-CN` translations required for every key.

---

## Mock Data Contract

This phase uses static mock data. No backend API calls. Mock data lives as `const` arrays at the top of page components with `// TODO: Replace with TanStack Query hook in Phase 2` comments.

### Dashboard Mock Data
- 4 stat values: Sessions Completed (24), Average Score (78), This Week (5 of 7), Improvement (+12%)
- 5 recent sessions: Dr. Sarah Mitchell (Cardiology, F2F, 85), Dr. James Wong (Oncology, Conference, 72), Dr. Michael Chen (Neurology, F2F, 92), Dr. Emily Roberts (Endocrinology, Conference, 55), Dr. Robert Thompson (Rheumatology, F2F, 88)
- 2 action cards: F2F HCP Training (blue gradient), Conference Training (purple gradient)
- 1 recommended scenario: Dr. Amanda Hayes, Intermediate difficulty

### Scenario Selection Mock Data
- 6 HCP cards matching Figma screenshot:
  1. Dr. Wang Wei (王伟) - Oncologist, Beijing Cancer Hospital, Hard, PD-1 Inhibitor
  2. Dr. Li Na (李娜) - Cardiologist, Shanghai Cardiovascular Center, Easy, ACE Inhibitor
  3. Dr. Zhang Ming (张明) - Neurologist, Guangzhou General Hospital, Medium, Migraine Treatment
  4. Dr. Chen Hui (陈慧) - Pulmonologist, Shenzhen Respiratory Institute, Medium, COPD Inhaler
  5. Dr. Liu Yang (刘洋) - Endocrinologist, Hangzhou Diabetes Center, Hard, GLP-1 Agonist
  6. Dr. Zhao Lin (赵琳) - Hematologist, Nanjing Blood Disease Hospital, Easy, Anticoagulant Therapy

### F2F Training Session Mock Data
- HCP: Dr. Wang Wei, Oncologist, Skeptical/Detail-oriented personality
- Product: PD-1 Inhibitor
- 4 key messages: Efficacy data from Phase III trial, Safety profile comparison, Dosing convenience, Patient quality of life data
- 5 scoring criteria: Key Message 30%, Objection Handling 25%, Communication 20%, Product Knowledge 15%, Scientific 10%
- Initial HCP message: "Good morning, I have about 10 minutes. What brings you here today?"
- 2 AI Coach hints in right panel

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

