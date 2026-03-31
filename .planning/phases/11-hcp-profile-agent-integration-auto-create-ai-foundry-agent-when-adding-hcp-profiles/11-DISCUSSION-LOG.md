# Phase 11: HCP Profile Agent Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 11-hcp-profile-agent-integration
**Areas discussed:** Agent sync lifecycle, Agent instructions, Admin UX flow, Mode selector wiring

---

## Agent Sync Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Delete Agent too | Full sync — HCP delete also removes the AI Foundry Agent. Clean but irreversible. | ✓ |
| Archive/disable Agent | Soft-delete — Agent stays in AI Foundry but is marked inactive. Can be recovered. | |
| Leave Agent alone | Only create/update sync. Agents accumulate, admin cleans up manually. | |

**User's choice:** Delete Agent too
**Notes:** Full bidirectional sync preferred for clean state

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-update Agent | Every HCP profile save also updates Agent instructions in AI Foundry. Always in sync. | ✓ |
| Manual re-sync button | Admin clicks 'Sync to AI Foundry' explicitly. Allows reviewing before pushing. | |

**User's choice:** Auto-update Agent

---

## Agent Instructions

| Option | Description | Selected |
|--------|-------------|----------|
| Template-based | Predefined template with HCP field placeholders. Admin can customize template. | ✓ |
| AI-generated | Use LLM to generate rich instructions. More natural but less predictable. | |
| Manual field | Free-text 'Agent Instructions' field for admin to write custom instructions. | |

**User's choice:** Template-based

| Option | Description | Selected |
|--------|-------------|----------|
| HCP personality only | Agent = doctor's persona. Scenario/product context injected at session start. | ✓ |
| Include default scenario | Agent gets both personality + default product/scenario. | |

**User's choice:** HCP personality only

---

## Admin UX Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic with status badge | Agent created automatically on HCP save. Badge shows sync status. | ✓ |
| Fully invisible | Agent creation happens silently. Admin only sees errors in toast. | |
| Explicit step | Admin clicks 'Create Agent' button after saving. More control. | |

**User's choice:** Automatic with status badge

| Option | Description | Selected |
|--------|-------------|----------|
| Core + Agent status | Name, Specialty, Personality, Communication Style, Agent Status, Actions | ✓ |
| Compact | Name, Specialty, Agent Status, Actions — details in edit dialog | |
| You decide | Claude picks appropriate columns | |

**User's choice:** Core + Agent status
**Notes:** User requested HCP profiles page change from cards to table format

---

## Mode Selector Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| From HCP profile | System looks up HCP's agent_id. Token broker returns it automatically. | ✓ |
| User selects Agent | User picks both HCP and Agent separately in mode selector. | |

**User's choice:** From HCP profile

| Option | Description | Selected |
|--------|-------------|----------|
| Disable Agent mode for that HCP | Mode selector grays out Realtime Agent if HCP has no agent_id. | ✓ |
| Fall back to Realtime Model | Silently use Realtime Model instead. Less obvious but no blocking. | |

**User's choice:** Disable Agent mode for that HCP

---

## Claude's Discretion

- Agent instruction template default wording
- Error retry strategy for AI Foundry API failures
- Table pagination/sorting details
- Loading skeleton design

## Deferred Ideas

- Bulk agent sync migration tool — one-time script for existing HCPs
- Agent versioning/rollback — future phase
- Agent analytics/usage tracking — future phase
