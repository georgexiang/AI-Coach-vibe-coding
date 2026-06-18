#!/usr/bin/env python3
"""Validate the Package Manifest output produced by the Skill Creator agent.

Validates the new agentskills.io-aligned format with:
- metadata (YAML frontmatter fields)
- skill_md (Markdown body)
- references (split documentation files)
- scripts (validation/enforcement scripts)
- assets (coaching aids)

Usage:
    python validate_creator_output.py '<json_string>'
    echo '{"metadata":...}' | python validate_creator_output.py

Returns a JSON report with validation results.
"""

import json
import re
import sys
from pathlib import PurePosixPath

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AZURE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$")

# Markdown heading patterns (aligned with skill_validation_service.py L1 checks)
SOP_STEP_RE = re.compile(r"^#{2,3}\s+(?:Step|步骤)\s*\d", re.MULTILINE | re.IGNORECASE)
ASSESSMENT_HEADING_RE = re.compile(
    r"^#{1,4}\s+.*(?:Assessment|考核|Rubric|评估)", re.MULTILINE | re.IGNORECASE
)
KNOWLEDGE_HEADING_RE = re.compile(r"^#{1,4}\s+.*(?:Knowledge|知识)", re.MULTILINE | re.IGNORECASE)

METADATA_REQUIRED = ["name", "description", "product", "therapeutic_area"]

SAFE_REFERENCE_EXTENSIONS = {".md", ".json", ".yaml", ".yml", ".csv", ".xml", ".txt"}
SAFE_SCRIPT_EXTENSIONS = {".py", ".js", ".sh", ".ps1"}
SAFE_ASSET_EXTENSIONS = {".md", ".json", ".yaml", ".yml", ".csv", ".xml", ".txt"}

MIN_SOP_STEPS = 5
MIN_SKILL_MD_LENGTH = 500


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _safe_filename(filename: str) -> bool:
    """Check that a filename is safe (no path traversal, no absolute paths)."""
    if not filename:
        return False
    p = PurePosixPath(filename)
    if p.is_absolute() or ".." in p.parts:
        return False
    # Must be a simple filename, no directory components
    return "/" not in filename and "\\" not in filename


def _check_extension(filename: str, allowed: set[str]) -> bool:
    """Check that a filename has an allowed extension."""
    return PurePosixPath(filename).suffix.lower() in allowed


# ---------------------------------------------------------------------------
# Main validation
# ---------------------------------------------------------------------------


def validate(data: dict) -> dict:
    """Validate a Skill Creator Package Manifest dictionary.

    Args:
        data: Parsed JSON dict from the creator agent.

    Returns:
        dict with keys: valid, errors, warnings, field_count, score
    """
    errors: list[str] = []
    warnings: list[str] = []

    # --- Top-level structure ---
    for field in ("metadata", "skill_md", "references", "scripts", "assets", "summary"):
        if field not in data:
            errors.append(f"Missing required top-level field: {field}")

    # --- metadata ---
    metadata = data.get("metadata", {})
    if not isinstance(metadata, dict):
        errors.append("metadata must be a dict")
    else:
        for req in METADATA_REQUIRED:
            val = metadata.get(req, "")
            if not val or not isinstance(val, str) or not val.strip():
                errors.append(f"metadata missing required field: {req}")

        name = metadata.get("name", "")
        if name:
            if not AZURE_NAME_PATTERN.match(name):
                errors.append(
                    f"metadata.name '{name}' must be alphanumeric + hyphens, "
                    "start/end with alphanumeric"
                )
            if len(name) > 63:
                errors.append(f"metadata.name '{name}' exceeds 63 character limit ({len(name)})")

        desc = metadata.get("description", "")
        if isinstance(desc, str) and len(desc) > 1024:
            warnings.append(f"metadata.description is {len(desc)} chars, recommended <= 1024")

    # --- skill_md ---
    skill_md = data.get("skill_md", "")
    if not isinstance(skill_md, str):
        errors.append("skill_md must be a string")
    elif len(skill_md) < MIN_SKILL_MD_LENGTH:
        errors.append(
            f"skill_md is too short ({len(skill_md)} chars, minimum {MIN_SKILL_MD_LENGTH})"
        )
    else:
        # Check for required Markdown heading patterns
        sop_matches = SOP_STEP_RE.findall(skill_md)
        if len(sop_matches) < MIN_SOP_STEPS:
            warnings.append(
                f"skill_md has {len(sop_matches)} SOP step headings, expected >= {MIN_SOP_STEPS}"
            )

        if not ASSESSMENT_HEADING_RE.search(skill_md):
            warnings.append("skill_md missing Assessment/Rubric heading section")

        if not KNOWLEDGE_HEADING_RE.search(skill_md):
            warnings.append("skill_md missing Knowledge heading section")

    # --- references ---
    references = data.get("references", {})
    if not isinstance(references, dict):
        errors.append("references must be a dict")
    else:
        if len(references) < 1:
            errors.append("references must have at least 1 file")
        for filename, content in references.items():
            if not _safe_filename(filename):
                errors.append(f"references: unsafe filename '{filename}'")
            elif not _check_extension(filename, SAFE_REFERENCE_EXTENSIONS):
                warnings.append(f"references: '{filename}' has non-standard extension")
            if not isinstance(content, str) or len(content) < 50:
                warnings.append(
                    f"references['{filename}'] content is too short "
                    f"({len(content) if isinstance(content, str) else 0} chars)"
                )

    # --- scripts ---
    scripts = data.get("scripts", {})
    if not isinstance(scripts, dict):
        errors.append("scripts must be a dict")
    else:
        if len(scripts) < 1:
            errors.append("scripts must have at least 1 file")
        for filename, content in scripts.items():
            if not _safe_filename(filename):
                errors.append(f"scripts: unsafe filename '{filename}'")
            elif not _check_extension(filename, SAFE_SCRIPT_EXTENSIONS):
                warnings.append(f"scripts: '{filename}' has non-standard extension")
            if not isinstance(content, str) or len(content) < 50:
                warnings.append(
                    f"scripts['{filename}'] content is too short "
                    f"({len(content) if isinstance(content, str) else 0} chars)"
                )

    # --- assets ---
    assets = data.get("assets", {})
    if not isinstance(assets, dict):
        errors.append("assets must be a dict")
    else:
        if len(assets) < 1:
            warnings.append("assets is empty, recommended at least 1 file")
        for filename, content in assets.items():
            if not _safe_filename(filename):
                errors.append(f"assets: unsafe filename '{filename}'")
            elif not _check_extension(filename, SAFE_ASSET_EXTENSIONS):
                warnings.append(f"assets: '{filename}' has non-standard extension")

    # --- summary ---
    summary = data.get("summary", "")
    if isinstance(summary, str) and len(summary) < 20:
        warnings.append(f"summary is too short ({len(summary)} chars, recommended >= 20)")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "field_count": len(data),
        "score": max(0, 100 - len(errors) * 20 - len(warnings) * 5),
    }


def main() -> None:
    if len(sys.argv) > 1:
        raw = sys.argv[1]
    else:
        raw = sys.stdin.read().strip()

    if not raw:
        print(json.dumps({"valid": False, "errors": ["No input provided"]}))
        sys.exit(1)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"valid": False, "errors": [f"Invalid JSON: {e}"]}))
        sys.exit(1)

    result = validate(data)
    print(json.dumps(result, indent=2))
    sys.exit(0 if result["valid"] else 1)


if __name__ == "__main__":
    main()
