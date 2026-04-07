---
status: investigating
trigger: "Voice Live Instance 编辑页面中，如果没有绑定 HCP，Start 按钮是灰色不可用的"
created: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
---

## Current Focus

hypothesis: The Start button's disabled prop has a condition that requires an HCP to be assigned/bound
test: Find the VL edit page component and inspect the Start button's disabled logic
expecting: A condition like `disabled={!selectedHcp}` or similar
next_action: Search for Voice Live edit page component and Start button logic

## Symptoms

expected: Voice Live Instance should allow Start (testing) even without HCP binding, using Response Instruction as system prompt
actual: Start button is disabled (greyed out) when no HCP is bound to the VL instance
errors: No error messages - pure UI state issue
reproduction: Open any Voice Live Instance edit page, ensure no HCP bound, observe Start button state
started: Current version

## Eliminated

## Evidence

## Resolution

root_cause:
fix:
verification:
files_changed: []
