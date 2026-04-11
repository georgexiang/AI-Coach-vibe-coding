# Phase 19: AI Coach Skill Module - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 19-ai-coach-skill-module-skill-lifecycle-management-material-to
**Areas discussed:** SOP结构格式, 质量门控交互, Skill Hub与管理UI, Skill分配与SOP驱动

---

## SOP 结构格式

| Option | Description | Selected |
|--------|-------------|----------|
| 两层结构（Phase > Step） | 阶段>步骤，简洁遍历方便 | |
| 三层结构 | 模块>阶段>步骤，支持复杂场景 | |
| 扁平列表 | 纯步骤序列，最简单 | |

**User's choice:** 自适应层级 — 根据材料复杂度自动决定，后续修正为对齐 SKILL.md 规范
**Notes:** 用户认为应根据内容复杂度和长短决定

| Option | Description | Selected |
|--------|-------------|----------|
| 完整字段集 | 标题、描述、要点、异议、考核、知识点、时间建议 | ✓ |
| 精简字段集 | 标题、描述、要点、考核 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 完整字段集

| Option | Description | Selected |
|--------|-------------|----------|
| 异步转换+实时状态 | 前端轮询status，大文件不卡UI | ✓ |
| 同步转换+进度条 | 等待完成，显示进度条 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 异步转换+实时状态

| Option | Description | Selected |
|--------|-------------|----------|
| 必须可编辑 | Admin手动调整SOP | |
| 只读展示 | 不满意重新上传 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 双轨编辑 — 手动编辑 + AI反馈式修改（Admin输入修改意见，AI重新生成）
**Notes:** 用户提出可以通过AI方式提出修改意见重新生成

---

## 质量门控交互

| Option | Description | Selected |
|--------|-------------|----------|
| SOP生成后自动触发 | L1即时+L2 Admin手动触发 | ✓ |
| 发布前手动触发 | 减少AI调用成本 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** SOP生成后自动触发

**User's clarification question:** L2 质量评估与 Scoring Rubrics 的关系是什么？
**Claude's explanation:** L2 评估评的是"Skill设计得好不好"（SOP完整性/考核覆盖度等），Scoring Rubrics 评的是"MR做得好不好"（Key Message Delivery/Objection Handling等）。两者独立。

| Option | Description | Selected |
|--------|-------------|----------|
| 雷达图+详情卡片 | 复用已有评分组件，六维雷达图+可展开详情 | ✓ |
| 简单表格 | 六行表格，简洁直接 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 雷达图+详情卡片

| Option | Description | Selected |
|--------|-------------|----------|
| 弹窗确认+原因展示 | 展示低分维度及改进建议 | ✓ |
| 简单确认 | 只显示分数和确认按钮 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 弹窗确认+原因展示

---

## Skill Hub 与管理 UI

| Option | Description | Selected |
|--------|-------------|----------|
| 卡片网格布局 | 类似Scenario选择页 | ✓ |
| 表格布局 | 信息密度高，排序筛选方便 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 卡片网格布局

**User's clarification question:** Skill 和 Scenario 怎么区分？
**Claude's explanation:** Scenario = WHO + WHAT + HOW MUCH（场景环境），Skill = HOW（标准流程/SOP）。训练会话 = Scenario + Skill。

| Option | Description | Selected |
|--------|-------------|----------|
| Skill独立管理+场景关联 | Skill Hub独立，Scenario编辑时关联Skill | ✓ |
| Skill融入Scenario | Skill作为Scenario属性 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** Skill独立管理+场景关联

**User's clarification question:** MR 是否需要看到 Skill Hub？
**User's answer:** 不需要，MR只看到Scenario。
**Decision:** Skill Hub 是纯 Admin 功能

---

## Skill 分配与 SOP 驱动

| Option | Description | Selected |
|--------|-------------|----------|
| Skill分配给Scenario | 一个Scenario关联一个Skill | ✓ |
| Skill直接分配给HCP Agent | 通过SkillAssignment分配 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** Skill分配给Scenario

**User's key input:** 底层使用 Microsoft Agent Framework，原生支持 Skill。参考代码：`azure_foundary_hosted_agents-main/agent-framework/agent-with-skills/`

| Option | Description | Selected |
|--------|-------------|----------|
| 对齐SKILL.md规范 | YAML frontmatter + Markdown body，与Azure Agent Framework兼容 | ✓ |
| 纯JSON结构化 | 结构化强但不直接兼容 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 对齐SKILL.md规范

| Option | Description | Selected |
|--------|-------------|----------|
| 一对一关联 | 一个Scenario关联一个Skill | ✓ |
| 多对多 | 灵活但复杂 | |
| 你来决定 | Claude 自行决定 | |

**User's choice:** 一对一（后期可扩展为多对多）

---

## Claude's Discretion

- SOP 步骤层级的自适应策略
- Skill 编辑器 UI 组件选择
- L1 结构检查规则集
- Skill 卡片信息密度
- ZIP 包目录结构

## Deferred Ideas

- Dry Run 模拟测试 — Phase 20
- Skill 多对多关联 — 后期扩展
- MR 用户 Skill Hub 视图 — 不需要
- Skill 版本对比 — 后期增强
- 客户预览链接 — 待评估
