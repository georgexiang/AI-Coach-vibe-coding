"""CU Voice Evaluation Service: Azure Content Understanding voice scoring pipeline.

Handles voice quality scoring via Azure CU audioAnalyzer and score merging.
Content scoring is handled by scoring_engine.py (LLM-based).

Key decisions:
- D-09: Rubric save triggers CU voice analyzer sync
- D-11: Layered merge using content_weight/voice_weight from rubric
- D-13: Text-only sessions only get content scoring (no CU involvement)
- D-14: Voice sessions get voice scoring via CU audioAnalyzer
- D-16: Voice sessions use CU re-transcription via voice analyzer
"""

import asyncio
import base64
import json
import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scoring_rubric import ScoringRubric
from app.services import config_service

logger = logging.getLogger(__name__)

# CU API configuration
CU_API_VERSION = "2025-05-01-preview"
MAX_POLL_ATTEMPTS = 60
POLL_INTERVAL_SECONDS = 2.0
REQUEST_TIMEOUT = 30.0

# Service name for config lookup
CU_SERVICE_NAME = "content_understanding"

# Azure Cognitive Services scope for Entra ID token
_COGNITIVE_SERVICES_SCOPE = "https://cognitiveservices.azure.com/.default"


async def _get_auth_headers(api_key: str) -> dict[str, str]:
    """Get authentication headers with Entra ID preferred, API Key fallback."""
    try:
        from azure.identity.aio import DefaultAzureCredential

        credential = DefaultAzureCredential()
        try:
            token = await credential.get_token(_COGNITIVE_SERVICES_SCOPE)
            logger.debug("CU auth: using Entra ID token (DefaultAzureCredential)")
            return {
                "Authorization": f"Bearer {token.token}",
                "Content-Type": "application/json",
            }
        finally:
            await credential.close()
    except Exception as exc:
        logger.debug("CU auth: DefaultAzureCredential unavailable (%s), trying API Key", exc)

    if api_key:
        logger.debug("CU auth: using API Key")
        return {
            "Ocp-Apim-Subscription-Key": api_key,
            "Content-Type": "application/json",
        }

    raise RuntimeError("No CU credentials available: Entra ID failed and no API Key configured")


# Default voice dimensions if rubric doesn't specify voice-specific ones
DEFAULT_VOICE_DIMENSIONS = [
    {"name": "fluency", "weight": 30, "criteria": ["Smooth speech flow"], "max_score": 100},
    {"name": "tone", "weight": 25, "criteria": ["Professional tone"], "max_score": 100},
    {"name": "pace", "weight": 25, "criteria": ["Appropriate speaking pace"], "max_score": 100},
    {
        "name": "pronunciation",
        "weight": 20,
        "criteria": ["Clear pronunciation"],
        "max_score": 100,
    },
]


def build_voice_analyzer_schema(rubric_dimensions: list[dict]) -> dict:
    """Build voice-specific CU fieldSchema for voice quality evaluation."""
    voice_dims = rubric_dimensions if rubric_dimensions else DEFAULT_VOICE_DIMENSIONS
    fields: dict[str, dict] = {}

    for dim in voice_dims:
        dim_name = dim.get("name", "unknown").lower().replace(" ", "_")
        fields[dim_name] = {
            "type": "string",
            "method": "generate",
            "description": (
                f"JSON object with score (0-{dim.get('max_score', 100)}) and feedback "
                f"for voice quality dimension '{dim.get('name', '')}' "
                f"(weight: {dim.get('weight', 0)}%)"
            ),
        }

    fields["feedback_summary"] = {
        "type": "string",
        "method": "generate",
        "description": "Overall voice quality feedback summary",
    }

    fields["transcript"] = {
        "type": "string",
        "method": "generate",
        "description": "Re-transcription of the audio content",
    }

    return {"name": "VoiceScoring", "fields": fields}


