---
status: awaiting_human_verify
trigger: "HCP编辑器中Knowledge连接对话框标签和下拉框显示不正确，应显示实际连接名称但显示通用占位符"
created: 2026-04-10T00:00:00Z
updated: 2026-04-10T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED AND FIXED -- Label和Placeholder使用同一翻译键，已分离为独立键
test: TypeScript + build通过，等待用户在浏览器中确认UI显示正确
expecting: 对话框中Label显示"Connection"/"Knowledge base"，下拉框placeholder显示"选择连接..."/"选择知识库..."，选择后显示实际连接名称
next_action: 等待用户确认修复效果

## Symptoms

expected: Knowledge连接对话框应显示实际连接名称（如"ai-search-southeast-asia"）和知识库名称
actual: 下拉框显示通用占位符文本"AI Search 连接"和"知识库"，没有实际数据
errors: 无明确错误消息，UI显示不正确
reproduction: 在HCP编辑器中打开Knowledge部分，查看连接对话框
started: 最近的功能实现

## Eliminated

## Evidence

- timestamp: 2026-04-10T00:01:00Z
  checked: connect-kb-dialog.tsx lines 94, 101-106, 122, 129-134
  found: Label和SelectValue placeholder都使用同一翻译键t("hcp.selectConnection")和t("hcp.selectKnowledgeBase")
  implication: 用户看到Label="AI Search 连接"，下拉框也显示"AI Search 连接"，无法区分标签和可交互下拉框

- timestamp: 2026-04-10T00:02:00Z
  checked: zh-CN/admin.json lines 146-147, en-US/admin.json lines 146-147
  found: selectConnection="AI Search 连接", selectKnowledgeBase="知识库" -- 这些是分类名称而非引导性placeholder
  implication: placeholder应该是"请选择连接..."/"请选择知识库..."这样的引导性文本

- timestamp: 2026-04-10T00:03:00Z
  checked: 后端API knowledge_base_service.py list_search_connections/list_indexes
  found: 后端代码正确 -- 从Azure AI Foundry获取实际连接数据并返回name/target/is_default
  implication: 问题纯粹在前端UI显示层

## Resolution

root_cause: connect-kb-dialog.tsx中Label和SelectValue placeholder使用相同翻译键(selectConnection/selectKnowledgeBase)，导致标签文本和下拉框占位符文本完全一样("AI Search 连接"/"知识库")，用户无法区分哪个是标签哪个是可交互控件。需要添加独立的Label翻译键和引导性placeholder翻译键。
fix: 1) 在zh-CN/admin.json和en-US/admin.json中添加connectionLabel和knowledgeBaseLabel翻译键用于Label标签；2) 将selectConnection/selectKnowledgeBase翻译值改为引导性占位符文本("选择连接..."/"选择知识库..."); 3) 更新connect-kb-dialog.tsx中Label使用新的connectionLabel/knowledgeBaseLabel键
verification: TypeScript类型检查通过，前端build成功，dist中locale文件已正确更新
files_changed: [frontend/src/components/admin/connect-kb-dialog.tsx, frontend/public/locales/zh-CN/admin.json, frontend/public/locales/en-US/admin.json]
