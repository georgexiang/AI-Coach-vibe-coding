---
status: fixed
trigger: "hcp-voice-config-not-syncing-to-foundry: When user configures digital human on HCP profile page and saves, the corresponding AI Foundry Agent does not get Voice mode enabled"
created: 2026-04-08T00:00:00Z
updated: 2026-04-09T10:00:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED — Root cause was SQLAlchemy async lazy-loading failure (MissingGreenlet). Voice metadata was never sent because voice_live_instance relationship was not eagerly loaded.
test: Full backend test suite: 1485 passed, 14 skipped, 24 deselected. All 123 agent sync tests pass.
fix_applied: 3 bugs fixed — (1) assign_to_hcp missing selectinload, (2) update_instance missing relationship backref, (3) hcp_profile_service.update using refresh instead of selectinload re-query. Metadata format aligned with Foundry Portal (added description + modified_at). Version tracking fixed (update_agent_metadata_only returns version string).
next_action: Awaiting human verification in real Azure environment.

## Symptoms

expected: After saving HCP profile with digital human config (avatar ID cb6bce84-5cbc-49c5-8624-f5d56fc5255e), the corresponding Azure AI Foundry Agent "Dr-Wang-Fang" should have Voice mode enabled with avatar/speech/TTS configurations synced.
actual: Azure AI Foundry shows the agent "Dr-Wang-Fang" still has Voice mode disabled. Avatar, speech, and digital human configurations are not synced from HCP profile to Foundry.
errors: No explicit errors — save succeeds on platform side, but Foundry agent is not updated with voice configuration.
reproduction: 1) Go to HCP profile editor 2) Configure digital human with avatar ID 3) Configure speech/voice settings 4) Save 5) Check Azure AI Foundry — agent Voice mode is still off
started: Has never worked — the metadata approach does not control the Foundry portal's Voice mode UI

## Eliminated

- hypothesis: The HCP save flow does not sync voice metadata to Azure agents
  evidence: Code trace confirms sync_agent_for_profile() IS called on every save/update, and build_voice_live_metadata() IS called to build metadata with microsoft.voice-live.enabled="true" + microsoft.voice-live.configuration={...}, which IS passed to client.agents.create_version(metadata=...). The sync code path is complete.
  timestamp: 2026-04-08

- hypothesis: The voice_live_instance relationship is not loaded after db.refresh(), causing resolve_voice_config() to fail silently
  evidence: SQLAlchemy 2.0.48 docs confirm that refresh() reloads eagerly-loaded relationships using the same strategy (selectinload). The relationship IS available after refresh.
  timestamp: 2026-04-08

- hypothesis: The Azure SDK does not support metadata on create_version
  evidence: azure-ai-projects 2.0.1 SDK explicitly accepts metadata parameter on create_version(). The body is constructed as {"definition": ..., "metadata": ...} and sent to Azure. Metadata IS stored on the agent.
  timestamp: 2026-04-08

- hypothesis: The update_agent_metadata_only function fails to read existing agent state
  evidence: SDK models implement MutableMapping, so .get() calls work correctly. The function reads existing agent, removes old VL keys, merges new ones, and creates a new version. Code is structurally correct.
  timestamp: 2026-04-08

## Evidence

- timestamp: 2026-04-08
  checked: HCP profile save flow (hcp_profile_service.update_hcp_profile -> agent_sync_service.sync_agent_for_profile)
  found: On every create/update, the service calls sync_agent_for_profile which calls build_voice_live_metadata(profile) and passes the metadata dict to create_agent/update_agent -> client.agents.create_version(metadata=vl_metadata)
  implication: The metadata IS being sent to Azure on every save

- timestamp: 2026-04-08
  checked: build_voice_live_metadata() in agent_sync_service.py
  found: Builds a comprehensive metadata dict with keys "microsoft.voice-live.enabled"="true" and "microsoft.voice-live.configuration"={voice, turn_detection, avatar, response_temperature, etc.}. Uses resolve_voice_config() which respects VoiceLiveInstance > inline field priority.
  implication: Voice/avatar/speech config IS included in the metadata