async def sync_rubric_analyzers(db: AsyncSession, rubric: ScoringRubric) -> None:
    """Create or update CU voice analyzer when rubric is saved.

    Content scoring uses LLM, so only voice analyzer is managed here.
    If CU endpoint not configured, logs warning and skips (graceful degradation).
    """
    endpoint = await config_service.get_effective_endpoint(db, CU_SERVICE_NAME)
    api_key = await config_service.get_effective_key(db, CU_SERVICE_NAME)

    if not endpoint or not api_key:
        logger.warning(
            "CU endpoint/key not configured; skipping analyzer sync for rubric %s", rubric.id
        )
        return

    endpoint = endpoint.rstrip("/")
    rubric_id_short = rubric.id[:8].replace("-", "")

    # Voice analyzer only (content scoring handled by LLM)
    voice_analyzer_id = f"rubricVoice{rubric_id_short}"
    voice_schema = build_voice_analyzer_schema(DEFAULT_VOICE_DIMENSIONS)
    await _put_analyzer(endpoint, api_key, voice_analyzer_id, voice_schema, "voice")

    # Deprecate content analyzer, keep voice analyzer
    rubric.cu_content_analyzer_id = None  # type: ignore[attr-defined]
    rubric.cu_voice_analyzer_id = voice_analyzer_id  # type: ignore[attr-defined]
    await db.flush()

    logger.info(
        "Synced CU voice analyzer for rubric %s: voice=%s",
        rubric.id,
        voice_analyzer_id,
    )


async def _put_analyzer(
    endpoint: str,
    api_key: str,
    analyzer_id: str,
    field_schema: dict,
    analyzer_type: str,
) -> None:
    """PUT a CU custom analyzer definition. Creates or updates."""
    url = f"{endpoint}/contentunderstanding/analyzers/{analyzer_id}?api-version={CU_API_VERSION}"
    headers = await _get_auth_headers(api_key)
    base_analyzer = (
        "prebuilt-audioAnalyzer" if analyzer_type == "voice" else "prebuilt-documentAnalyzer"
    )
    body = {
        "description": f"Auto-generated {analyzer_type} scoring analyzer",
        "baseAnalyzerId": base_analyzer,
        "fieldSchema": field_schema,
    }

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.put(url, headers=headers, json=body)

        if response.status_code in (200, 201):
            logger.info("CU analyzer %s created/updated successfully", analyzer_id)
        else:
            logger.error(
                "CU analyzer PUT failed for %s: HTTP %d - %s",
                analyzer_id,
                response.status_code,
                response.text[:500],
            )
            raise RuntimeError(
                f"CU analyzer creation failed: HTTP {response.status_code} - {response.text[:500]}"
            )


async def score_voice_with_cu(
    endpoint: str,
    api_key: str,
    analyzer_id: str,
    audio_url: str,
) -> dict:
    """Submit audio to CU voice analyzer and poll for results.

    Supports URL-based submission for Azure Blob storage audio,
    or base64 fallback for local development.
    Returns raw CU fields dict for parsing by _parse_cu_voice_result.
    """
    endpoint = endpoint.rstrip("/")
    url = (
        f"{endpoint}/contentunderstanding/analyzers/{analyzer_id}:analyze"
        f"?api-version={CU_API_VERSION}"
    )
    headers = await _get_auth_headers(api_key)

    if audio_url.startswith(("http://", "https://")):
        body: dict = {"url": audio_url}
    else:
        try:
            with open(audio_url, "rb") as f:
                audio_bytes = f.read()
            b64_audio = base64.b64encode(audio_bytes).decode("utf-8")
            body = {"data": b64_audio}
        except (FileNotFoundError, OSError) as e:
            raise RuntimeError(f"Failed to read local audio file: {e}") from e

    logger.info("Submitting voice scoring to CU analyzer %s", analyzer_id)

    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        response = await client.post(url, headers=headers, json=body)

        if response.status_code != 202:
            logger.error(
                "CU voice scoring submit failed: HTTP %d - %s",
                response.status_code,
                response.text[:200],
            )
            raise RuntimeError(f"CU voice scoring submission failed: HTTP {response.status_code}")

        operation_url = response.headers.get("Operation-Location", "")
        if not operation_url:
            raise RuntimeError("No Operation-Location header in CU voice scoring response")

        return await _poll_result(client, operation_url, headers)


async def _poll_result(
    client: httpx.AsyncClient, operation_url: str, auth_headers: dict[str, str]
) -> dict:
    """Poll CU operation until Succeeded, Failed, or timeout."""
    poll_headers = {k: v for k, v in auth_headers.items() if k != "Content-Type"}

    for _attempt in range(MAX_POLL_ATTEMPTS):
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
        poll_response = await client.get(operation_url, headers=poll_headers)
        poll_data = poll_response.json()

        status = poll_data.get("status", "").lower()
        if status == "succeeded":
            result = poll_data.get("result", {})
            contents = result.get("contents", [])
            if contents:
                return contents[0].get("fields", {})
            return result.get("fields", {})
        if status in ("failed", "cancelled"):
            error_msg = poll_data.get("error", {}).get("message", "Unknown error")
            raise RuntimeError(f"CU analysis {status}: {error_msg}")

    raise RuntimeError(f"CU analysis timed out after {MAX_POLL_ATTEMPTS * POLL_INTERVAL_SECONDS}s")


