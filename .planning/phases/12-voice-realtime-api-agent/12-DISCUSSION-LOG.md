# Phase 12: Voice Realtime API & Agent Mode Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 12-voice-realtime-api-agent
**Areas discussed:** HCP config scope, Admin UX, Session wiring, Mode simplification

---

## HCP Config Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full settings | All settings from screenshot: voice, avatar, conversation params | ✓ |
| Core settings only | Voice name + avatar character + temperature only | |
| Voice + Avatar identity | Just voice name + avatar character | |

**User's choice:** Full settings
**Notes:** User provided screenshot of reference implementation showing complete settings panel

### Instructions Editing

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-generated + editable | System generates, admin can override | ✓ |
| Auto-generated only | Always from HCP fields | |
| Free-text only | Admin writes manually | |

### Avatar Characters

| Option | Description | Selected |
|--------|-------------|----------|
| Predefined + custom | Dropdown of Azure avatars plus custom toggle | ✓ |
| Predefined only | Only Azure predefined avatars | |
| Custom only | Admin types custom name | |

### Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Smart defaults | New HCPs get defaults (Ava, Lori-casual, temp 0.9) | ✓ |
| Require configuration | Fields empty by default | |
| Copy from template | Inherit from admin template | |

## Admin UX

| Option | Description | Selected |
|--------|-------------|----------|
| Tabs in editor | Profile / Voice & Avatar / Agent tabs | ✓ |
| Collapsible sections | All on one page | |
| Separate pages | Separate config dialog | |

### HCP Table Column

| Option | Description | Selected |
|--------|-------------|----------|
| Add Voice+Avatar column | Badges showing voice name + avatar character | ✓ |
| Merge into Agent column | Combined status | |
| No table change | Only in editor | |

## Session Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Token broker returns all | Single API response with all HCP settings | ✓ |
| Separate API call | Dedicated endpoint for HCP voice config | |
| Embedded in session | Session object includes config | |

### MR Override

| Option | Description | Selected |
|--------|-------------|----------|
| Locked per-HCP | No overrides, consistent experience | ✓ |
| Developer mode override | Toggle for testing | |
| MR can adjust | Settings panel during session | |

## Mode Simplification

| Option | Description | Selected |
|--------|-------------|----------|
| Auto + fallback | Default Digital Human, auto-fallback chain | ✓ |
| Simplified 3-choice | Text / Voice / Digital Human picker | |
| Keep 7-mode selector | Current two-level selector | |

### Fallback Notification

| Option | Description | Selected |
|--------|-------------|----------|
| Both | Toast + persistent status indicator | ✓ |
| Toast notification | Toast alert only | |
| Status bar indicator | Persistent indicator only | |

## Claude's Discretion

- DB column types and migration details
- Default avatar/voice options list
- Tab component implementation
- WebSocket reconnection strategy
- Status indicator component design

## Deferred Ideas

- Developer mode toggle for MR overrides
- Per-session provider override
- Azure AD token auth
- Multiple avatar characters per HCP
- Voice cloning / custom neural voice
