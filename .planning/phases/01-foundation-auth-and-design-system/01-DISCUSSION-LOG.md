# Phase 1: Foundation, Auth, and Design System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 01-Foundation, Auth, and Design System
**Areas discussed:** Component library approach

---

## Component Library Approach

### How to build the shared component library?

| Option | Description | Selected |
|--------|-------------|----------|
| shadcn/ui + Tailwind | Copy-paste Radix-based components, customize to match Figma tokens | |
| Build from scratch | Write every component by hand with Tailwind | |
| Ant Design + customization | Use Ant Design with ConfigProvider theming | |

**User's choice:** Free text — detailed requirements:
1. Frontend-backend separation required
2. Multiple UI sets for different scenarios (clarified as role-based layouts)
3. Reference figma-make/ content for implementation
4. Complete UI with reusable component modules
5. All functionality modular
6. Follow best practices using superpowers skills

### Multiple UI sets clarification

| Option | Description | Selected |
|--------|-------------|----------|
| Role-based layouts | Different shells for User (top-nav) vs Admin (sidebar) | ✓ |
| Theming/branding variants | Same app themed differently per deployment | |
| Both roles + theming | Role-based layouts AND per-region theming | |

**User's choice:** Role-based layouts

### How to use Figma Make generated code?

| Option | Description | Selected |
|--------|-------------|----------|
| Adapt into project | Extract and adapt to project conventions | ✓ |
| Direct copy | Copy as-is, fix imports only | |
| Reference only, rebuild | Use as reference, rewrite from scratch | |

**User's choice:** Adapt into project (Recommended)

### Platform targets

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive web first | Phase 1 delivers responsive web + Teams Tab | ✓ |
| Plan for WeChat now | Add WeChat architecture considerations | |

**User's choice:** Responsive web first

### Component organization

| Option | Description | Selected |
|--------|-------------|----------|
| ui/ + domain/ split | Generic in ui/, domain-specific in coach/, admin/ | ✓ |
| Flat shared/ directory | All shared components in one directory | |
| Feature-based colocation | Components live next to features | |

**User's choice:** ui/ + domain/ split (Recommended)

### Design tokens

| Option | Description | Selected |
|--------|-------------|----------|
| Figma Make tokens take priority | Replace existing with Figma Make values | ✓ |
| Merge both | Keep structure, update conflicting values | |
| You decide | Claude picks best approach | |

**User's choice:** Figma Make tokens take priority

---

## Claude's Discretion

- Auth flow (JWT storage, login UX, route protection) — user accepted defaults
- App shell responsive behavior — user accepted defaults
- i18n file structure and language switching — user accepted defaults

## Deferred Ideas

- WeChat Mini Program (微信小程序) — separate frontend, future phase
- Teams Bot integration — post-MVP
- Per-region theming/branding — not needed for v1
