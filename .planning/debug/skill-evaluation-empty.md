---
status: awaiting_human_verify
trigger: "Skill的评估(evaluation)数据都是空的。系统设计了6维度AI评估(L2 evaluation)，应该有雷达图数据"
created: 2026-04-11T00:00:00+08:00
updated: 2026-04-11T00:00:00+08:00
---

## Current Focus

hypothesis: Two root causes confirmed — (1) seed script polling checks wrong JSON path so always times out and falls through to DB fallback, (2) DB fallback writes dimensions=[] instead of realistic 6-dimension data
test: Code review confirmed both issues
expecting: Fix polling path + populate dimensions in fallback = radar chart renders with data
next_action: Await human verification — re-run seed_skills.py, then check radar chart in skill editor UI

## Symptoms

expected: 每个经过评估的skill应该有6维度的评分数据(用于雷达图展示)，包括每个维度的score, verdict, strengths, improvements, critical_issues, rationale
actual: skill的quality_details中dimensions为空列表[]，或者quality_score/quality_verdict为null。种子数据中published和archived的skill用了DB fallback写入quality_score=85但dimensions=[]
errors: AI评估超时 — L2 evaluation调用Azure OpenAI后等待20秒无响应（可能是因为本地没有配置Azure OpenAI endpoint/key）
reproduction: 1) 通过seed_skills.py创建skill并流转到published；2) L2评估触发后因无Azure OpenAI配置而返回默认空结果；3) 查看skill的quality_details，dimensions为空
started: 刚刚发生

## Eliminated

(none)

## Evidence

- timestamp: 2026-04-11T00:01
  checked: seed_skills.py run_quality_evaluation() polling logic
  found: Line 365 checks `eval_data.get("quality_score")` but GET /evaluation API returns `{"quality": {"score": ...}}` — the score is nested under `quality.score`, not at top-level `quality_score`. This means polling ALWAYS times out even when AI eval completes.
  implication: Seed script always falls through to `set_quality_score_direct()` fallback

- timestamp: 2026-04-11T00:02
  checked: seed_skills.py set_quality_score_direct() fallback
  found: Lines 400-411 write `"dimensions": []` — empty list with no dimension data. Sets quality_score=85 and quality_verdict="PASS" but no dimension breakdown.
  implication: Even when quality_score is set, the radar chart has no data because dimensions array is empty

- timestamp: 2026-04-11T00:03
  checked: skill_evaluation_service.py evaluate_skill_quality() AI-unavailable fallback
  found: Lines 214-230 create DimensionScore entries with score=0, verdict="FAIL" for all 6 dimensions. This is actually correct for the "AI service unavailable" case — it provides 6 zero-score dimensions.
  implication: The backend service itself does provide dimension data even in fallback, but the seed script bypasses this by writing directly to DB with dimensions=[]

- timestamp: 2026-04-11T00:04
  checked: Frontend components quality-radar-chart.tsx and quality-score-card.tsx
  found: Both components are fully implemented and functional. QualityRadarChart renders recharts RadarChart, QualityScoreCard shows expandable dimension cards. skill-editor.tsx line 681 gates rendering on `dimensions.length > 0`.
  implication: Frontend is complete. The only issue is backend data — once dimensions are populated, the UI will render correctly.

## Resolution

root_cause: Two bugs cause empty evaluation data: (1) seed_skills.py polling checks wrong JSON path `eval_data.get("quality_score")` but API returns nested `eval_data["quality"]["score"]`, so polling always times out. (2) seed_skills.py `set_quality_score_direct()` fallback writes `dimensions: []` instead of realistic 6-dimension data. Both bugs mean published/archived skills have quality_score=85 but no dimension data for the radar chart.
fix: Fixed seed_skills.py — (1) corrected polling path from eval_data.get("quality_score") to eval_data.get("quality", {}).get("score") to match API response structure, (2) replaced empty dimensions=[] in set_quality_score_direct() fallback with realistic 6-dimension evaluation data including scores, verdicts, strengths, improvements, critical_issues, and rationale for each dimension
verification: All 119 skill-related tests pass. Lint and format checks pass. Data structure verified to match QualityDimension TypeScript type (name, score, verdict, strengths, improvements, critical_issues, rationale). Awaiting human re-seed + UI check.
files_changed: [backend/scripts/seed_skills.py]
