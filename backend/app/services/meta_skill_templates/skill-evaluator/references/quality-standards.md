# Quality Standards for Coaching Skills

## Verdict Thresholds

| Overall Score | Verdict | Meaning |
|---------------|---------|---------|
| ≥ 70 | **PASS** | Skill is ready for deployment and MR training |
| 50 – 69 | **NEEDS_REVIEW** | Skill requires improvements before deployment |
| < 50 | **FAIL** | Fundamental issues must be addressed |

The same thresholds apply per-dimension:
- Dimension score ≥ 70 → dimension verdict PASS
- Dimension score 50-69 → dimension verdict NEEDS_REVIEW
- Dimension score < 50 → dimension verdict FAIL

## Overall Score Calculation

The overall score is a **weighted average** of the 6 dimension scores,
using the weights defined in `evaluation-dimensions.md`.

## Quality Characteristics by Verdict

### PASS Skills (score ≥ 70)
- All 5 SOP stages present and substantive
- Clinical data is specific with trial names and endpoints
- At least 3 key messages in product discussion
- At least 2 objection handling scenarios with evidence
- Assessment criteria cover all major sections
- Conversation flow is logical and natural

### NEEDS_REVIEW Skills (score 50-69)
- SOP structure is present but some stages lack detail
- Some clinical claims lack specific evidence
- Objection handling exists but may be generic
- Assessment criteria are partial
- Generally usable but needs refinement

### FAIL Skills (score < 50)
- Missing SOP stages or fundamentally incomplete
- Inaccurate or fabricated clinical information
- No meaningful objection handling
- No assessment framework
- Cannot be used for MR training in current form

## Evaluation Integrity

- **Do not inflate scores** — a skill with gaps should not receive PASS
- **Critical issues** should be reserved for genuine blockers:
  - Fabricated clinical data
  - Missing required SOP stages
  - Fundamentally broken conversation flow
  - Assessment criteria that cannot be evaluated
- **Improvements** are for actionable enhancements, not wishful features
- **Strengths** must cite specific evidence from the skill content
