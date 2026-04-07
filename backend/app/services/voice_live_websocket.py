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
import time
import uuid
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import config_service

logger = logging.getLogger(__name__)

# API version matching the reference implementation
AZURE_VOICE_API_VERSION = "2025-05-01-preview"

# Message types
SESSION_UPDATE_TYPE = "session.update"
PROXY_CONNECTED_TYPE = "proxy.connected"
ERROR_TYPE = "error"


async def _load_connection_config(
    db: AsyncSession,
    hcp_profile_id: str | None = None,
    system_prompt: str | None = None,
    vl_instance_id: str | None = None,
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

    # Use the endpoint as-is — azure-ai-voicelive SDK works directly with
    # services.ai.azure.com endpoints. No domain conversion needed.
    effective_endpoint = raw_endpoint.rstrip("/")

    # Defaults — always MODEL MODE.
    # Agent mode requires Azure AD/Entra ID auth which is not available in
    # API-key-based deployments. Model mode is equivalent: the HCP personality
    # is conveyed through the instructions field.
    # The config-level model_or_deployment is an admin-configured Azure deployment
    # name (e.g. "gpt-4o-realtime-preview") — pass it through without validation.
    # VOICE_LIVE_MODELS is only for the HCP-level UI dropdown selection.
    from app.config import get_settings

    _default_model = get_settings().voice_live_default_model
    vl_model = vl_config.model_or_deployment or _default_model

    result: dict[str, Any] = {
        "endpoint": effective_endpoint,
        "api_key": api_key,
        "model": vl_model,
        "voice_name": "zh-CN-XiaoxiaoMultilingualNeural",
        "voice_type": "azure-standard",
        "avatar_character": "lisa",
        "avatar_style": "casual-sitting",
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

    # Per-HCP profile overrides — config resolution: VoiceLiveInstance > inline fields
    if hcp_profile_id:
        from app.services import hcp_profile_service
        from app.services.voice_live_instance_service import resolve_voice_config

        try:
            profile = await hcp_profile_service.get_hcp_profile(db, hcp_profile_id)
            vc = resolve_voice_config(profile)

            # Voice/avatar settings from resolved config
            result["voice_name"] = vc["voice_name"] or "en-US-AvaNeural"
            result["voice_type"] = vc["voice_type"] or "azure-standard"

            char_id = vc["avatar_character"] or "lisa"
            raw_style = vc["avatar_style"] or "casual-sitting"
            result["avatar_character"] = char_id
            result["avatar_customized"] = vc["avatar_customized"]

            # Validate avatar style against known characters; fallback to default
            from app.services.avatar_characters import validate_avatar_style

            validated = validate_avatar_style(char_id, raw_style)
            if validated is not None and validated != raw_style:
                logger.warning(
                    "Avatar style %r invalid for %s, using %r",
                    raw_style,
                    char_id,
                    validated,
                )
            result["avatar_style"] = validated if validated is not None else raw_style

            # Per-HCP model — validate it's Voice Live compatible (UI selection list)
            from app.services.voice_live_models import VOICE_LIVE_MODELS

            hcp_model = vc["voice_live_model"] or _default_model
            if hcp_model.lower() not in VOICE_LIVE_MODELS:
                logger.warning(
                    "HCP %s voice_live_model %r not supported, using %s",
                    hcp_profile_id,
                    hcp_model,
                    _default_model,
                )
                hcp_model = _default_model
            result["model"] = hcp_model

            # Instructions priority for HCP mode:
            #   1. HCP profile's own agent_instructions_override (admin-set override)
            #   2. Client-sent system_prompt (frontend auto-generated from profile data)
            #   3. Auto-generated from build_agent_instructions(profile)
            # NOTE: VL Instance's model_instruction is NOT used here —
            # VL Instance only provides voice/avatar config, not agent personality.
            hcp_override = profile.agent_instructions_override or ""
            if hcp_override.strip():
                result["instructions"] = hcp_override.strip()
            elif system_prompt and system_prompt.strip():
                result["instructions"] = system_prompt.strip()
            else:
                from app.services.agent_sync_service import build_agent_instructions

                result["instructions"] = build_agent_instructions(profile.to_prompt_dict())
        except Exception:
            logger.warning(
                "Failed to load HCP profile %s, using defaults",
                hcp_profile_id,
                exc_info=True,
            )

    elif vl_instance_id:
        # Standalone VL Instance test — no HCP, use instance config directly
        from app.services.voice_live_instance_service import get_instance

        try:
            inst = await get_instance(db, vl_instance_id)

            result["voice_name"] = inst.voice_name or "en-US-AvaNeural"
            result["voice_type"] = inst.voice_type or "azure-standard"

            char_id = inst.avatar_character or "lisa"
            raw_style = inst.avatar_style or "casual-sitting"
            result["avatar_character"] = char_id
            result["avatar_customized"] = inst.avatar_customized

            from app.services.avatar_characters import validate_avatar_style

            validated = validate_avatar_style(char_id, raw_style)
            if validated is not None and validated != raw_style:
                logger.warning(
                    "Avatar style %r invalid for %s, using %r",
                    raw_style,
                    char_id,
                    validated,
                )
            result["avatar_style"] = validated if validated is not None else raw_style

            from app.services.voice_live_models import VOICE_LIVE_MODELS

            inst_model = inst.voice_live_model or _default_model
            if inst_model.lower() not in VOICE_LIVE_MODELS:
                logger.warning(
                    "VL Instance %s voice_live_model %r not supported, using %s",
                    vl_instance_id,
                    inst_model,
                    _default_model,
                )
                inst_model = _default_model
            result["model"] = inst_model

            # Use model_instruction as instructions for standalone VL test
            override = inst.model_instruction or ""
            if override.strip():
                result["instructions"] = override.strip()

            # Avatar enabled from instance
            result["avatar_enabled"] = inst.avatar_enabled and result["avatar_enabled"]
        except Exception:
            logger.warning(
                "Failed to load VL Instance %s, using defaults",
                vl_instance_id,
                exc_info=True,
            )

    return result


async def handle_voice_live_websocket(ws: WebSocket, db: AsyncSession) -> None:
    """Handle a Voice Live WebSocket connection — proxy between client and Azure.

    This is the main entry point called from the router.
    """
    # Session correlation ID — from frontend query param or auto-generated
    sid = ws.query_params.get("sid", "") or uuid.uuid4().hex[:8]
    session_log = logging.LoggerAdapter(logger, {"sid": sid})
    event_counts: dict[str, int] = {}
    start_time = time.monotonic()

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
        vl_instance_id = session_data.get("vl_instance_id")

        session_log.info(
            "Session started: sid=%s, hcp=%s, vl_instance=%s",
            sid, hcp_profile_id, vl_instance_id,
        )

        # Step 2a: Check voice_live_enabled on the HCP profile (if provided)
        if hcp_profile_id:
            from app.services import hcp_profile_service

            try:
                profile = await hcp_profile_service.get_hcp_profile(db, hcp_profile_id)
                if not getattr(profile, "voice_live_enabled", True):
                    await _send_error(ws, "Voice Live is not enabled for this HCP profile")
                    return
            except Exception:
                session_log.warning(
                    "Failed to check voice_live_enabled for %s, proceeding",
                    hcp_profile_id,
                    exc_info=True,
                )

        # Step 2b: Load config from DB
        try:
            cfg = await _load_connection_config(
                db, hcp_profile_id, system_prompt, vl_instance_id,
            )
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
                VideoParams,
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

            # Distinguish photo avatars (VASA-1) vs video avatars
            from app.services.avatar_characters import (
                is_photo_avatar as _is_photo,
            )
            from app.services.avatar_characters import (
                validate_avatar_style,
            )

            char_id = cfg["avatar_character"]
            style = cfg["avatar_style"]

            if _is_photo(char_id):
                # Photo avatar: use dict format with VASA-1 model, no style
                avatar_config_value = {
                    "type": "photo-avatar",
                    "model": "vasa-1",
                    "character": char_id,
                    "customized": False,
                }
                session_log.info("Using photo avatar (VASA-1): character=%s", char_id)
            else:
                # Video avatar: validate style, fallback to default if invalid
                validated_style = validate_avatar_style(char_id, style)
                if validated_style is not None and validated_style != style:
                    session_log.warning(
                        "Avatar style %r not valid for %s, falling back to %r",
                        style,
                        char_id,
                        validated_style,
                    )
                    style = validated_style

                avatar_config_value = AvatarConfig(
                    character=char_id,
                    style=style if style else None,
                    customized=cfg["avatar_customized"],
                    video=VideoParams(codec="h264"),
                )
                # Enable audio output through WebRTC audio track.
                # Without this, Azure renders lip-sync but does NOT send
                # TTS audio on the WebRTC audio track (output_audit_audio=false).
                avatar_config_value["output_audit_audio"] = True
                session_log.info(
                    "Using video avatar: character=%s, style=%s, output_audit_audio=True",
                    char_id,
                    style,
                )

        # Enable input_audio_transcription so Azure sends
        # conversation.item.input_audio_transcription.completed events,
        # which provide user speech-to-text for the transcript display.
        session_config = RequestSession(
            modalities=modalities,
            turn_detection=AzureSemanticVad(type="azure_semantic_vad"),
            input_audio_noise_reduction=AudioNoiseReduction(type="azure_deep_noise_suppression"),
            input_audio_echo_cancellation=AudioEchoCancellation(type="server_echo_cancellation"),
            input_audio_transcription=AudioInputTranscriptionOptions(
                model="azure-fast-transcription",
            ),
            voice=AzureStandardVoice(name=cfg["voice_name"], type=cfg["voice_type"]),
            avatar=avatar_config_value,  # type: ignore[arg-type] — dict for photo avatars
        )

        from app.config import get_settings as _get_settings

        model = cfg["model"] or _get_settings().voice_live_default_model
        instructions = cfg.get("instructions") or cfg.get("system_prompt")
        if instructions:
            session_config["instructions"] = instructions

        # Always use MODEL MODE — agent mode requires Azure AD/Entra ID auth
        # which is not available in API-key-based deployments.
        # HCP personality is conveyed via the instructions field.
        # Log the full session config for debugging
        session_dict = (
            session_config.as_dict() if hasattr(session_config, "as_dict") else dict(session_config)
        )
        session_log.info(
            "Voice Live connecting (model mode): endpoint=%s, "
            "model=%s, avatar=%s, has_instructions=%s, "
            "session_modalities=%s, session_voice=%s, "
            "session_avatar_type=%s",
            cfg["endpoint"],
            model,
            cfg["avatar_enabled"],
            bool(instructions),
            session_dict.get("modalities"),
            session_dict.get("voice"),
            type(session_config.get("avatar")).__name__
            if session_config.get("avatar") is not None
            else "None",
        )

        async with connect(
            endpoint=cfg["endpoint"],
            credential=credential,
            model=model,
            api_version=AZURE_VOICE_API_VERSION,
        ) as azure_conn:
            await azure_conn.session.update(session=session_config)
            session_log.info("Connected to Azure Voice Live, session config sent")

            await ws.send_text(
                json.dumps(
                    {
                        "type": PROXY_CONNECTED_TYPE,
                        "message": "Connected to Azure Voice Live",
                        "avatar_enabled": cfg["avatar_enabled"],
                        "model": model,
                        "session_id": sid,
                    }
                )
            )

            await _handle_message_forwarding(
                ws,
                azure_conn,
                ConnectionClosed,
                ServerEventType,
                session_log,
                event_counts,
            )

    except WebSocketDisconnect:
        session_log.info("Client WebSocket disconnected")
    except TimeoutError:
        session_log.warning("Timeout waiting for initial session.update")
        try:
            await _send_error(ws, "Timeout waiting for session.update")
        except Exception:
            pass
    except Exception as e:
        session_log.error("Voice Live proxy error: %s", e, exc_info=True)
        try:
            await _send_error(ws, str(e))
        except Exception:
            pass
    finally:
        session_log.info(
            "Session ended: sid=%s, duration=%.1fs, events=%s",
            sid,
            round(time.monotonic() - start_time, 1),
            json.dumps(event_counts, separators=(",", ":")),
        )


async def _handle_message_forwarding(
    ws: WebSocket,
    azure_conn: Any,
    ConnectionClosed: type,
    ServerEventType: Any,
    session_log: logging.LoggerAdapter,
    event_counts: dict[str, int],
) -> None:
    """Bidirectional message forwarding between client and Azure."""
    tasks = [
        asyncio.create_task(
            _forward_client_to_azure(
                ws,
                azure_conn,
                ConnectionClosed,
                session_log,
                event_counts,
            )
        ),
        asyncio.create_task(
            _forward_azure_to_client(
                azure_conn,
                ws,
                ConnectionClosed,
                ServerEventType,
                session_log,
                event_counts,
            )
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
    session_log: logging.LoggerAdapter,
    event_counts: dict[str, int],
) -> None:
    """Forward messages from client WebSocket to Azure Voice Live SDK."""
    try:
        while True:
            message = await ws.receive_text()
            parsed = json.loads(message)
            msg_type = parsed.get("type", "unknown") if isinstance(parsed, dict) else "non-dict"
            event_counts[f"c2a:{msg_type}"] = event_counts.get(f"c2a:{msg_type}", 0) + 1
            session_log.debug(
                "Client→Azure: type=%s, keys=%s",
                msg_type,
                list(parsed.keys()) if isinstance(parsed, dict) else "N/A",
            )
            if msg_type == "session.avatar.connect":
                session_log.info(
                    "Avatar SDP offer: has client_sdp=%s, len=%s",
                    "client_sdp" in parsed,
                    len(parsed.get("client_sdp", "")) if isinstance(parsed, dict) else 0,
                )
            await azure_conn.send(parsed)
    except (WebSocketDisconnect, ConnectionClosed):
        session_log.debug("Client→Azure forwarding stopped")
    except Exception as e:
        session_log.warning("Client→Azure forwarding error: %s", e)


async def _forward_azure_to_client(
    azure_conn: Any,
    ws: WebSocket,
    ConnectionClosed: type,
    ServerEventType: Any,
    session_log: logging.LoggerAdapter,
    event_counts: dict[str, int],
) -> None:
    """Forward events from Azure Voice Live SDK to client WebSocket."""
    try:
        async for event in azure_conn:
            event_dict = event.as_dict() if hasattr(event, "as_dict") else dict(event)
            event_type = event_dict.get("type", "unknown")
            event_counts[f"a2c:{event_type}"] = event_counts.get(f"a2c:{event_type}", 0) + 1

            # Debug: log audio delta events to verify serialization
            if event_type == "response.audio.delta":
                has_delta = "delta" in event_dict
                delta_len = len(event_dict.get("delta", "")) if has_delta else 0
                session_log.debug(
                    "Audio delta: has_delta=%s, delta_len=%d, keys=%s",
                    has_delta,
                    delta_len,
                    list(event_dict.keys()),
                )
            # Avatar SDP answer — promote to INFO for observability
            elif event_type == "session.avatar.connecting":
                session_log.info(
                    "Avatar SDP answer: type=%s, has_server_sdp=%s, keys=%s",
                    event_type,
                    "server_sdp" in event_dict,
                    list(event_dict.keys()),
                )
            # Other avatar-related events
            elif "avatar" in event_type or "sdp" in str(event_dict.get("server_sdp", "")):
                session_log.info(
                    "Avatar event: type=%s, has_server_sdp=%s, keys=%s",
                    event_type,
                    "server_sdp" in event_dict,
                    list(event_dict.keys()),
                )

            message = json.dumps(event_dict)
            await ws.send_text(message)

            # Log key events
            if event.type == ServerEventType.ERROR:
                session_log.warning("Azure error: %s", event_dict)
            elif event.type == ServerEventType.SESSION_CREATED:
                session_log.info("Session created: %s", event_dict.get("session", {}).get("id"))
            elif event.type == ServerEventType.SESSION_UPDATED:
                # Detailed logging for avatar debugging
                sess = event_dict.get("session", {})
                avatar_cfg = sess.get("avatar", {})
                modalities = sess.get("modalities", [])
                voice_cfg = sess.get("voice", {})
                ice_servers = avatar_cfg.get("ice_servers", [])
                session_log.info(
                    "Session updated: modalities=%s, voice=%s, "
                    "avatar_keys=%s, ice_servers=%d, "
                    "has_avatar_username=%s, has_avatar_credential=%s, "
                    "avatar_output_protocol=%s, avatar_model=%s, "
                    "avatar_video=%s, avatar_scene=%s",
                    modalities,
                    voice_cfg,
                    list(avatar_cfg.keys()),
                    len(ice_servers),
                    "username" in avatar_cfg or "ice_username" in avatar_cfg,
                    "credential" in avatar_cfg or "ice_credential" in avatar_cfg,
                    avatar_cfg.get("output_protocol"),
                    avatar_cfg.get("model"),
                    avatar_cfg.get("video"),
                    avatar_cfg.get("scene"),
                )
            else:
                session_log.debug("Azure event: type=%s", event_type)
    except (WebSocketDisconnect, ConnectionClosed):
        session_log.debug("Azure→Client forwarding stopped")
    except Exception as e:
        session_log.warning("Azure→Client forwarding error: %s", e)


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
