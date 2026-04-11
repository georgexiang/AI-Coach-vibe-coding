"""L1 structure validation service for Skill quality gates.

Pure rule-based checks (no AI calls) — runs instantly.
Validates SOP content structure, assessment criteria, knowledge points,
and basic info fields against configurable thresholds.
"""

import hashlib
import re
from dataclasses import asdict, dataclass, field

from app.models.skill import Skill

# ---------------------------------------------------------------------------
# Configurable L1 thresholds (addresses review: L1 rules may be overly rigid)
# These can be adjusted per locale/product later.
# ---------------------------------------------------------------------------

MIN_SOP_STEPS = 3
MIN_ASSESSMENT_ITEMS = 2
MIN_SKILL_NAME_LENGTH = 2
MIN_SKILL_DESCRIPTION_LENGTH = 10
MIN_CONTENT_LENGTH = 50
ERROR_PENALTY = 25
WARNING_PENALTY = 10

# Required stages (bilingual for zh-CN support)
# Each tuple contains alternative keywords for the same stage.
REQUIRED_STAGES: list[tuple[str, ...]] = [
    ("Opening", "开场"),
    ("Product", "产品介绍", "产品"),
    ("Closing", "收尾", "总结"),
]

# Regex for counting SOP steps (bilingual)
_SOP_STEP_RE = re.compile(r"^#{2,3}\s+(?:Step|步骤)\s*\d", re.MULTILINE | re.IGNORECASE)

# Assessment section heading patterns
_ASSESSMENT_HEADING_RE = re.compile(
    r"^#{1,4}\s+.*(?:Assessment|考核|Rubric|评估)", re.MULTILINE | re.IGNORECASE
)

# Knowledge section heading patterns
_KNOWLEDGE_HEADING_RE = re.compile(r"^#{1,4}\s+.*(?:Knowledge|知识)", re.MULTILINE | re.IGNORECASE)

# List item or table row pattern (for counting items under a heading)
_LIST_OR_ROW_RE = re.compile(r"^\s*(?:[-*+]|\d+[.)]\s|\|)", re.MULTILINE)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class ValidationIssue:
    """A single validation issue found during structure check."""

    severity: str  # "error" | "warning" | "info"
    dimension: str  # Check dimension name
    message: str  # Human-readable issue description
    suggestion: str  # How to fix


