---
status: awaiting_human_verify
trigger: "用户在场景管理列表页点击创建场景时失败，页面显示错误：无法保存场景，请检查必填字段后重试。"
created: 2026-04-26T00:00:00Z
updated: 2026-04-26T00:00:02Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED - ScenarioCreate schema had `created_by` as required field, frontend never sends it
test: removed `created_by` from schema, all 27 related tests pass, linter clean
expecting: scenario creation from frontend will now succeed
next_action: awaiting human verification in real environment

## Symptoms

expected: 创建场景后应显示成功提示
actual: 页面报错 - "无法保存场景，请检查必填字段后重试。"
errors: "无法保存场景，请检查必填字段后重试。"
reproduction: 从场景管理列表页点击创建按钮
started: 不确定之前是否正常工作过

## Eliminated

## Evidence

- timestamp: 2026-04-26T00:00:01Z
  checked: backend/app/schemas/scenario.py - ScenarioCreate schema
  found: `created_by: str` is a required field with no default, at line 15
  implication: Pydantic will reject any POST without `created_by` with 422

- timestamp: 2026-04-26T00:00:01Z
  checked: frontend/src/types/scenario.ts - ScenarioCreate type
  found: No `created_by` field in the frontend type. Frontend never sends it.
  implication: Every create request will fail Pydantic validation

- timestamp: 2026-04-26T00:00:01Z
  checked: backend/app/services/scenario_service.py line 70-76
  found: Service does `scenario_data["created_by"] = user_id` AFTER model_dump(), showing intent to set it server-side
  implication: `created_by` in schema is redundant - it's always overwritten by the service

- timestamp: 2026-04-26T00:00:01Z
  checked: backend/app/api/scenarios.py line 64-71
  found: Route handler passes `user.id` separately to service, never injects it into the request data
  implication: `created_by` must NOT be in the request schema

## Resolution

root_cause: Backend ScenarioCreate Pydantic schema has `created_by: str` as a required field, but the frontend (correctly) does not send it because it should come from the authenticated JWT user. The service layer at scenario_service.py:76 already sets `created_by = user_id` from the auth context, so having it in the schema is both incorrect and causes a 422 validation error on every create request.
fix: Removed `created_by` from the ScenarioCreate Pydantic schema. Also removed `created_by` from all test ScenarioCreate constructor calls in test_scenario_service.py, test_schemas_phase2.py, and test_api_direct.py.
verification: 27 tests pass (18 scenario service, 4 schema, 5 API direct). Linter clean. Service layer at scenario_service.py:76 correctly sets created_by from auth user.
files_changed: [backend/app/schemas/scenario.py, backend/tests/test_scenario_service.py, backend/tests/test_schemas_phase2.py, backend/tests/test_api_direct.py]