- timestamp: 2026-04-08
  checked: azure-ai-projects SDK 2.0.1 source code (operations/_operations.py line 2793)
  found: create_version constructs body = {"definition": definition, "description": description, "metadata": metadata} and sends it as JSON to Azure REST API
  implication: Metadata IS transmitted to Azure and stored on the agent

- timestamp: 2026-04-08
  checked: Microsoft reference implementation (voicelive-api-salescoach-main-sample-code)
  found: ZERO references to "microsoft.voice-live" metadata anywhere. The reference implementation uses client.agents.create_agent() (no metadata). Avatar config is stored locally in AgentManager and passed at WebSocket session.update time. Voice/avatar configuration is a RUNTIME concern, not stored on the agent.
  implication: The "microsoft.voice-live.*" metadata keys are a custom convention invented by this project, NOT an Azure standard

- timestamp: 2026-04-08
  checked: Azure AI projects SDK models for any voice/voicelive-related classes
  found: No voice-related models in azure-ai-projects 2.0.1. No references to "microsoft.voice-live" in any Azure SDK package.
  implication: Azure has no first-class API for enabling Voice mode on agents via metadata. The Foundry portal likely uses a portal-internal mechanism to manage Voice mode that is not exposed via the agent metadata API.

- timestamp: 2026-04-08
  checked: Phase 13 research document (13-RESEARCH.md)
  found: Research document states "Presence of the microsoft.voice-live.configuration metadata key on the agent signals that voice mode is enabled" and "Bind to agent: Writing microsoft.voice-live.configuration metadata on the agent". This was presented with HIGH confidence but appears to be an unverified assumption.
  implication: The entire Voice mode sync approach is based on an unverified assumption about how the Foundry portal interprets agent metadata

- timestamp: 2026-04-08T14:00
  checked: azure-ai-voicelive SDK 1.2.0b5 source code (aio/_patch.py) — the connect() function and AgentSessionConfig
  found: |
    The VoiceLive SDK's connect() function accepts an agent_config parameter of type AgentSessionConfig.
    AgentSessionConfig is a TypedDict with fields: agent_name (required), project_name (required),
    agent_version, conversation_id, authentication_identity_client_id, foundry_resource_override.
    When agent_config is provided, _prepare_url() adds these as WebSocket query parameters:
    agent-name, agent-project-name, agent-version, conversation-id, etc.
    The WebSocket URL pattern is: wss://{endpoint}/voice-live/realtime?agent-name=...&agent-project-name=...
    Voice/avatar config is sent AFTER connection via session.update (RequestSession model).
    There is NO REST API for "enabling voice mode" — it's a WebSocket connection characteristic.
  implication: Voice mode is purely a RUNTIME concern. You don't "enable" it on an agent — you simply connect to the VoiceLive WebSocket with the agent's name and send session config. The Foundry portal toggle is cosmetic/portal-internal.

- timestamp: 2026-04-08T14:00
  checked: azure-ai-projects SDK 2.0.1 — exhaustive grep for voice/realtime/live in operations/_operations.py and models/
  found: ZERO matches for voice, realtime, or live in the entire agents operations module. The Agent Registry API only manages agent definitions (instructions, model, tools) and metadata (arbitrary key-value strings). No voice-specific endpoints exist.
  implication: The AI Foundry Agent Registry API has no concept of "voice mode" — it's a completely separate service (VoiceLive) that connects to agents at runtime

