#!/usr/bin/env python3
"""Validate the JSON output produced by the MR Training Creator skill.

Usage:
    python validate_skill_output.py '<json_string>'
    echo '{"name":"test"}' | python validate_skill_output.py

Returns a JSON report with validation results.
"""

import json
import sys


REQUIRED_FIELDS = ["name", "description", "product", "therapeutic_area"]
RECOMMENDED_FIELDS = ["key_messages", "objection_handling", "clinical_data_summary"]

MIN_KEY_MESSAGES = 3
MIN_OBJECTIONS = 2


def validate(data: dict) -> dict:
    """Validate a skill output dictionary."""
    errors = []
    warnings = []

    # Check required fields
    for field in REQUIRED_FIELDS:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")

    # Check recommended fields
    for field in RECOMMENDED_FIELDS:
        if field not in data:
            warnings.append(f"Missing recommended field: {field}")

    # Validate key_messages
    messages = data.get("key_messages", [])
    if not isinstance(messages, list):
        errors.append("key_messages must be a list")
    elif len(messages) < MIN_KEY_MESSAGES:
        warnings.append(
            f"key_messages has {len(messages)} items, recommended >= {MIN_KEY_MESSAGES}"
        )

    # Validate objection_handling
    objections = data.get("objection_handling", [])
    if not isinstance(objections, list):
        errors.append("objection_handling must be a list")
    elif len(objections) < MIN_OBJECTIONS:
        warnings.append(
            f"objection_handling has {len(objections)} items, recommended >= {MIN_OBJECTIONS}"
        )
    else:
        for i, obj in enumerate(objections):
            if not isinstance(obj, dict):
                errors.append(f"objection_handling[{i}] must be a dict")
            elif "objection" not in obj or "response" not in obj:
                errors.append(
                    f"objection_handling[{i}] must have 'objection' and 'response' keys"
                )

    # Validate name format (should be kebab-case)
    name = data.get("name", "")
    if name and not all(c.isalnum() or c == "-" for c in name):
        warnings.append(f"name '{name}' should use kebab-case (alphanumeric + hyphens)")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "field_count": len(data),
        "score": max(0, 100 - len(errors) * 20 - len(warnings) * 5),
    }


def main():
    # Read from argument or stdin
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
