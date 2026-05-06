# Phase 22: Scenarios 模块二次重构 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 22-scenarios
**Areas discussed:** Editor 全页化, I18N 完整化, 元数据字段精简, 状态机 + 关联关系, 硬编码消除

---

## Editor 全页化

| Option | Description | Selected |
|--------|-------------|----------|
| 对齐 HCP Editor 风格 | 单页 + Tabs（基本信息 / 关联配置 / 评分规则），路由 /admin/scenarios/:id，左上角返回按钮 | ✓ |
| 左右分栏布局 | 左侧表单字段 + 右侧实时预览（如 Rubric 维度、HCP 信息卡片） | |
| 多步骤向导 (Wizard) | 分步填写：基本信息 → 关联 HCP/Skill → 评分配置 → 确认发布 | |

**User's choice:** 对齐 HCP Editor 风格
**Notes:** 与其他模块保持一致的交互体验

---

## I18N 完整化

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 Scenarios 模块 | 只修 Scenario 相关页面/组件的硬编码文本 | |
| Scenarios + 关联组件 | 包括 ScenarioEditor、ScenarioTable、scenario-card 等 | |
| 全局 I18N 审计 | 扫描所有前端页面找出硬编码文本，统一修复 | ✓ |

**User's choice:** 全局 I18N 审计
**Notes:** 中英文必须是完整的两份多语言，消除混杂

---

## 元数据字段精简

| Option | Description | Selected |
|--------|-------------|----------|
| 保留但可配置化 | 保留 product/therapeutic_area，硬编码枚举改为后台可配置 | |
| 删除这两个字段 | 认为不需要，场景分类通过 Skill 或其他方式实现 | |
| 合并为标签系统 | 用自由标签(tags)替代固定字段，更灵活地分类和筛选场景 | ✓ |

**User's choice:** 合并为标签系统

### Follow-up: 标签系统实现方式

| Option | Description | Selected |
|--------|-------------|----------|
| 自由输入标签 | 用户可以输入任意标签，类似 GitHub Issues 的 label | |
| 预定义 + 自定义 | 管理员预定义一批标签，用户也可加自定义标签 | ✓ |
| 纯 JSON 字段 | 用一个 JSON 数组字段 tags 存储，不建单独的 tags 表 | |

**User's choice:** 预定义 + 自定义

---

## 状态机

| Option | Description | Selected |
|--------|-------------|----------|
| draft → active → archived | 三态线性流转，归档后不可再编辑，但可查看和克隆 | ✓ |
| draft → active ↔ archived | 活跃和归档可以互相切换（支持重新激活已归档场景） | |
| draft → review → active → archived | 加入审核环节，需要管理员审批才能发布 | |

**User's choice:** draft → active → archived

---

## 关联关系

**User's choice:** Skill 变为必选，版本锁定保留，Skill 必须是 published 状态
**Notes:** "skill也是必选，而且版本锁定的。必须skill status也是合理的状态" → 仅 published 状态可关联

---

## 硬编码消除

| Option | Description | Selected |
|--------|-------------|----------|
| 仅 Scenario 相关 | 只处理 Scenario 模块中的硬编码（product、therapeutic_area→tags） | |
| 全局扫描 + 统一可配置 | 扫描所有模块的硬编码枚举，统一改为后台可配置 | ✓ |

**User's choice:** 全局扫描 + 统一可配置

### Follow-up: 存储方式

| Option | Description | Selected |
|--------|-------------|----------|
| 数据库配置表 | 新建 system_config 或 enum_options 表，管理员通过 Admin UI 维护 | ✓ |
| 后端配置文件 | 放在 YAML/JSON 配置文件中，修改无需重启 | |
| API + 管理页面 | 后端提供枚举管理 API，前端 Admin 下增加"系统配置"页面 | |

**User's choice:** 数据库配置表

---

## Claude's Discretion

- Tags 表设计细节
- 数据库迁移策略
- 系统枚举表具体 schema
- Tab 内字段分组

## Deferred Ideas

None — discussion stayed within phase scope
