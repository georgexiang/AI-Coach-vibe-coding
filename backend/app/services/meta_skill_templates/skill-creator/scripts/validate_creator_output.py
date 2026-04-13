#!/usr/bin/env python3
"""Validate the JSON output produced by the Skill Creator agent.

Usage:
    python validate_creator_output.py '<json_string>'
    echo '{"name":"test"}' | python validate_creator_output.py

Returns a JSON report with validation results.
"""

import json
import re
import sys


REQUIRED_FIELDS = [
    "name", "description", "product", "therapeutic_area",
    "sop_steps", "modules", "scoring", "summary",
]

AZURE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$")

MIN_SOP_STEPS = 5
MIN_MODULES = 3
MAX_MODULES = 8

SOP_STEP_REQUIRED = ["title", "description", "key_points", "assessment_criteria"]
SOP_STEP_RECOMMENDED = ["objections", "knowledge_points", "suggested_duration"]
MODULE_REQUIRED = ["title", "objectives", "content"]

CANONICAL_DIMENSIONS = [
    "sop_completeness", "knowledge_accuracy", "conversation_logic",
    "assessment_coverage", "difficulty_calibration", "executability",
]


def validate(data: dict) -> dict:
    """Validate a Skill Creator output dictionary."""
    errors: list[str] = []
    warnings: list[str] = []

    # --- Required fields ---
    for field in REQUIRED_FIELDS:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")

    # --- Name validation ---
    name = data.get("name", "")
    if name:
        if not AZURE_NAME_PATTERN.match(name):
            errors.append(
                f"name '{name}' must be alphanumeric + hyphens, "
                "start/end with alphanumeric"
            )
        if len(name) > 63:
            errors.append(f"name '{name}' exceeds 63 character limit ({len(name)})")

    # --- SOP steps ---
    sop_steps = data.get("sop_steps", [])
    if not isinstance(sop_steps, list):
        errors.append("sop_steps must be a list")
    else:
        if len(sop_steps) < MIN_SOP_STEPS:
            errors.append(
                f"sop_steps has {len(sop_steps)} items, "
                f"minimum {MIN_SOP_STEPS} required"
            )
        for i, step in enumerate(sop_steps):
            if not isinstance(step, dict):
                errors.append(f"sop_steps[{i}] must be a dict")
                continue
            for req in SOP_STEP_REQUIRED:
                if req not in step or not step[req]:
                    warnings.append(f"sop_steps[{i}] missing '{req}'")
            for opt in SOP_STEP_RECOMMENDED:
                if opt not in step or not step[opt]:
                    warnings.append(f"sop_steps[{i}] missing recommended '{opt}'")

    # --- Modules ---
    modules = data.get("modules", [])
    if not isinstance(modules, list):
        errors.append("modules must be a list")
    else:
        if len(modules) < MIN_MODULES:
            warnings.append(
                f"modules has {len(modules)} items, "
                f"recommended >= {MIN_MODULES}"
            )
        if len(modules) > MAX_MODULES:
            warnings.append(
                f"modules has {len(modules)} items, "
                f"recommended <= {MAX_MODULES}"
            )
        for i, mod in enumerate(modules):
            if not isinstance(mod, dict):
                errors.append(f"modules[{i}] must be a dict")
                continue
            for req in MODULE_REQUIRED:
                if req not in mod or not mod[req]:
                    warnings.append(f"modules[{i}] missing '{req}'")

    # --- Scoring ---
    scoring = data.get("scoring", {})
    if isinstance(scoring, dict):
        if "pass_threshold" not in scoring:
            warnings.append("scoring missing 'pass_threshold'")
        if "weights" not in scoring:
            warnings.append("scoring missing 'weights'")
        else:
            weights = scoring.get("weights", {})
            if isinstance(weights, dict) and weights:
                unknown = set(weights.keys()) - set(CANONICAL_DIMENSIONS)
                if unknown:
                    warnings.append(
                        f"scoring.weights has non-canonical dimensions: {sorted(unknown)}"
                    )
                missing_dims = set(CANONICAL_DIMENSIONS) - set(weights.keys())
                if missing_dims:
                    warnings.append(
                        f"scoring.weights missing dimensions: {sorted(missing_dims)}"
                    )
                total = sum(v for v in weights.values() if isinstance(v, (int, float)))
                if total and not (0.95 <= total <= 1.05):
                    warnings.append(
                        f"scoring.weights sum to {total:.2f}, expected ~1.00"
                    )
    elif scoring:
        errors.append("scoring must be a dict")

    # --- Summary ---
    summary = data.get("summary", "")
    if isinstance(summary, str) and len(summary) < 10:
        warnings.append("summary is too short (< 10 chars)")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "field_count": len(data),
        "score": max(0, 100 - len(errors) * 20 - len(warnings) * 5),
    }


def main():
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
