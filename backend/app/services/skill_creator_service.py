"""Agent-based Skill Creator service.

Replaces the brittle text-extraction pipeline with an Azure Agent call.
The creator agent (configured via meta_skill_service) processes source materials
and returns a Package Manifest (JSON envelope containing Markdown content,
reference documents, validation scripts, and coaching assets) aligned with
the agentskills.io specification.

Reuses the same AIProjectClient / Responses API pattern as agent_chat_service.
"""

import json
import logging
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import PurePosixPath

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.skill import SkillResource
from app.services import meta_skill_service, skill_service
from app.services.skill_text_extractor import convert_to_markdown, extract_text
from app.services.storage import get_storage

logger = logging.getLogger(__name__)

MAX_MATERIAL_LENGTH = 500_000  # ~125K tokens safety limit

# Content type mapping for generated resources
_CONTENT_TYPE_MAP: dict[str, str] = {
    ".md": "text/markdown",
    ".json": "application/json",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".csv": "text/csv",
    ".xml": "application/xml",
    ".txt": "text/plain",
    ".py": "text/x-python",
    ".js": "application/javascript",
    ".sh": "text/x-shellscript",
    ".ps1": "text/x-powershell",
}


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


@dataclass
class PackageManifest:
    """Parsed skill package manifest from the creator agent.

    The JSON envelope is a transport container; values are Markdown/Python content
    aligned with the agentskills.io specification.
    """

    metadata: dict = field(default_factory=dict)
    skill_md: str = ""
    references: dict[str, str] = field(default_factory=dict)
    scripts: dict[str, str] = field(default_factory=dict)
    assets: dict[str, str] = field(default_factory=dict)
    summary: str = ""


# ---------------------------------------------------------------------------
# Material text collection
# ---------------------------------------------------------------------------