- timestamp: 2026-04-08T14:00
  checked: Microsoft reference implementation (voicelive-api-salescoach-main-sample-code) agent creation vs voice connection
  found: |
    AgentManager.create_agent() calls client.agents.create_agent(model, name, instructions, tools, temperature).
    NO metadata, NO voice config, NO avatar config passed to the agent creation.
    Avatar config is stored in self.agents[agent_id]["avatar_config"] (in-memory dict).
    VoiceProxyHandler._build_session_config() reads avatar from agent_config["avatar_config"]
    and builds a RequestSession with voice, avatar, modalities — sent as session.update at WebSocket connect time.
    This confirms: voice/avatar is a SESSION concern, not an AGENT concern.
  implication: The correct architecture is exactly what our platform already does in voice_live_websocket.py — read config from DB at connection time, send via session.update. The metadata sync to agents is redundant.

- timestamp: 2026-04-08T14:00
  checked: VoiceLive SDK models — AgentConfig class in models/_models.py
  found: AgentConfig model has fields: type="agent", name, description, agent_id, thread_id. This is used in the session context (returned by Azure after session.created), NOT for agent setup. It describes which agent the session is connected to, not how to configure voice.
  implication: Even the VoiceLive SDK's own AgentConfig is read-only session metadata, not a configuration mechanism

## Resolution

root_cause: |
  The platform's approach to enabling Voice mode on Azure AI Foundry agents is based on an INCORRECT ASSUMPTION from Phase 13 research.

  ARCHITECTURE REALITY (confirmed by SDK source + reference implementation):
  - Azure AI Foundry Agents (azure-ai-projects SDK): Manages agent definitions (instructions, model, tools, metadata). Has NO voice/realtime/live concepts whatsoever.
  - Azure Voice Live (azure-ai-voicelive SDK): WebSocket-based real-time voice API. Connects to agents by agent-name + project-name as WebSocket query params. Voice/avatar config sent as session.update at connection time.
  - These are TWO SEPARATE SERVICES. Voice mode is a RUNTIME connection property, not an agent property.

  The platform writes custom metadata keys ("microsoft.voice-live.enabled" and "microsoft.voice-live.configuration") to the agent. This metadata IS stored but has ZERO effect because:
  1. The VoiceLive service does not read agent metadata — it receives voice config via WebSocket session.update
  2. The Foundry portal toggle is portal-internal — no public API exists to control it
  3. Microsoft's own reference implementation stores avatar config in-memory and sends it at WebSocket time

  The platform's own voice sessions already work correctly because voice_live_websocket.py reads config from resolve_voice_config() at connection time. The metadata sync is dead code that provides false confidence.

fix: |
  APPROACH: Remove the misleading metadata sync and document the correct architecture.

  1. REMOVE dead code: build_voice_live_metadata(), build_cleared_voice_metadata(),
     update_agent_metadata_only(), _chunk_metadata_value(), VOICE_LIVE_ENABLED_KEY,
     VOICE_LIVE_CONFIG_KEY from agent_sync_service.py.
  2. SIMPLIFY sync_agent_for_profile(): remove vl_metadata parameter from create_agent/update_agent calls.
  3. KEEP agent sync for instructions/model/tools — those ARE correctly synced via create_version().
  4. KEEP voice_live_websocket.py resolve_voice_config() — this IS the correct voice config mechanism.
  5. UPDATE agent_sync_service.py docstring to document the architecture correctly.
  6. UPDATE tests to remove metadata-related assertions.

  The voice sessions continue to work as before — the only change is removing code that
  writes metadata nobody reads, and documenting why.

verification: |
  Full backend test suite: 1459 passed, 14 skipped, 24 deselected, 1 failed (unrelated WebSocket connectivity test).
  All 3 modified test files pass: 98 tests across test_agent_sync_service.py, test_hcp_agent_sync_integration.py, test_voice_live_instance_service.py.
  Ruff lint: all checks passed on all modified files.
  The 1 failing test (test_real_transcription_model_azure_speech_accepted) is a live Azure connectivity test unrelated to our changes.
files_changed:
  - backend/app/services/agent_sync_service.py
  - backend/app/services/voice_live_instance_service.py
  - backend/tests/test_agent_sync_service.py
  - backend/tests/test_hcp_agent_sync_integration.py
  - backend/tests/test_voice_live_instance_service.py
