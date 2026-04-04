"""WebSocket proxy handler for Voice Live connections using azure-ai-voicelive SDK.

Architecture: Backend acts as a proxy between the browser WebSocket and Azure Voice Live.
This follows the pattern from voicelive-api-salescoach-main-sample-code (reference implementation).

Voice Live uses MODEL MODE with the HCP profile's instructions as system prompt.
Agent mode (passing agent-id to Azure) requires Azure AD/Entra ID auth which is not
available in API-key-based deployments. Model mode gives equivalent results: the same
HCP personality, voice, and avatar — the instructions come from the synced agent.

Flow:
  1. Client opens WebSocket to /api/v1/voice-live/ws
  2. Client sends session.update with hcp_profile_id and system_prompt
  3. Backend looks up HCP profile → loads voice/avatar config + instructions
  4. Backend connects to Azure Voice Live (model mode) with session config
  5. Backend sends {"type": "proxy.connected"} to client
  6. Bidirectional proxy: client ↔ backend ↔ Azure Voice Live
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import config_service
from app.utils.azure_endpoints import to_cognitive_services_endpoint

logger = logging.getLogger(__name__)

# API version matching the reference implementation
AZURE_VOICE_API_VERSION = "2025-05-01-preview"

# Message types
SESSION_UPDATE_TYPE = "session.update"
PROXY_CONNECTED_TYPE = "proxy.connected"
ERROR_TYPE = "error"


# Keep module-level alias for backward compatibility (used by tests)
_to_cognitive_services_endpoint = to_cognitive_services_endpoint


async def _load_connection_config(
    db: AsyncSession,
    hcp_profile_id: str | None = None,
    system_prompt: str | None = None,
) -> dict[str, Any]:
    """Load all config needed for Azure Voice Live connection from DB.

    Returns dict with: endpoint, api_key, model, voice_name, voice_type,
    avatar_character, avatar_style, avatar_enabled, system_prompt,
    instructions, and other voice/avatar settings.
    """
    # Fetch azure_voice_live config
    vl_config = await config_service.get_config(db, "azure_voice_live")
    if not vl_config or not vl_config.is_active:
        raise ValueError("Voice Live not configured")

    api_key = await config_service.get_effective_key(db, "azure_voice_live")
    if not api_key:
        raise ValueError("Voice Live API key not set")

    raw_endpoint = await config_service.get_effective_endpoint(db, "azure_voice_live")
    if not raw_endpoint:
        raise ValueError("Voice Live endpoint not configured")

    effective_endpoint = to_cognitive_services_endpoint(raw_endpoint)

    # Defaults
    result: dict[str, Any] = {
        "endpoint": effective_endpoint,
        "api_key": api_key,
        "model": vl_config.model_or_deployment or "gpt-4o",
        "voice_name": "zh-CN-XiaoxiaoMultilingualNeural",
        "voice_type": "azure-standard",
        "avatar_character": "Lisa-casual-sitting",
        "avatar_style": "casual",
        "avatar_customized": False,
        "avatar_enabled": False,
        "system_prompt": system_prompt or "",
        "instructions": "",  # HCP-specific instructions (populated below)
    }

    # Check avatar availability
    avatar_config = await config_service.get_config(db, "azure_avatar")
    if avatar_config and avatar_config.is_active:
        avatar_key = await config_service.get_effective_key(db, "azure_avatar")
        result["avatar_enabled"] = bool(avatar_key)
        if avatar_config.model_or_deployment:
            result["avatar_character"] = avatar_config.model_or_deployment

    # Per-HCP profile overrides
    if hcp_profile_id:
        from app.services import hcp_profile_service

        try:
            profile = await hcp_profile_service.get_hcp_profile(db, hcp_profile_id)

            # Voice/avatar settings from HCP profile
            result["voice_name"] = profile.voice_name or "en-US-AvaNeural"
            result["voice_type"] = profile.voice_type or "azure-standard"
            result["avatar_character"] = profile.avatar_character or "lisa"
            result["avatar_style"] = profile.avatar_style or "casual"
            result["avatar_customized"] = profile.avatar_customized

            # Per-HCP model (Phase 13)
            result["model"] = getattr(profile, "voice_live_model", None) or "gpt-4o"

            # Instructions: use override if set, otherwise auto-generate from profile
            override = profile.agent_instructions_override or ""
            if override.strip():
                result["instructions"] = override.strip()
            else:
                from app.services.agent_sync_service import build_agent_instructions

                result["instructions"] = build_agent_instructions(profile.to_prompt_dict())
        except Exception:
            logger.warning("Failed to load HCP profile %s, using defaults", hcp_profile_id)

    return result


async def handle_voice_live_websocket(ws: WebSocket, db: AsyncSession) -> None:
    """Handle a Voice Live WebSocket connection — proxy between client and Azure.

    This is the main entry point called from the router.
    """
    await ws.accept()

    try:
        # Step 1: Wait for initial session.update from client
        first_msg_text = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
        first_msg = json.loads(first_msg_text)

        if first_msg.get("type") != SESSION_UPDATE_TYPE:
            await _send_error(ws, "First message must be session.update")
            return

        session_data = first_msg.get("session", {})
        hcp_profile_id = session_data.get("hcp_profile_id")
        system_prompt = session_data.get("system_prompt")

        logger.info("Voice Live WS: hcp_profile_id=%s", hcp_profile_id)

        # Step 2a: Check voice_live_enabled on the HCP profile (if provided)
        if hcp_profile_id:
            from app.services import hcp_profile_service

            try:
                profile = await hcp_profile_service.get_hcp_profile(db, hcp_profile_id)
                if not getattr(profile, "voice_live_enabled", True):
                    await _send_error(ws, "Voice Live is not enabled for this HCP profile")
                    return
            except Exception:
                # Profile not found — _load_connection_config will handle gracefully
                pass

        # Step 2b: Load config from DB
        try:
            cfg = await _load_connection_config(db, hcp_profile_id, system_prompt)
        except ValueError as e:
            await _send_error(ws, str(e))
            return

        # Step 3: Import SDK and connect to Azure
        try:
            from azure.ai.voicelive.aio import (
                ConnectionClosed,
                connect,
            )
            from azure.ai.voicelive.models import (
                AudioEchoCancellation,
                AudioInputTranscriptionOptions,
                AudioNoiseReduction,
                AvatarConfig,
                AzureSemanticVad,
                AzureStandardVoice,
                Modality,
                RequestSession,
                ServerEventType,
            )
            from azure.core.credentials import AzureKeyCredential
        except ImportError:
            await _send_error(ws, "azure-ai-voicelive SDK not installed")
            return

        credential = AzureKeyCredential(cfg["api_key"])

        # Build session config for model mode
        modalities = [Modality.TEXT, Modality.AUDIO]
        avatar_config_value = None
        if cfg["avatar_enabled"]:
            modalities.append(Modality.AVATAR)
            avatar_config_value = AvatarConfig(
                character=cfg["avatar_character"],
                style=cfg["avatar_style"] if cfg["avatar_style"] else None,
                customized=cfg["avatar_customized"],
            )

        session_config = RequestSession(
            modalities=modalities,
            turn_detection=AzureSemanticVad(type="azure_semantic_vad"),
            input_audio_noise_reduction=AudioNoiseReduction(type="azure_deep_noise_suppression"),
            input_audio_echo_cancellation=AudioEchoCancellation(type="server_echo_cancellation"),
            input_audio_transcription=AudioInputTranscriptionOptions(
                model="azure-fast-transcription",
            ),
            voice=AzureStandardVoice(name=cfg["voice_name"], type=cfg["voice_type"]),
            avatar=avatar_config_value,
        )

        # Voice Live uses model mode with the HCP profile's instructions.
        # Agent mode (agent-id query param) requires Azure AD/Entra ID auth
        # and is not available with API key — model mode gives equivalent results.
        model = cfg["model"] or "gpt-4o"
        instructions = cfg.get("instructions") or cfg.get("system_prompt")
        if instructions:
            session_config["instructions"] = instructions

        logger.info(
            "Voice Live connecting: endpoint=%s, model=%s, avatar=%s, has_instructions=%s",
            cfg["endpoint"],
            model,
            cfg["avatar_enabled"],
            bool(instructions),
        )

        async with connect(
            endpoint=cfg["endpoint"],
            credential=credential,
            model=model,
            api_version=AZURE_VOICE_API_VERSION,
        ) as azure_conn:
            await azure_conn.session.update(session=session_config)
            logger.info("Connected to Azure Voice Live")

            await ws.send_text(
                json.dumps(
                    {
                        "type": PROXY_CONNECTED_TYPE,
                        "message": "Connected to Azure Voice Live",
                        "avatar_enabled": cfg["avatar_enabled"],
                        "model": model,
                    }
                )
            )

            await _handle_message_forwarding(ws, azure_conn, ConnectionClosed, ServerEventType)

    except WebSocketDisconnect:
        logger.info("Client WebSocket disconnected")
    except TimeoutError:
        logger.warning("Timeout waiting for initial session.update")
        try:
            await _send_error(ws, "Timeout waiting for session.update")
        except Exception:
            pass
    except Exception as e:
        logger.error("Voice Live proxy error: %s", e, exc_info=True)
        try:
            await _send_error(ws, str(e))
        except Exception:
            pass


async def _handle_message_forwarding(
    ws: WebSocket,
    azure_conn: Any,
    ConnectionClosed: type,
    ServerEventType: Any,
) -> None:
    """Bidirectional message forwarding between client and Azure."""
    tasks = [
        asyncio.create_task(_forward_client_to_azure(ws, azure_conn, ConnectionClosed)),
        asyncio.create_task(
            _forward_azure_to_client(azure_conn, ws, ConnectionClosed, ServerEventType)
        ),
    ]

    _, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
    for task in pending:
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


async def _forward_client_to_azure(
    ws: WebSocket,
    azure_conn: Any,
    ConnectionClosed: type,
) -> None:
    """Forward messages from client WebSocket to Azure Voice Live SDK."""
    try:
        while True:
            message = await ws.receive_text()
            parsed = json.loads(message)
            msg_type = parsed.get("type", "unknown") if isinstance(parsed, dict) else "non-dict"
            logger.debug(
                "Client→Azure: type=%s, keys=%s",
                msg_type,
                list(parsed.keys()) if isinstance(parsed, dict) else "N/A",
            )
            if msg_type == "session.avatar.connect":
                logger.debug(
                    "Avatar SDP offer: has client_sdp=%s, len=%s",
                    "client_sdp" in parsed,
                    len(parsed.get("client_sdp", "")) if isinstance(parsed, dict) else 0,
                )
            await azure_conn.send(parsed)
    except (WebSocketDisconnect, ConnectionClosed):
        logger.debug("Client→Azure forwarding stopped")
    except Exception as e:
        logger.debug("Client→Azure forwarding error: %s", e)


async def _forward_azure_to_client(
    azure_conn: Any,
    ws: WebSocket,
    ConnectionClosed: type,
    ServerEventType: Any,
) -> None:
    """Forward events from Azure Voice Live SDK to client WebSocket."""
    try:
        async for event in azure_conn:
            event_dict = event.as_dict() if hasattr(event, "as_dict") else dict(event)
            message = json.dumps(event_dict)
            await ws.send_text(message)

            # Log key events
            if event.type == ServerEventType.ERROR:
                logger.warning("Azure error: %s", event_dict)
            elif event.type == ServerEventType.SESSION_CREATED:
                logger.info("Session created: %s", event_dict.get("session", {}).get("id"))
            elif event.type == ServerEventType.SESSION_UPDATED:
                logger.info("Session updated")
    except (WebSocketDisconnect, ConnectionClosed):
        logger.debug("Azure→Client forwarding stopped")
    except Exception as e:
        logger.debug("Azure→Client forwarding error: %s", e)


async def _send_error(ws: WebSocket, error_message: str) -> None:
    """Send error message to client."""
    try:
        await ws.send_text(
            json.dumps(
                {
                    "type": ERROR_TYPE,
                    "error": {"message": error_message},
                }
            )
        )
    except Exception:
        pass
