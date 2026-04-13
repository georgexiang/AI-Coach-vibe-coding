# Evaluation Dimensions

Six dimensions for evaluating coaching skill quality. This is the
single source of truth — all code and templates should reference
this file for dimension definitions.

## 1. sop_completeness

**Description**: Are all required SOP stages present (opening, needs
assessment, product discussion, objection handling, closing)? Are steps
detailed with key points, objections, and time guidance?

**Scoring guide**:
- **90-100**: All 5 SOP stages present with all required fields (key_points,
  objections, assessment_criteria, knowledge_points, suggested_duration).
  Transitions between stages are described.
- **75-89**: All 5 stages present with most fields populated. Minor gaps
  in detail (e.g., missing suggested_duration on some steps).
- **50-74**: Some stages incomplete or missing required fields. Structure
  is present but underspecified.
- **25-49**: Missing 1-2 stages or major sections lack substance.
- **0-24**: Fundamentally incomplete — fewer than 3 stages or skeleton only.

## 2. assessment_coverage

**Description**: Are assessment/evaluation criteria comprehensive? Do they
cover all SOP steps? Are scoring rubrics clear and measurable?

**Scoring guide**:
- **90-100**: Every SOP step and module has clear, measurable assessment
  criteria. Multiple assessment types (MC, scenario, rubric).
- **75-89**: Most steps have assessment criteria. Rubrics are mostly clear.
- **50-74**: Partial coverage — some steps or modules lack criteria.
- **25-49**: Sparse assessment criteria, vague or immeasurable.
- **0-24**: No meaningful assessment framework.

## 3. knowledge_accuracy

**Description**: Are product knowledge points accurate and relevant? Are
clinical references and data mentioned? Is terminology correct?

**Scoring guide**:
- **90-100**: All claims supported by specific clinical data (trial names,
  endpoints, p-values). Terminology is scientifically accurate.
- **75-89**: Most claims have clinical support. Minor terminology gaps.
- **50-74**: Some unsupported claims or generic statements without evidence.
- **25-49**: Multiple unsupported or inaccurate claims.
- **0-24**: Fabricated data or fundamentally inaccurate information.

## 4. difficulty_calibration

**Description**: Is the difficulty level appropriate for the target audience?
Are objection scenarios realistic? Is there progressive difficulty?

**Scoring guide**:
- **90-100**: Clear difficulty progression. Objection scenarios mirror
  real-world HCP interactions. Balance across Bloom's levels.
- **75-89**: Mostly appropriate difficulty. Some objections are realistic.
- **50-74**: Uneven difficulty — some areas too easy, others too hard.
- **25-49**: Difficulty poorly calibrated. Unrealistic objections.
- **0-24**: No consideration of difficulty or audience level.

## 5. conversation_logic

**Description**: Does the conversation flow logically from opening to
closing? Are transitions between topics natural? Are branching paths
considered?

**Scoring guide**:
- **90-100**: Natural flow throughout. Explicit transition prompts. Branching
  paths for different HCP responses. Adaptive conversation design.
- **75-89**: Generally logical flow. Transitions present but could be smoother.
- **50-74**: Some abrupt topic changes. Limited branching.
- **25-49**: Disjointed flow. Missing connections between stages.
- **0-24**: No logical conversation structure.

## 6. executability

**Description**: Can an AI agent execute this SOP effectively? Are
instructions clear and unambiguous? Are edge cases handled?

**Scoring guide**:
- **90-100**: Instructions are precise enough for automated execution.
  Edge cases documented. Clear decision criteria at branch points.
- **75-89**: Mostly clear instructions. Minor ambiguities.
- **50-74**: Some instructions are vague or open to interpretation.
- **25-49**: Multiple ambiguous instructions. Significant gaps in guidance.
- **0-24**: Instructions are too vague for any agent to execute.

## Dimension Weights

| Dimension | Weight |
|-----------|--------|
| sop_completeness | 0.20 |
| knowledge_accuracy | 0.25 |
| conversation_logic | 0.20 |
| assessment_coverage | 0.15 |
| difficulty_calibration | 0.10 |
| executability | 0.10 |

**Total**: 1.00
