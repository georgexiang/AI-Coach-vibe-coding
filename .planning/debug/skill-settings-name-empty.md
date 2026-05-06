---
status: awaiting_human_verify
trigger: "skill-settings-name-empty: Settings tab Name field is empty despite header showing skill name"
created: 2026-04-26T00:00:00Z
updated: 2026-04-26T00:00:02Z
---

## Current Focus

hypothesis: CONFIRMED - Input component does not use forwardRef, so RHF register() ref is dropped. reset() cannot update DOM element value.
test: Compare Input (no forwardRef) vs Textarea (uses forwardRef) - Textarea description works, Input name doesn't
expecting: Fix Input to forward refs, or pass value explicitly
next_action: Awaiting human verification that the name field now populates on the Settings tab

## Symptoms

expected: The "名称" (Name) field on the Settings tab should display the skill's name (same as shown in the header)
actual: The "名称" field is empty, only showing placeholder text. Other fields like description are populated correctly.
errors: No visible errors in the UI
reproduction: Navigate to any skill's edit page -> click Settings tab -> observe Name field is empty
started: Likely since commit 3fa52f5 "fix: unify skill name to settings-only input with read-only header display"

## Eliminated

## Evidence

- timestamp: 2026-04-26T00:00:00Z
  checked: Commit 3fa52f5 diff - how name field was refactored
  found: Name was moved from local state (skillName) to settings form only. Header now reads from settingsForm.watch("name"). Settings tab uses forceMount with register("name").
  implication: The form internal state IS correct (header displays name), but the DOM input does not reflect it.

- timestamp: 2026-04-26T00:00:00Z
  checked: Input component (frontend/src/components/ui/input.tsx)
  found: Input is a plain function component WITHOUT React.forwardRef. It destructures {className, type, ...props} and spreads props, but ref is NOT forwarded in React 18.
  implication: register("name") returns a ref callback that is silently dropped by Input. RHF reset() cannot push values to the DOM element.

- timestamp: 2026-04-26T00:00:00Z
  checked: Textarea component (frontend/src/components/ui/textarea.tsx)
  found: Textarea DOES use React.forwardRef and explicitly passes ref={ref} to the textarea element.
  implication: This explains why description (Textarea) populates correctly but name (Input) does not.

- timestamp: 2026-04-26T00:00:00Z
  checked: React version in package.json
  found: React ^18.3.0 - ref is NOT a regular prop, requires forwardRef to pass through custom components.
  implication: Confirms Input drops the ref. In React 19+ this would work, but not in React 18.

## Resolution

root_cause: The Input component (frontend/src/components/ui/input.tsx) does not use React.forwardRef. In React 18, when react-hook-form's register() is spread onto Input, the ref callback is silently dropped. This means RHF's reset() cannot update the DOM input element's value. The form's internal state IS correct (proven by header showing the name via watch()), but the uncontrolled input never receives the value. Textarea uses forwardRef, which is why description works.
fix: Add React.forwardRef to the Input component, matching the pattern used by Textarea. The ref is now explicitly forwarded to the underlying <input> DOM element.
verification: TypeScript type check passes (npx tsc -b --noEmit). Frontend build succeeds (npm run build). Also fixes a pre-existing silent bug in objection-list.tsx where a ref was passed to Input but silently dropped.
files_changed: [frontend/src/components/ui/input.tsx]
