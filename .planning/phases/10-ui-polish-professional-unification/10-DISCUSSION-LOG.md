# Phase 10: UI Polish & Professional Unification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 10-ui-polish-professional-unification
**Areas discussed:** Visual Consistency, Page Hierarchy & Navigation, Demo Presentation, Responsive Polish

---

## Visual Consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Figma prompts docs | Use the 12 Figma prompt docs as reference — audit each page against its spec | ✓ |
| Best-looking page | Pick best existing page as reference | |
| Fresh design pass | Fresh review using design tokens as constraint | |

**User's choice:** Figma prompts docs
**Notes:** User emphasized 3-layer UI architecture: project-level, tech stack, per-page

| Option | Description | Selected |
|--------|-------------|----------|
| Pixel-close match | Every page closely matches its Figma prompt spec | ✓ |
| Spirit match | Follow prompts for layout, allow deviation for better UX | |
| You decide | Claude uses judgment | |

**User's choice:** Pixel-close match

| Option | Description | Selected |
|--------|-------------|----------|
| Light only | Focus on light mode only | |
| Both modes | Both light and dark mode polished | ✓ |
| Light priority | Light first, fix dark only if broken | |

**User's choice:** Both modes

| Option | Description | Selected |
|--------|-------------|----------|
| Audit all pages | Full typography audit | ✓ |
| Headers only | Focus on page titles/headers | |
| You decide | Claude reviews as part of consistency pass | |

**User's choice:** Audit all pages

| Option | Description | Selected |
|--------|-------------|----------|
| Global standards | ONE canonical style per component | ✓ |
| Controlled variants | Fixed variant set, per-page picks | |
| Per-page flex | Pages can customize | |

**User's choice:** Global standards

| Option | Description | Selected |
|--------|-------------|----------|
| Strict 4px/8px grid | Enforce 4px base grid | |
| Tailwind defaults | Default spacing scale | |
| Match Figma exactly | Use Figma prompt spacing values | ✓ |

**User's choice:** Match Figma exactly

| Option | Description | Selected |
|--------|-------------|----------|
| Brand color themes | Multiple accent colors + light/dark toggle | ✓ |
| Light/Dark toggle | Two themes only | |
| Full theme presets | Pre-built theme presets | |

**User's choice:** Brand color themes
**Notes:** User proactively requested theme selector: "用户可以选择不同色调主题"

| Option | Description | Selected |
|--------|-------------|----------|
| Header bar | Color-swatch dropdown next to language switcher | ✓ |
| Settings page | Only in user settings | |
| Both | Header + settings page | |

**User's choice:** Header bar

| Option | Description | Selected |
|--------|-------------|----------|
| 3-4 colors | Small curated set | |
| 6-8 colors | Wider palette | |
| You decide | Claude picks 4-6 professional colors | ✓ |

**User's choice:** You decide

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle transitions | 150-200ms ease, professional | ✓ |
| Rich animations | Page animations, micro-interactions | |
| Minimal/None | Instant state changes | |

**User's choice:** Subtle transitions

---

## Page Hierarchy & Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Breadcrumbs + title | Every page gets breadcrumbs + H1 | |
| Page title only | Title banner, no breadcrumbs | |
| Context-dependent | Top-level = title only, drill-down = breadcrumbs | ✓ |

**User's choice:** Context-dependent

| Option | Description | Selected |
|--------|-------------|----------|
| Bold + accent bar | Bold text + left bar (sidebar) or bottom line (top-nav) | ✓ |
| Background highlight | Subtle background color change | |
| Match Figma prompts | Follow Figma layout prompt | |

**User's choice:** Bold + accent bar

| Option | Description | Selected |
|--------|-------------|----------|
| Unified language | Same visual treatment for both layouts | ✓ |
| Distinct admin feel | Darker, data-oriented admin | |
| You decide | Claude ensures cohesive | |

**User's choice:** Unified language

| Option | Description | Selected |
|--------|-------------|----------|
| Fade transition | Quick fade (150ms) | ✓ |
| Instant swap | No animation | |
| Slide transition | Directional slide | |

**User's choice:** Fade transition

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped sections | Config / Content / Analytics groups | ✓ |
| Flat list | Single flat list with icons | |
| Collapsible groups | Expand/collapse groups | |

**User's choice:** Grouped sections

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add theme picker | Color-swatch dropdown in top-nav | ✓ |
| Language + theme combined | Single Preferences dropdown | |
| You decide layout | Claude decides placement | |

**User's choice:** Yes, add theme picker

---

## Demo Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| User dashboard + F2F | Focus on dashboard + training session | |
| Full user journey | Polish entire user flow | |
| Voice + Avatar showcase | Focus on voice/avatar pages | |
| All pages equally | Every page gets same level of polish | ✓ |

**User's choice:** All pages equally

| Option | Description | Selected |
|--------|-------------|----------|
| Polished demo data | Realistic-looking seed data with real drug names | ✓ |
| Current data is fine | Keep existing seed data | |
| Bilingual demo data | Polished data in both languages | |

**User's choice:** Polished demo data

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton + empty art | Skeleton shimmer + illustration empty states | |
| Simple spinners | Centered spinner + text message | |
| Match Figma prompts | Follow Figma prompt patterns | ✓ |

**User's choice:** Match Figma prompts

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, branded splash | Brief branded splash on startup | ✓ |
| No splash | Go straight to login/dashboard | |
| You decide | Claude decides | |

**User's choice:** Yes, branded splash

| Option | Description | Selected |
|--------|-------------|----------|
| Polished toasts | Consistent Sonner toasts with themed variants | ✓ |
| Graceful error pages | Custom 404 + error boundary + toasts | |
| Both + fallbacks | Toasts + error pages + service fallbacks | |

**User's choice:** Polished toasts

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, BeiGene products | Real BeiGene drug names and oncology/hematology profiles | ✓ |
| Generic pharma | Generic realistic pharma data | |
| Both options | BeiGene default + generic option | |

**User's choice:** Yes, BeiGene products

---

## Responsive Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop first | Optimize for 1440px+ | |
| Tablet (iPad) | Optimize for 1024px | |
| All three equal | Desktop, tablet, mobile equal attention | ✓ |

**User's choice:** All three equal

| Option | Description | Selected |
|--------|-------------|----------|
| Hamburger menu | Slide-in drawer | |
| Bottom tab bar | Mobile native-style tabs | |
| Match Figma prompt | Follow 01-login-and-layout.md | ✓ |

**User's choice:** Match Figma prompt

| Option | Description | Selected |
|--------|-------------|----------|
| Stacked panels | Vertical stack on mobile | ✓ |
| Tab-based | Chat/HCP/Hints tabs | |
| Chat focus | Chat only, sheet for others | |

**User's choice:** Stacked panels

| Option | Description | Selected |
|--------|-------------|----------|
| 44px minimum | iOS HIG / WCAG minimum | |
| Standard Tailwind | Default Tailwind sizing | ✓ |
| You decide | Claude ensures adequate | |

**User's choice:** Standard Tailwind

---

## Claude's Discretion

- Icon standardization (lucide-react sizing and stroke consistency)
- Accent color palette selection (4-6 professional colors)
- Skeleton shimmer and loading state implementations
- Error boundary page styling
- Splash screen animation timing

## Deferred Ideas

None — discussion stayed within phase scope
