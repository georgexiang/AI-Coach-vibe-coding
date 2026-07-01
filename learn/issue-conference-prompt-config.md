# Issue: 会议 Prompt 抽取并支持管理员配置

## Title

feat: make conference prompt orchestration configurable

## 背景

当前会议培训场景中，会议发起、主持人串场、HCP 提问逻辑高度依赖代码内置 prompt。随着会议培训场景变复杂，管理员需要根据不同训练目标配置：

- 谁先发言、谁后发言。
- 谁是主要提问者、谁是次要提问者。
- 主持人如何开场、如何切换下一位 HCP、如何收尾。
- 不同会议场景下 HCP 提问应关注哪些角度。

如果这些 Prompt 固定在代码里，每次调整都需要开发介入，无法支撑医学、培训、业务团队快速迭代会议训练脚本。

## 目标

将会议场景相关 Prompt 从代码中抽取为可配置资产，并在 Admin 场景编辑页支持配置，使会议训练可以按场景自定义发言顺序、主次角色、主持词和 HCP 提问模板。

## 用户故事

作为 Admin / Training Designer，
我希望在会议场景中配置会议 Prompt 编排，
以便不同产品、适应症、培训目标可以使用不同的主持流程和 HCP 提问策略，
而不需要每次修改代码。

## 需求范围

### 1. 场景级 Prompt 配置

为 conference mode 的 Scenario 增加会议 Prompt 配置字段，建议结构包含：

```json
{
  "speaker_order_policy": "Use configured audience order as speaking order...",
  "audience_prompt_template": "# Conference Audience Role...",
  "moderator_remarks": {
    "invite": { "zh": "...", "en": "..." },
    "opening": { "zh": "...", "en": "..." },
    "handoff": { "zh": "...", "en": "..." },
    "closing": { "zh": "...", "en": "..." }
  }
}
```

配置应具备默认值。新建会议场景或已有场景缺少配置时，应自动回落到默认 Prompt。

### 2. 发言顺序与主次角色

会议听众 HCP 配置需要支持：

- 通过上移 / 下移调整 HCP 发言顺序。
- 主持人角色不参与 HCP 提问顺序。
- 第一个非主持人 HCP 标记为主要提问者。
- 后续非主持人 HCP 标记为次要提问者。
- 会议场景必须至少配置 1 位主持人。

### 3. Admin UI 配置能力

在 Admin 场景编辑页的会议场景配置中增加“会议 Prompt 编排”区域，至少支持：

- 编辑发言顺序与主次策略。
- 编辑 HCP 提问 Prompt 模板。
- 编辑主持人串场词：
  - 会议发起 / invite。
  - 问答开始 / opening。
  - 切换下一位 HCP / handoff。
  - 会议结束 / closing。
- 支持中文与英文主持词。
- 支持一键恢复默认模板。
- 长 Prompt 模板应作为高级配置处理，避免默认页面过于拥挤。

### 4. Runtime 行为

创建 conference session 时，应将当前会议 Prompt 配置快照写入 session / audience config，保证：

- 进行中的会议不会被后续场景配置修改影响。
- 主持词和 HCP 提问 Prompt 都从 session snapshot 读取。
- 如果配置缺失或字段不完整，使用默认配置补齐。

### 5. Prompt 渲染安全性

Prompt 模板应支持占位符，例如：

- `{hcp_name}`
- `{specialty}`
- `{role}`
- `{speaker_order}`
- `{speaker_priority}`
- `{speaker_order_policy}`
- `{product}`
- `{therapeutic_area}`
- `{presentation_topic}`
- `{conversation_history}`
- `{other_hcp_questions}`

渲染逻辑不能因为用户模板中包含普通 JSON braces 或未知占位符而崩溃。

## 验收标准

- [ ] Admin 可以在会议场景中配置会议 Prompt 编排。
- [ ] 新建会议场景时自动带出默认会议 Prompt 模板。
- [ ] 已有会议场景缺少配置时能回落到默认模板。
- [ ] Admin 可以恢复默认模板。
- [ ] HCP 发言顺序可调整，顺序影响实际会议提问顺序。
- [ ] 第一位非主持人 HCP 被识别为主要提问者，其余为次要提问者。
- [ ] 会议场景保存时必须至少包含 1 位主持人。
- [ ] 后端 API 拒绝没有主持人的会议听众配置。
- [ ] 创建会议 session 时会保存 Prompt 配置快照。
- [ ] 会议主持词和 HCP 提问 Prompt 使用 session snapshot 渲染。
- [ ] 用户自定义 Prompt 中存在未知占位符或普通 `{}` 时不会导致运行时异常。
- [ ] 前端 UI 不直接暴露未替换的 i18n 占位符，例如 `{{min}}-{{max}}`。

## 技术建议

### Backend

- 在 `Scenario` model / schema 中增加 `conference_prompt_config`。
- 增加 Alembic migration。
- 新增默认配置 helper，例如 `default_conference_prompt_config()`。
- 新增安全模板渲染逻辑，避免直接使用 Python `.format()` 处理用户模板。
- Conference session 创建时将配置快照写入 `audience_config`。
- `PUT /conference/scenarios/{scenario_id}/audience` 增加主持人校验。

### Frontend

- 在 Scenario editor 中增加 conference prompt form schema 和默认值。
- 会议听众配置组件增加：
  - HCP 顺序调整。
  - 主持人 / 听众角色选择。
  - 主要 / 次要提问提示。
  - 缺主持人校验提示。
- Prompt 配置 UI 建议分区：
  - 发言顺序与主次策略。
  - HCP 提问 Prompt 模板（高级折叠区）。
  - 主持人串场词。

## 测试建议

### Backend Unit / Integration

- 默认会议 Prompt 配置补齐。
- Prompt 安全渲染：未知占位符、普通 JSON braces、不完整配置。
- Conference session 创建时保存 prompt snapshot。
- 主持词和 HCP prompt 从 snapshot 渲染。
- 无主持人的 audience payload 返回 validation error。

### Frontend Unit

- 会议模式下显示会议听众配置和 Prompt 编排区域。
- F2F 模式下不显示会议 Prompt 编排。
- HCP 顺序调整后 sortOrder 正确重排。
- 无主持人时显示错误提示。
- 保存会议场景时无主持人会被拦截。
- i18n 文案能正确替换 min/max。

### E2E

- Admin 创建会议场景，配置 1 位主持人 + 多位听众，调整顺序并保存。
- 启动会议训练，确认主持人先发起，HCP 按配置顺序提问。
- 修改场景 Prompt 后，已创建 session 不受后续配置变化影响。

## 非目标

- 不在本 Issue 中实现复杂 Prompt 版本管理。
- 不在本 Issue 中实现按用户/区域的 Prompt A/B test。
- 不在本 Issue 中实现可视化 Prompt diff / 审批流。

## 相关说明

该能力主要服务于会议培训场景，使业务团队能够快速调整会议流程与 HCP 提问策略。后续如果需要更强治理能力，可以在此基础上扩展 Prompt 版本、发布审批、变更历史和回滚能力。
