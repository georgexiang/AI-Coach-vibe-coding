---
name: BeiGene AI Coach Project Context
description: Key decisions and context for the AI Coach platform being built for BeiGene (百济神州)
type: project
---

**Client**: BeiGene (百济神州) — major biotech company
**Product**: AI Coach Platform for Medical Representative (MR) training
**Purpose**: Production system (not PoC) for MR training through AI-simulated HCP interactions

**Key Decisions:**
- Azure PaaS stack (not AWS): OpenAI GPT-4o + Realtime, Speech Services, AI Avatar, Content Understanding, PostgreSQL
- Start fresh codebase, reuse patterns from reference repos (yoga-guru, ragflow-studio)
- Web app first, Teams integration later (Bot + Tab)
- Single tenant, per-region deployment for regulatory compliance
- i18n: Chinese + English first, European languages later
- Auth: Simple user/admin for now, Azure AD (Entra ID) later
- User designs Figma first, then code from Figma via MCP
- Azure AI Avatar is nice-to-have, but config UI must show the concept

**Reference Repos:**
- https://github.com/huqianghui/ragflow-skill-orchestrator-studio-vibe-coding (Ant Design, Connection management pattern)
- https://github.com/huqianghui/yoga-guru-copilot-platform (Tailwind + Radix UI, ServiceConfig pattern, agent adapters)

**Timeline**: Need prototype this week (2026-03-24 week) to show BeiGene client

**Why:** Adapting Capgemini's AWS-based AI Coach solution to Azure for BeiGene deployment across multiple markets (China + Europe)

**How to apply:** Prioritize demo-able features. Backend stability > frontend polish. Responsive design is key (web/mobile/Teams).