@dataclass
class StructureCheckResult:
    """Result of L1 structure validation."""

    passed: bool
    score: int  # 0-100
    issues: list[ValidationIssue] = field(default_factory=list)
    content_hash: str = ""  # SHA256 hash for staleness detection


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compute_content_hash(content: str) -> str:
    """Compute a short SHA256 hash of skill content for staleness detection."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]


def _count_items_after_heading(content: str, heading_re: re.Pattern[str]) -> int:
    """Count list items or table rows in the section after the first matching heading."""
    match = heading_re.search(content)
    if not match:
        return 0

    # Extract text from heading to the next heading of same or higher level
    heading_level = 0
    for ch in content[match.start() :]:
        if ch == "#":
            heading_level += 1
        else:
            break

    rest = content[match.end() :]

    # Find the next heading of same or higher level
    next_heading_re = re.compile(rf"^#{{1,{heading_level}}}\s", re.MULTILINE)
    next_match = next_heading_re.search(rest)
    section = rest[: next_match.start()] if next_match else rest

    # Count list items and table rows
    items = _LIST_OR_ROW_RE.findall(section)
    return len(items)


# ---------------------------------------------------------------------------
# Main validation function
# ---------------------------------------------------------------------------


async def check_skill_structure(skill: Skill) -> StructureCheckResult:
    """Run L1 structure validation on a skill. Pure rules, no AI.

    Checks:
    a) SOP content structure (step count, required stages)
    b) Assessment criteria coverage
    c) Knowledge points presence
    d) Basic info completeness (name, description, content length)

    Returns StructureCheckResult with issues and score.
    """
    issues: list[ValidationIssue] = []
    content = skill.content or ""

    # --- a) SOP Content Check ---
    step_count = len(_SOP_STEP_RE.findall(content))
    if step_count < MIN_SOP_STEPS:
        issues.append(
            ValidationIssue(
                severity="error",
                dimension="sop_structure",
                message=f"SOP has {step_count} steps, minimum is {MIN_SOP_STEPS}",
                suggestion=(
                    f"Add at least {MIN_SOP_STEPS - step_count} more SOP steps "
                    "using '## Step N' or '## 步骤 N' headings."
                ),
            )
        )

    # Check required stages by keyword matching (case-insensitive)
    content_lower = content.lower()
    for stage_keywords in REQUIRED_STAGES:
        found = any(kw.lower() in content_lower for kw in stage_keywords)
        if not found:
            stage_name = stage_keywords[0]
            alternatives = " / ".join(stage_keywords)
            issues.append(
                ValidationIssue(
                    severity="warning",
                    dimension="sop_structure",
                    message=f"{stage_name} section may be missing",
                    suggestion=(
                        f"Add a section containing one of: {alternatives}. "
                        "This helps ensure the SOP covers the full conversation flow."
                    ),
                )
            )

    # --- b) Assessment Criteria Check ---
    assessment_items = _count_items_after_heading(content, _ASSESSMENT_HEADING_RE)
    if _ASSESSMENT_HEADING_RE.search(content) is None:
        issues.append(
            ValidationIssue(
                severity="error",
                dimension="assessment_coverage",
                message="No assessment criteria section found",
                suggestion=(
                    "Add an '## Assessment' or '## 考核' section with evaluation criteria."
                ),
            )
        )
    elif assessment_items < MIN_ASSESSMENT_ITEMS:
        issues.append(
            ValidationIssue(
                severity="error",
                dimension="assessment_coverage",
                message=(
                    f"Assessment criteria has {assessment_items} items, "
                    f"minimum is {MIN_ASSESSMENT_ITEMS}"
                ),
                suggestion=(
                    f"Add at least {MIN_ASSESSMENT_ITEMS - assessment_items} more "
                    "assessment criteria items (list items or table rows)."
                ),
            )
        )

    # --- c) Knowledge Points Check ---
    if _KNOWLEDGE_HEADING_RE.search(content) is None:
        issues.append(
            ValidationIssue(
                severity="warning",
                dimension="knowledge_coverage",
                message="No key knowledge points found",
                suggestion=(
                    "Add a '## Knowledge' or '## 知识' section listing "
                    "key knowledge points for this skill."
                ),
            )
        )
    else:
        knowledge_items = _count_items_after_heading(content, _KNOWLEDGE_HEADING_RE)
        if knowledge_items == 0:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    dimension="knowledge_coverage",
                    message="Knowledge section exists but has no items",
                    suggestion="Add list items under the Knowledge section.",
                )
            )

    # --- d) Basic Info Check ---
    name = skill.name or ""
    description = skill.description or ""

    if len(name.strip()) < MIN_SKILL_NAME_LENGTH:
        issues.append(
            ValidationIssue(
                severity="error",
                dimension="basic_info",
                message=(
                    f"Skill name is too short (length {len(name.strip())}), "
                    f"minimum is {MIN_SKILL_NAME_LENGTH}"
                ),
                suggestion="Provide a descriptive skill name.",
            )
        )

    if len(description.strip()) < MIN_SKILL_DESCRIPTION_LENGTH:
        issues.append(
            ValidationIssue(
                severity="warning",
                dimension="basic_info",
                message=(
                    f"Skill description is too short (length {len(description.strip())}), "
                    f"minimum is {MIN_SKILL_DESCRIPTION_LENGTH}"
                ),
                suggestion="Provide a detailed description of the skill's purpose and scope.",
            )
        )

    if len(content.strip()) < MIN_CONTENT_LENGTH:
        issues.append(
            ValidationIssue(
                severity="error",
                dimension="basic_info",
                message=(
                    f"Skill content is too short (length {len(content.strip())}), "
                    f"minimum is {MIN_CONTENT_LENGTH}"
                ),
                suggestion="Add more content including SOP steps, assessment criteria, etc.",
            )
        )

    # --- e) Score Calculation ---
    error_count = sum(1 for i in issues if i.severity == "error")
    warning_count = sum(1 for i in issues if i.severity == "warning")
    score = max(0, 100 - (error_count * ERROR_PENALTY) - (warning_count * WARNING_PENALTY))
    passed = error_count == 0

    return StructureCheckResult(
        passed=passed,
        score=score,
        issues=issues,
        content_hash=_compute_content_hash(content),
    )


def to_dict(result: StructureCheckResult) -> dict:
    """Serialize StructureCheckResult to dict (including content_hash)."""
    data = asdict(result)
    return data