async def _collect_material_texts(db: AsyncSession, skill_id: str) -> list[tuple[str, str]]:
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
        endpoint = await config_service.get_effective_endpoint(db, "azure_openai")
        api_key = await config_service.get_effective_key(db, "azure_openai")

        if not endpoint:
            return CreationResult(
                status="error",
                model_used=model,
                error_detail="Azure OpenAI not configured",
            )

        from app.services.azure_auth import get_azure_openai_client

        client = await get_azure_openai_client(
            endpoint=endpoint,
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
        logger.warning(
            "Materials text truncated from %d to %d chars",
            len(materials_text),
            MAX_MATERIAL_LENGTH,
        )
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
        result = await _call_direct_openai(db, materials_text, meta.template_content, meta.model)

    result.skill_id = skill_id

    # Step 4: Parse response and update skill
    if result.status == "success" and result.raw_response:
        try:
            parsed = _parse_raw_json(result.raw_response)
            manifest = _build_package_manifest(parsed)
            skill = await skill_service.get_skill(db, skill_id)

            # Validate the package manifest
            validation = _validate_creator_output(parsed)

            # Update skill metadata from manifest
            meta_fields = manifest.metadata
            if meta_fields.get("name"):
                skill.name = meta_fields["name"]
                result.name = meta_fields["name"]
            if meta_fields.get("description"):
                skill.description = meta_fields["description"]
            if meta_fields.get("product"):
                skill.product = meta_fields["product"]
            if meta_fields.get("therapeutic_area"):
                skill.therapeutic_area = meta_fields["therapeutic_area"]
            if meta_fields.get("tags"):
                skill.tags = meta_fields["tags"]
            if meta_fields.get("compatibility"):
                skill.compatibility = meta_fields["compatibility"]

            # Store Markdown body as content (not raw JSON)
            skill.content = manifest.skill_md
            skill.conversion_status = "completed"
            skill.conversion_error = ""

            # Create SkillResource records for references, scripts, assets
            await _create_resources_from_manifest(db, skill_id, manifest)

            # Store audit trail in metadata
            meta_json = json.loads(skill.metadata_json or "{}")
            meta_json["creation_audit"] = {
                "agent_id": result.agent_id,
                "agent_version": result.agent_version,
                "model": result.model_used,
                "created_at": datetime.now(UTC).isoformat(),
                "method": "agent" if meta.agent_id else "direct_openai",
                "format": "package_manifest_v3",
            }
            if validation is not None:
                meta_json["creation_validation"] = validation
            skill.metadata_json = json.dumps(meta_json, ensure_ascii=False)

            result.summary = manifest.summary
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


def _validate_creator_output(data: dict) -> dict | None:
    """Run the creator validation script on parsed output.

    Returns the validation report dict, or None if the script is unavailable.
    Validation failures are logged as warnings but never block creation.
    """
    script_path = meta_skill_service.get_validation_script_path("creator")
    if script_path is None or not script_path.exists():
        return None

    try:
        import importlib.util

        spec = importlib.util.spec_from_file_location("validate_creator", script_path)
        if spec is None or spec.loader is None:
            return None
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        report = mod.validate(data)
        if not report.get("valid"):
            logger.warning(
                "Creator output validation failed: errors=%s, warnings=%s",
                report.get("errors"),
                report.get("warnings"),
            )
        return report
    except Exception as exc:
        logger.warning("Creator validation script error: %s", exc)
        return {"valid": False, "errors": [f"Validation script error: {exc}"]}


# ---------------------------------------------------------------------------
# Package Manifest parsing
# ---------------------------------------------------------------------------


def _parse_raw_json(raw: str) -> dict:
    """Parse the creator agent's raw response as JSON.

    Tries direct JSON parse, then looks for a JSON code block in markdown,
    then falls back to wrapping the raw text.
    """
    # Try direct JSON parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Try to find JSON block in markdown
    json_match = re.search(r"```(?:json)?\s*\n(.*?)\n```", raw, re.DOTALL)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Fallback: return raw as content
    return {"skill_md": raw, "metadata": {}, "summary": raw[:200]}


def _build_package_manifest(parsed: dict) -> PackageManifest:
    """Build a PackageManifest from parsed JSON.

    Supports two formats:
    - New format (v3): has 'skill_md' key → package manifest with Markdown body
    - Legacy format (v2): has 'sop_steps' key → old JSON, convert to Markdown
    """
    # New package manifest format (v3)
    if "skill_md" in parsed:
        metadata = parsed.get("metadata", {})
        # If metadata is missing but top-level fields exist, extract them
        if not metadata:
            for key in ("name", "description", "product", "therapeutic_area", "tags"):
                if key in parsed:
                    metadata[key] = parsed[key]
        return PackageManifest(
            metadata=metadata,
            skill_md=_normalize_generated_skill_md(parsed.get("skill_md", "")),
            references=parsed.get("references", {}),
            scripts=parsed.get("scripts", {}),
            assets=parsed.get("assets", {}),
            summary=parsed.get("summary", ""),
        )

    # Legacy JSON format (v2) — convert to Markdown via format_coaching_protocol
    if "sop_steps" in parsed:
        from app.services.skill_conversion_service import format_coaching_protocol

        skill_name = parsed.get("name", "untitled-skill")
        skill_md = format_coaching_protocol(parsed, skill_name)

        return PackageManifest(
            metadata={
                "name": parsed.get("name", ""),
                "description": parsed.get("description", ""),
                "product": parsed.get("product", ""),
                "therapeutic_area": parsed.get("therapeutic_area", ""),
            },
            skill_md=_normalize_generated_skill_md(skill_md),
            references={},
            scripts={},
            assets={},
            summary=parsed.get("summary", ""),
        )

    # Fallback: raw text as skill_md
    return PackageManifest(
        metadata={},
        skill_md=_normalize_generated_skill_md(parsed.get("content", parsed.get("skill_md", ""))),
        summary=parsed.get("summary", ""),
    )


def _normalize_generated_skill_md(skill_md: str) -> str:
    """Remove generated scoring-like sections from Skill content."""
    if not skill_md:
        return skill_md

    section_names = ("Assessment Rubric", "Training Checkpoints")
    section_pattern = "|".join(re.escape(name) for name in section_names)
    heading_re = re.compile(
        rf"^(?P<level>#{{1,6}})\s+(?:{section_pattern})\s*$",
        re.MULTILINE,
    )

    normalized = skill_md
    while match := heading_re.search(normalized):
        heading_level = len(match.group("level"))
        next_heading_re = re.compile(rf"^#{{1,{heading_level}}}\s+", re.MULTILINE)
        next_match = next_heading_re.search(normalized, match.end())
        end = next_match.start() if next_match else len(normalized)
        before = normalized[: match.start()].rstrip()
        after = normalized[end:].lstrip()
        normalized = f"{before}\n\n{after}".strip()

    return normalized + ("\n" if skill_md.endswith("\n") and normalized else "")


def _safe_filename(filename: str) -> bool:
    """Check that a filename is safe (no path traversal)."""
    if not filename:
        return False
    p = PurePosixPath(filename)
    return not p.is_absolute() and ".." not in p.parts and "/" not in filename


async def _create_resources_from_manifest(
    db: AsyncSession,
    skill_id: str,
    manifest: PackageManifest,
) -> None:
    """Create SkillResource records from the package manifest.

    Creates resources for references, scripts, and assets. Each file becomes
    a SkillResource with text_content populated (no blob storage needed).
    """
    resource_map: list[tuple[str, dict[str, str]]] = [
        ("reference", manifest.references),
        ("script", manifest.scripts),
        ("asset", manifest.assets),
    ]

    for resource_type, files in resource_map:
        for filename, content in files.items():
            if not _safe_filename(filename) or not content:
                logger.warning(
                    "Skipping invalid resource: type=%s, filename=%s",
                    resource_type,
                    filename,
                )
                continue

            suffix = PurePosixPath(filename).suffix.lower()
            content_type = _CONTENT_TYPE_MAP.get(suffix, "application/octet-stream")
            dir_name = f"{resource_type}s"

            resource = SkillResource(
                skill_id=skill_id,
                resource_type=resource_type,
                filename=filename,
                storage_path=f"skills/{skill_id}/{dir_name}/{filename}",
                content_type=content_type,
                file_size=len(content.encode("utf-8")),
                text_content=content,
                extraction_status="completed",
            )
            db.add(resource)

    logger.info(
        "Created resources from manifest for skill %s: %d references, %d scripts, %d assets",
        skill_id,
        len(manifest.references),
        len(manifest.scripts),
        len(manifest.assets),
    )
