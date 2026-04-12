"""Agent-based Skill Creator service.

Replaces the brittle text-extraction pipeline with an Azure Agent call.
The creator agent (configured via meta_skill_service) processes source materials
and returns structured skill content.

Reuses the same AIProjectClient / Responses API pattern as agent_chat_service.
"""

import json
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.skill import Skill, SkillResource
from app.services import meta_skill_service, skill_service
from app.services.skill_text_extractor import convert_to_markdown, extract_text
from app.services.storage import get_storage

logger = logging.getLogger(__name__)

MAX_MATERIAL_LENGTH = 500_000  # ~125K tokens safety limit


@dataclass
class CreationResult:
    """Result from agent-based skill creation."""

    skill_id: str = ""
    name: str = ""
    status: str = "pending"  # "success" | "error" | "pending"
    agent_id: str = ""
    agent_version: str = ""
    model_used: str = ""
    summary: str = ""
    error_detail: str = ""
    raw_response: str = ""


# ---------------------------------------------------------------------------
# Material text collection
# ---------------------------------------------------------------------------


async def _collect_material_texts(
    db: AsyncSession, skill_id: str
) -> list[tuple[str, str]]:
    """Collect (filename, text) pairs from skill reference resources.

    First tries already-extracted text_content. If empty, reads the file
    from storage and extracts text on the fly.
    """
    result = await db.execute(
        select(SkillResource).where(
            SkillResource.skill_id == skill_id,
            SkillResource.resource_type == "reference",
        )
    )
    resources = list(result.scalars().all())
    if not resources:
        return []

    storage = get_storage()
    texts: list[tuple[str, str]] = []

    for resource in resources:
        text = resource.text_content or ""

        if not text and resource.storage_path:
            try:
                file_content = await storage.read(resource.storage_path)
                text = extract_text(file_content, resource.filename)
                # Cache for future use
                resource.text_content = text
                resource.extraction_status = "completed"
            except Exception as exc:
                logger.warning(
                    "Text extraction failed for resource %s: %s",
                    resource.id,
                    exc,
                )
                continue

        if text:
            md = convert_to_markdown(text, resource.filename)
            texts.append((resource.filename, md))

    await db.flush()
    return texts


# ---------------------------------------------------------------------------
# Agent call
# ---------------------------------------------------------------------------


async def _call_creator_agent(
    db: AsyncSession,
    materials_text: str,
    agent_id: str,
    agent_version: str,
    model: str,
) -> CreationResult:
    """Call the creator agent via Responses API to generate a skill.

    Reuses the exact same pattern as agent_chat_service.chat_with_agent().
    """
    from app.services.agent_sync_service import (
        _get_project_client,
        get_project_endpoint,
    )

    project_endpoint, api_key = await get_project_endpoint(db)
    client = _get_project_client(project_endpoint, api_key)
    openai_client = client.get_openai_client()

    input_messages = [{"role": "user", "content": materials_text}]

    extra_body = {
        "agent_reference": {
            "name": agent_id,
            "version": agent_version or "1",
            "type": "agent_reference",
        }
    }

    logger.info(
        "call_creator_agent: endpoint=%s, agent=%s, version=%s, model=%s",
        project_endpoint,
        agent_id,
        agent_version,
        model,
    )

    try:
        response = openai_client.responses.create(
            model=model,
            input=input_messages,
            extra_body=extra_body,
        )
        return CreationResult(
            status="success",
            agent_id=agent_id,
            agent_version=agent_version,
            model_used=model,
            raw_response=response.output_text,
        )
    except Exception as e:
        logger.error("call_creator_agent failed: %s", e)
        return CreationResult(
            status="error",
            agent_id=agent_id,
            agent_version=agent_version,
            model_used=model,
            error_detail=str(e),
        )


