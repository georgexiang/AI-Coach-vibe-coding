---
name: Figma Make design exports
description: figma-make/ directory contains 5 exported Figma designs with exact code, colors, and component patterns for the AI Coach platform
type: reference
---

The `figma-make/` directory contains Figma Make code exports — these are the authoritative UI design source:

1. **Design System for SaaS** — core design tokens (`#1E40AF` primary, `#22C55E` strength, `#F97316` weakness, `#A855F7` improvement), shadcn/ui components, Inter + Noto Sans SC fonts
2. **F2F HCP Training Page Design** — 3-panel layout (280px left, flex center, 260px right), chat bubbles, coaching hints, key message checklist
3. **Scenario Selection Page Design** — card grid (3 columns), scenario cards with gradient headers, routing structure, user/admin layout
4. **Medical Representative Dashboard** — stats cards, session list, action cards with gradients, radar/trend mini charts
5. **Design Login and Layout Shell** — login page, user top-nav layout, admin sidebar layout (`#1E293B` dark sidebar), i18n EN/ZH

All use: shadcn/ui, lucide-react icons, Tailwind CSS v4, cva variants, `cn()` utility.
