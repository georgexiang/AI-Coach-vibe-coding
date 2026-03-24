---
name: Follow Figma designs strictly
description: UI implementation must match Figma designs for colors, layout, and functionality — do not deviate or use generic styles
type: feedback
---

UI implementation must strictly follow Figma designs — colors, layout, spacing, and functionality must match the Figma source of truth.

**Why:** User observed that test builds had color schemes, configurations, and functionality that diverged from the Figma designs. Generic AI-generated styles are not acceptable.

**How to apply:**
- Always use `get_design_context` from the Figma MCP to extract exact design tokens (colors, spacing, typography) before implementing any UI
- When generating UI-SPEC or planning frontend work, reference the Figma file as the authoritative source
- During code review and verification, compare implemented UI against Figma screenshots
- Do not substitute Figma colors/styles with generic Tailwind defaults or AI-guessed values