async def _call_direct_openai(
    db: AsyncSession,
    materials_text: str,
    template_content: str,
    model: str,
) -> CreationResult:
    """Fallback: call OpenAI directly when no agent is synced.

    Uses the same config_service pattern as skill_evaluation_service.
    """
    from app.services import config_service

    try:
        from openai import AsyncAzureOpenAI
    except ImportError:
        return CreationResult(
            status="error",
            model_used=model,
            error_detail="openai package not installed",
        )

    try:
        endpoint = await config_service.get_effective_endpoint(db, "azure_openai")
        api_key = await config_service.get_effective_key(db, "azure_openai")

        if not endpoint or not api_key:
            return CreationResult(
                status="error",
                model_used=model,
                error_detail="Azure OpenAI not configured",
            )

        client = AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version="2024-12-01-preview",
        )

        response = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": template_content},
                {"role": "user", "content": materials_text},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        content = response.choices[0].message.content or ""
        return CreationResult(
            status="success",
            model_used=model,
            raw_response=content,
        )
    except Exception as e:
        logger.error("call_direct_openai failed: %s", e)
        return CreationResult(
            status="error",
            model_used=model,
            error_detail=str(e),
        )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


async def create_skill_via_agent(
    db: AsyncSession,
    skill_id: str,
) -> CreationResult:
    """Create skill content using the configured creator meta-skill agent.

    1. Loads material texts from the skill's reference resources
    2. Gets the creator meta skill config
    3. Calls the Azure Agent (or falls back to direct OpenAI)
    4. Parses the response and updates the skill record

    The skill must already exist with resources attached.
    """
    # Step 1: Collect material texts
    texts = await _collect_material_texts(db, skill_id)
    if not texts:
        return CreationResult(
            skill_id=skill_id,
            status="error",
            error_detail="No text could be extracted from reference materials",
        )

    materials_text = "\n\n---\n\n".join(
        f"## {filename}\n\n{content}" for filename, content in texts
    )

    # Truncate if needed
    if len(materials_text) > MAX_MATERIAL_LENGTH:
        logger.warning("Materials text truncated from %d to %d chars", len(materials_text), MAX_MATERIAL_LENGTH)
        materials_text = materials_text[:MAX_MATERIAL_LENGTH]

    # Step 2: Get creator config
    meta = await meta_skill_service.get_meta_skill(db, "creator")
    if not meta:
        return CreationResult(
            skill_id=skill_id,
            status="error",
            error_detail="Skill Creator not configured. Set up via Admin > Meta Skills.",
        )

    # Step 3: Call agent or fallback
    if meta.agent_id:
        result = await _call_creator_agent(
            db, materials_text, meta.agent_id, meta.agent_version, meta.model
        )
    else:
        result = await _call_direct_openai(
            db, materials_text, meta.template_content, meta.model
        )

    result.skill_id = skill_id

    # Step 4: Parse response and update skill
    if result.status == "success" and result.raw_response:
        try:
            parsed = _parse_creator_response(result.raw_response)
            skill = await skill_service.get_skill(db, skill_id)

            # Update skill with generated content
            if parsed.get("name"):
                skill.name = parsed["name"]
                result.name = parsed["name"]
            if parsed.get("description"):
                skill.description = parsed["description"]
            if parsed.get("product"):
                skill.product = parsed["product"]
            if parsed.get("therapeutic_area"):
                skill.therapeutic_area = parsed["therapeutic_area"]

            # Store the full response as content
            skill.content = result.raw_response
            skill.conversion_status = "completed"
            skill.conversion_error = ""

            # Store audit trail in metadata
            meta_json = json.loads(skill.metadata_json or "{}")
            meta_json["creation_audit"] = {
                "agent_id": result.agent_id,
                "agent_version": result.agent_version,
                "model": result.model_used,
                "created_at": datetime.now(UTC).isoformat(),
                "method": "agent" if meta.agent_id else "direct_openai",
            }
            skill.metadata_json = json.dumps(meta_json, ensure_ascii=False)

            result.summary = parsed.get("summary", "")
            await db.flush()
        except Exception as e:
            logger.error("Failed to parse creator response: %s", e)
            result.status = "error"
            result.error_detail = f"Response parse error: {e}"

    if result.status == "error":
        try:
            skill = await skill_service.get_skill(db, skill_id)
            skill.conversion_status = "failed"
            skill.conversion_error = result.error_detail
            await db.flush()
        except Exception:
            pass

    return result


def _parse_creator_response(raw: str) -> dict:
    """Parse the creator agent's response, trying JSON first then extracting key fields."""
    # Try direct JSON parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in markdown
    import re
    json_match = re.search(r"```(?:json)?\s*\n(.*?)\n```", raw, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Fallback: return raw as content
    return {"content": raw, "summary": raw[:200]}
