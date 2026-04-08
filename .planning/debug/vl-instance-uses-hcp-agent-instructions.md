---
status: awaiting_human_verify
trigger: "When a VL Instance is tested from its editor page's Voice Live Playground, the AI responds using the HCP agent's instructions instead of the VL Instance's own model_instruction."
created: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:00:00Z
---

## Current Focus

hypothesis: The VL Instance editor sends hcpProfileId (first assigned HCP) to VoiceTestPlayground, which causes the backend to enter the HCP branch of _load_connection_config and use agent mode with HCP instructions, instead of the vl_instance_id branch with model_instruction.
test: Trace the props passed to VoiceTestPlayground in vl-instance-editor.tsx
expecting: hcpProfileId is set when testHcp exists, and vlInstanceId is only set when testHcp is absent — confirmed.
next_action: Awaiting human verification — user must test from VL Instance editor with assigned HCP

## Symptoms

expected: When testing a VL Instance from its edit page, the AI should use the VL Instance's own model_instruction as the system prompt, regardless of HCP assignment.
actual: The AI responds using the HCP profile's agent instructions (medical/CNS content) instead of the VL Instance's model_instruction ("你叫做王芳，是一名英语老师。").
errors: No error messages — wrong instructions used.
reproduction: 1) Create VL Instance with model_instruction "你叫做王芳，是一名英语老师。" 2) Assign to HCP with synced agent 3) Test from VL Instance editor 4) AI responds about medical topics
started: Current behavior — introduced with VL Instance assignment + agent mode implementation

## Eliminated

(none)

## Evidence

- timestamp: 2026-04-08T00:01:00Z
  checked: frontend/src/pages/admin/vl-instance-editor.tsx lines 106-110, 688-691
  found: |
    Lines 106-110: `const assignedHcps = useMemo(() => (id ? hcpProfiles.filter(...) : []), ...); const testHcp = assignedHcps[0];`
    Lines 688-691: `<VoiceTestPlayground hcpProfileId={testHcp?.id} vlInstanceId={!testHcp ? id : undefined} ...>`
    When an HCP is assigned to this VL Instance, testHcp is truthy, so:
      - hcpProfileId = testHcp.id (sent to backend)
      - vlInstanceId = undefined (NOT sent)
    This means the backend receives hcp_profile_id and enters the HCP branch at line 106 of voice_live_websocket.py.
  implication: The frontend explicitly prioritizes HCP mode over VL Instance mode when any HCP is assigned. This is the root cause.

- timestamp: 2026-04-08T00:02:00Z
  checked: backend/app/services/voice_live_websocket.py _load_connection_config lines 106-183 vs 184-237
  found: |
    The function has two branches: `if hcp_profile_id:` (line 106) and `elif vl_instance_id:` (line 184).
    When hcp_profile_id is provided, it loads the HCP profile, resolves voice config, and checks for agent mode (lines 152-160).
    If the HCP has agent_id + agent_sync_status=="synced", it sets use_agent_mode=True and agent_name=profile.agent_id.
    In agent mode, the AI uses the agent's own instructions (stored in Azure AI Foundry), NOT the VL Instance's model_instruction.
    The `elif vl_instance_id:` branch correctly uses model mode with inst.model_instruction — but it's never reached because hcpProfileId takes priority.
  implication: Backend logic is correct — it properly handles both branches. The bug is purely in the frontend prop passing.

## Resolution

root_cause: In vl-instance-editor.tsx, when any HCP profile is assigned to the VL Instance, the editor sends `hcpProfileId={testHcp?.id}` and `vlInstanceId={undefined}` to VoiceTestPlayground. This causes the backend to enter the HCP code path in `_load_connection_config`, which resolves agent mode with the HCP's agent instructions instead of the VL Instance's own `model_instruction`. The VL Instance editor's standalone test should ALWAYS use `vlInstanceId` with the instance's own config, never routing through an HCP profile.
fix: Change vl-instance-editor.tsx to always pass vlInstanceId={id} and never pass hcpProfileId when testing from the VL Instance editor page.
verification: TypeScript compiles clean, all 38 unit tests pass, frontend build succeeds. Awaiting human end-to-end verification.
files_changed:
  - frontend/src/pages/admin/vl-instance-editor.tsx