def merge_scores(
    content_scores: dict,
    voice_scores: dict | None,
    content_weight: int,
    voice_weight: int,
) -> dict:
    """Perform layered score merge using content_weight/voice_weight from rubric.

    - If voice_scores is None, final score = content only (100% weight).
    - If voice_scores present, apply weighted combination.
    """
    content_dims = content_scores.get("dimensions", [])
    content_total = _calculate_weighted_total(content_dims)
    feedback_summary = content_scores.get("feedback_summary", "")

    if voice_scores is None:
        return {
            "overall_score": content_total,
            "content_total": content_total,
            "voice_total": None,
            "dimensions": content_dims,
            "feedback_summary": feedback_summary,
        }

    voice_dims = voice_scores.get("dimensions", [])
    voice_total = _calculate_weighted_total(voice_dims)
    voice_feedback = voice_scores.get("feedback_summary", "")

    total_weight = content_weight + voice_weight
    if total_weight == 0:
        total_weight = 100

    content_ratio = content_weight / total_weight
    voice_ratio = voice_weight / total_weight
    overall_score = (content_total * content_ratio) + (voice_total * voice_ratio)

    all_dimensions = content_dims + [{**d, "category": "voice"} for d in voice_dims]

    combined_feedback = feedback_summary
    if voice_feedback:
        combined_feedback = f"{feedback_summary}\n\nVoice: {voice_feedback}"

    return {
        "overall_score": round(overall_score, 2),
        "content_total": content_total,
        "voice_total": voice_total,
        "dimensions": all_dimensions,
        "feedback_summary": combined_feedback.strip(),
    }


def _calculate_weighted_total(dimensions: list[dict]) -> float:
    """Calculate weighted average score from dimension list."""
    if not dimensions:
        return 0.0

    total_weight = sum(d.get("weight", 0) for d in dimensions)
    if total_weight == 0:
        return sum(d.get("score", 0) for d in dimensions) / len(dimensions)

    weighted_sum = sum(d.get("score", 0) * d.get("weight", 0) for d in dimensions)
    return round(weighted_sum / total_weight, 2)


def _parse_cu_voice_result(cu_fields: dict) -> dict:
    """Parse CU voice analyzer result into standardized scoring format."""
    dimensions = []
    excluded_keys = {"feedback_summary", "transcript"}

    for key, value in cu_fields.items():
        if key in excluded_keys:
            continue
        parsed_value = _extract_cu_field_value(value)
        if isinstance(parsed_value, dict) and "score" in parsed_value:
            dimensions.append(
                {
                    "name": key,
                    "score": parsed_value.get("score", 0),
                    "weight": 25,
                    "feedback": parsed_value.get("feedback", ""),
                }
            )

    feedback_raw = cu_fields.get("feedback_summary", "")
    feedback_summary = _extract_cu_field_value(feedback_raw)
    if isinstance(feedback_summary, dict):
        feedback_summary = feedback_summary.get("value", "")

    return {
        "dimensions": dimensions,
        "feedback_summary": str(feedback_summary) if feedback_summary else "",
    }


def _extract_cu_field_value(field: object) -> object:
    """Extract the actual value from a CU field response.

    CU fields come back as {"type": "string", "valueString": "..."}.
    The valueString may itself be JSON that needs parsing.
    """
    if not isinstance(field, dict):
        return field

    value_string = field.get("valueString")
    if value_string is not None:
        if isinstance(value_string, str):
            try:
                return json.loads(value_string)
            except (json.JSONDecodeError, ValueError):
                return value_string
        return value_string

    if "score" in field:
        return field

    return field


async def _get_session_rubric(db: AsyncSession, scenario: object) -> ScoringRubric | None:
    """Get the rubric associated with a scenario."""
    rubric_id = getattr(scenario, "rubric_id", None)
    if not rubric_id:
        return None

    result = await db.execute(select(ScoringRubric).where(ScoringRubric.id == rubric_id))
    return result.scalar_one_or_none()
