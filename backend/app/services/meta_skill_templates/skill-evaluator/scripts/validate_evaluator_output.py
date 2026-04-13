#!/usr/bin/env python3
"""Validate the JSON output produced by the Skill Evaluator agent.

Usage:
    python validate_evaluation_output.py '<json_string>'
    echo '{"overall_score":75}' | python validate_evaluation_output.py

Returns a JSON report with validation results.
"""

import json
import sys


REQUIRED_FIELDS = ["overall_score", "overall_verdict", "dimensions", "summary", "top_3_improvements"]

VALID_VERDICTS = {"PASS", "NEEDS_REVIEW", "FAIL"}

CANONICAL_DIMENSIONS = [
    "sop_completeness",
    "assessment_coverage",
    "knowledge_accuracy",
    "difficulty_calibration",
    "conversation_logic",
    "executability",
]

DIMENSION_WEIGHTS = {
    "sop_completeness": 0.20,
    "knowledge_accuracy": 0.25,
    "conversation_logic": 0.20,
    "assessment_coverage": 0.15,
    "difficulty_calibration": 0.10,
    "executability": 0.10,
}

DIMENSION_REQUIRED_FIELDS = [
    "name", "score", "verdict", "strengths", "improvements",
    "critical_issues", "rationale",
]


def validate(data: dict) -> dict:
    """Validate a Skill Evaluator output dictionary."""
    errors: list[str] = []
    warnings: list[str] = []

    # --- Required top-level fields ---
    for field in REQUIRED_FIELDS:
        if field not in data:
            errors.append(f"Missing required field: {field}")

    # --- overall_score ---
    score = data.get("overall_score")
    if score is not None:
        if not isinstance(score, (int, float)):
            errors.append(f"overall_score must be a number, got {type(score).__name__}")
        elif not 0 <= score <= 100:
            errors.append(f"overall_score {score} out of range [0, 100]")

    # --- overall_verdict ---
    verdict = data.get("overall_verdict")
    if verdict is not None and verdict not in VALID_VERDICTS:
        errors.append(
            f"overall_verdict '{verdict}' not in {sorted(VALID_VERDICTS)}"
        )

    # --- Verdict / score consistency ---
    if isinstance(score, (int, float)) and verdict in VALID_VERDICTS:
        expected = "PASS" if score >= 70 else ("NEEDS_REVIEW" if score >= 50 else "FAIL")
        if verdict != expected:
            warnings.append(
                f"overall_verdict '{verdict}' inconsistent with score {score} "
                f"(expected '{expected}')"
            )

    # --- dimensions ---
    dimensions = data.get("dimensions", [])
    if not isinstance(dimensions, list):
        errors.append("dimensions must be a list")
    else:
        if len(dimensions) != 6:
            errors.append(f"dimensions has {len(dimensions)} items, expected exactly 6")

        seen_names = set()
        for i, dim in enumerate(dimensions):
            if not isinstance(dim, dict):
                errors.append(f"dimensions[{i}] must be a dict")
                continue

            # Check required fields
            for req in DIMENSION_REQUIRED_FIELDS:
                if req not in dim:
                    errors.append(f"dimensions[{i}] missing '{req}'")

            # Check dimension name
            name = dim.get("name", "")
            if name and name not in CANONICAL_DIMENSIONS:
                warnings.append(
                    f"dimensions[{i}] name '{name}' not in canonical dimensions"
                )
            if name in seen_names:
                errors.append(f"dimensions[{i}] duplicate name '{name}'")
            seen_names.add(name)

            # Check score range
            dim_score = dim.get("score")
            if dim_score is not None:
                if not isinstance(dim_score, (int, float)):
                    errors.append(
                        f"dimensions[{i}] score must be a number"
                    )
                elif not 0 <= dim_score <= 100:
                    errors.append(
                        f"dimensions[{i}] score {dim_score} out of range [0, 100]"
                    )

            # Check verdict
            dim_verdict = dim.get("verdict")
            if dim_verdict is not None and dim_verdict not in VALID_VERDICTS:
                errors.append(
                    f"dimensions[{i}] verdict '{dim_verdict}' invalid"
                )

            # Check per-dimension verdict/score consistency
            if (
                isinstance(dim_score, (int, float))
                and dim_verdict in VALID_VERDICTS
            ):
                expected_v = (
                    "PASS" if dim_score >= 70
                    else ("NEEDS_REVIEW" if dim_score >= 50 else "FAIL")
                )
                if dim_verdict != expected_v:
                    warnings.append(
                        f"dimensions[{i}] verdict '{dim_verdict}' "
                        f"inconsistent with score {dim_score} "
                        f"(expected '{expected_v}')"
                    )

        # Check all canonical dimensions present
        missing = set(CANONICAL_DIMENSIONS) - seen_names
        if missing:
            warnings.append(f"Missing dimensions: {sorted(missing)}")

        # Check overall_score is approximately the weighted average
        if (
            isinstance(score, (int, float))
            and len(dimensions) == 6
            and all(isinstance(d, dict) for d in dimensions)
        ):
            weighted_sum = 0.0
            can_check = True
            for d in dimensions:
                d_name = d.get("name", "")
                d_score = d.get("score")
                if d_name in DIMENSION_WEIGHTS and isinstance(d_score, (int, float)):
                    weighted_sum += d_score * DIMENSION_WEIGHTS[d_name]
                else:
                    can_check = False
                    break
            if can_check and abs(score - weighted_sum) > 5:
                warnings.append(
                    f"overall_score {score} differs from weighted average "
                    f"{weighted_sum:.1f} by more than 5 points"
                )

    # --- summary ---
    summary = data.get("summary", "")
    if isinstance(summary, str) and summary and len(summary) < 10:
        warnings.append("summary is too short (< 10 chars)")

    # --- top_3_improvements ---
    improvements = data.get("top_3_improvements", [])
    if isinstance(improvements, list):
        if len(improvements) == 0:
            warnings.append("top_3_improvements is empty")
        elif len(improvements) > 3:
            warnings.append(
                f"top_3_improvements has {len(improvements)} items, expected <= 3"
            )
    elif improvements is not None:
        errors.append("top_3_improvements must be a list")

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
