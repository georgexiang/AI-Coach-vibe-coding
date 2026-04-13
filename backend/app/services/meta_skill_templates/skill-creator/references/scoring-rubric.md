# Scoring Rubric for MR Training Skills

## Standard Evaluation Dimensions

The following 6 dimensions are used to evaluate the quality of a created
coaching skill. The Creator agent should design content that scores well
on all dimensions. These dimensions align exactly with the Skill Evaluator's
assessment criteria.

### Dimensions and Weights

| Dimension | Weight | Description |
|-----------|--------|-------------|
| sop_completeness | 0.20 | All 5 SOP stages present with required detail |
| knowledge_accuracy | 0.25 | Product knowledge is accurate, evidence-based |
| conversation_logic | 0.20 | Conversation flows naturally, transitions are smooth |
| assessment_coverage | 0.15 | Assessment criteria cover all SOP steps and modules |
| difficulty_calibration | 0.10 | Difficulty appropriate for audience, progressive |
| executability | 0.10 | Instructions clear enough for AI agent execution |

**Total weight**: 1.00
**Pass threshold**: 70 / 100

### Per-Dimension Scoring Guide

**sop_completeness** (weight: 0.20):
- 90-100: All 5 stages present, each with key_points, objections, assessment_criteria, knowledge_points, suggested_duration
- 70-89: All 5 stages present, most fields populated, minor gaps
- 50-69: Some stages incomplete or missing key fields
- 0-49: Missing stages or structurally incomplete

**knowledge_accuracy** (weight: 0.25):
- 90-100: All claims supported by specific clinical data with trial names and endpoints
- 70-89: Most claims supported, minor gaps in evidence citation
- 50-69: Some unsupported claims or generic statements
- 0-49: Inaccurate information or fabricated data

**conversation_logic** (weight: 0.20):
- 90-100: Natural flow from opening through closing, clear transitions, branching paths for different HCP responses
- 70-89: Logical flow with minor transition gaps
- 50-69: Some abrupt topic changes or missing connections
- 0-49: Disjointed or illogical flow

**assessment_coverage** (weight: 0.15):
- 90-100: Clear rubrics for every SOP step and module, measurable criteria, multiple assessment types
- 70-89: Most steps and modules have assessment criteria
- 50-69: Partial coverage, some criteria vague
- 0-49: Missing assessment criteria for major sections

**difficulty_calibration** (weight: 0.10):
- 90-100: Clear difficulty progression across modules, realistic objection scenarios mirroring real HCP interactions, balanced Bloom's Taxonomy levels
- 70-89: Mostly appropriate difficulty with some realistic objections
- 50-69: Uneven difficulty, some areas too easy or too hard
- 0-49: Difficulty poorly calibrated, unrealistic scenarios

**executability** (weight: 0.10):
- 90-100: Instructions precise enough for automated AI agent execution, edge cases documented, clear decision criteria at branch points
- 70-89: Mostly clear instructions with minor ambiguities
- 50-69: Some instructions vague or open to interpretation
- 0-49: Instructions too vague for agent execution, significant gaps
