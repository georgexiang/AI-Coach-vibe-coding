# 07 — Agent 创建与 Skill 配置完整指南

> **目标读者**：后端开发、Vibe Coding Agent
>
> **前置知识**：已阅读 01-06，了解 Agent Registry API、Metadata 约束

---

## 1. Agent 命名规则（Azure AI Foundry 强制要求）

### 1.1 强制约束

Azure AI Foundry 对 `agent_name`（`client.agents.create_version()` 的参数）有严格命名规则：

| 约束 | 规则 | 示例 |
|------|------|------|
| **允许字符** | 仅字母数字 (`a-z`, `A-Z`, `0-9`) 和连字符 (`-`) | `skill-creator` |
| **起始字符** | 必须以字母数字开头 | `a-valid-name` ✅ |
| **结束字符** | 必须以字母数字结尾 | `valid-name-1` ✅ |
| **无连续连字符** | 不允许 `--` | `my-agent` ✅, `my--agent` ❌ |
| **最大长度** | **63 字符**（不是 64） | - |
| **大小写敏感** | `My-Agent` ≠ `my-agent` | - |

### 1.2 禁止的字符

以下字符在 agent name 中 **不允许**：

- 空格 (` `) — "Skill Creator" ❌
- **下划线 (`_`)** — "skill_creator" ❌ （这是本次 bug 的根因！）
- 点 (`.`) — "Dr.Wang" ❌
- 中文字符或其他非 ASCII 字符
- 特殊字符 (`@`, `#`, `$`, `%` 等)

### 1.3 错误消息

传入不合法名字时，Azure API 返回：

```
(invalid_parameters) Must start and end with alphanumeric characters,
can contain hyphens in the middle, and must not exceed 63 characters.
```

### 1.4 验证正则

```python
import re

AGENT_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$')
MAX_AGENT_NAME_LENGTH = 63

def is_valid_agent_name(name: str) -> bool:
    """检查名字是否符合 Azure AI Foundry agent 命名规则."""
    if not name or len(name) > MAX_AGENT_NAME_LENGTH:
        return False
    return bool(AGENT_NAME_PATTERN.match(name))
```

### 1.5 sanitize 函数

平台在 `agent_sync_service.py` 中提供 `_sanitize_agent_name()` 自动转换：

```python
def _sanitize_agent_name(name: str) -> str:
    """将任意字符串转换为合法的 Azure agent name.

    规则:
    - 非字母数字和非连字符的字符 → 替换为连字符（包括下划线！）
    - 合并连续连字符
    - 去除首尾连字符
    - 截断到 63 字符
    - 空字符串回退为 "agent"
    """
    sanitized = re.sub(r"[^a-zA-Z0-9-]", "-", name.strip())
    sanitized = re.sub(r"-+", "-", sanitized).strip("-")
    return sanitized[:63] or "agent"
```

**转换示例**:

| 输入 | 输出 | 说明 |
|------|------|------|
| `Skill Creator` | `Skill-Creator` | 空格→连字符 |
| `skill_creator` | `skill-creator` | 下划线→连字符 |
| `Dr. Wang Fang` | `Dr-Wang-Fang` | 空格和点→连字符 |
| `---invalid---` | `invalid` | 首尾连字符被去除 |
| `""` (空) | `agent` | 回退默认值 |
| `a` * 100 | `a` * 63 | 截断到 63 字符 |

---

## 2. 通过 SDK 创建 Agent

### 2.1 基本创建流程

```python
from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import PromptAgentDefinition

# 1. 初始化客户端
client = AIProjectClient(
    endpoint=project_endpoint,  # https://<resource>.services.ai.azure.com/api/projects/<project>
    credential=credential,       # API Key 或 Entra ID
)

# 2. 定义 Agent
definition = PromptAgentDefinition(
    model="gpt-4o",
    instructions="你是一个 Skill Creator 助手...",
    tools=[],  # 可选: MCPTool, AzureAISearchTool 等
)

# 3. 创建 Agent（agent_name 必须符合命名规则！）
result = client.agents.create_version(
    agent_name="skill-creator",        # ← 合法名字（连字符，无下划线）
    definition=definition,
    description="Skill Creator Agent",  # 自由文本，无限制
    metadata={},                        # 可选 key-value 对，value ≤512 字符
)

# 4. 记录返回的版本号（权威来源）
agent_id = result.name      # "skill-creator"
version = result.version    # 1, 2, 3...（不要自己算！）
```

### 2.2 关键参数约束

| 参数 | 类型 | 约束 |
|------|------|------|
| `agent_name` | `str` | **必须符合命名规则**（见第 1 节） |
| `definition.model` | `str` | 有效的模型部署名（如 `gpt-4o`） |
| `definition.instructions` | `str` | Agent system prompt，无硬性长度限制 |
| `description` | `str` | 自由文本，Portal 中展示 |
| `metadata` | `dict[str, str]` | 每个 value 最大 512 字符（见文档 05） |

### 2.3 版本模型

Azure AI Foundry Agent 采用不可变版本模型：

```
skill-creator v1 → v2 → v3 → ...
```

- **创建**：`create_version(agent_name=..., definition=...)` 创建版本 1
- **更新**：同一个 `create_version()` 调用创建版本 N+1
- **读取**：`get(agent_name=...)` 返回最新版本
- **删除**：`delete(agent_name=...)` 删除整个 agent（含所有版本）

**重要**：每次 `create_version` 后，必须用返回的 `result.version` 更新本地数据库，不要自己计算版本号。

---

## 3. Microsoft Agent Framework Skills（开放规范）

> 参考：https://learn.microsoft.com/en-us/agent-framework/agents/skills

### 3.1 什么是 Agent Skill

[Agent Skills](https://agentskills.io/) 是可移植的指令、脚本和资源包，赋予 Agent 特定领域的能力和专业知识。

Skill 遵循一个开放规范，使用渐进式加载模式（Progressive Disclosure），让 Agent 按需加载所需上下文。

### 3.2 Skill 目录结构

```
expense-report/
├── SKILL.md                          # 必须 — frontmatter + 指令
├── scripts/
│   └── validate.py                   # 可执行脚本
├── references/
│   └── POLICY_FAQ.md                 # 参考文档
└── assets/
    └── expense-report-template.md    # 模板和静态资源
```

### 3.3 SKILL.md 格式

```yaml
---
name: expense-report
description: File and validate employee expense reports. Use when asked about expense submissions.
license: Apache-2.0
compatibility: Requires python3
metadata:
  author: contoso-finance
  version: "2.1"
---

# Skill Instructions

Step-by-step guidance, examples, edge cases...
```

### 3.4 SKILL.md name 字段命名规则

| 字段 | 必填 | 约束 |
|------|------|------|
| `name` | 是 | **最大 64 字符，仅小写字母、数字和连字符，不能以连字符开头或结尾，不能有连续连字符，必须与父目录同名** |
| `description` | 是 | 最大 1024 字符，帮助 Agent 识别何时使用该 Skill |
| `license` | 否 | 许可证名称或引用 |
| `compatibility` | 否 | 最大 500 字符，环境要求 |
| `metadata` | 否 | 任意 key-value 对 |
| `allowed-tools` | 否 | 空格分隔的预批准工具列表（实验性） |

### 3.5 渐进式加载（四阶段）

1. **Advertise**（~100 tokens/skill）— 名字和描述注入 system prompt
2. **Load**（<5000 tokens 推荐）— Agent 调用 `load_skill` 获取完整 SKILL.md
3. **Read resources**（按需）— Agent 调用 `read_skill_resource` 获取参考文件
4. **Run scripts**（按需）— Agent 调用 `run_skill_script` 执行脚本

### 3.6 Python 代码示例

```python
from pathlib import Path
from agent_framework import SkillsProvider
from agent_framework.openai import OpenAIChatCompletionClient
from azure.identity.aio import AzureCliCredential

# 从目录发现 Skills
skills_provider = SkillsProvider(
    skill_paths=Path(__file__).parent / "skills"
)

# 创建带 Skills 的 Agent
agent = OpenAIChatCompletionClient(
    model="gpt-4o",
    azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
    credential=AzureCliCredential(),
).as_agent(
    name="SkillsAgent",
    instructions="You are a helpful assistant.",
    context_providers=[skills_provider],
)
```

### 3.7 代码定义 Skill（无需文件）

```python
from agent_framework import Skill, SkillResource, SkillsProvider

code_style_skill = Skill(
    name="code-style",
    description="Coding style guidelines for the team",
    content="Use this skill for coding style questions...",
    resources=[
        SkillResource(
            name="style-guide",
            content="# Style Guide\n- Use 4-space indentation...",
        ),
    ],
)

skills_provider = SkillsProvider(skills=[code_style_skill])
```

---

## 4. AI Coach 平台中的 Meta Skill Agent

### 4.1 架构

Meta Skills 是平台级 Agent（creator、evaluator），通过 Admin UI 管理：

```
MetaSkill (DB row)
  |-- name: "skill-creator"         # 用作 agent_name（必须合法！）
  |-- display_name: "Skill Creator"  # UI 显示名（无限制）
  |-- skill_type: "creator"          # 枚举: creator | evaluator
  |-- model: "gpt-4o"
  |-- template_content: "..."        # SKILL.md 内容 → agent instructions
  |-- agent_id: "skill-creator"      # 同步后存储
  |-- agent_version: "3"             # 最新版本号
```

### 4.2 name vs display_name

| 字段 | 用途 | 约束 |
|------|------|------|
| `name` | 用作 `agent_name` 传给 Azure API | 必须符合命名规则（第 1 节） |
| `display_name` | UI 展示给管理员 | 无限制，可含空格中文等 |

### 4.3 同步流程

```
Admin 点击 "Sync" 按钮
  → meta_skill_service.sync_meta_skill_agent(db, "creator")
    → agent_sync_service.create_agent(db, name=meta.name, ...)
      → _sanitize_agent_name(meta.name)   # 确保名字合法
      → client.agents.create_version(agent_name=sanitized_name, ...)
    → meta.agent_id = result["id"]        # 存储 agent name
    → meta.agent_version = result["version"]  # 存储版本号
```

### 4.4 默认配置命名约定

| Meta Skill | `name` (DB / agent_name) | `display_name` (UI) |
|-----------|-------------------------|---------------------|
| Creator | `skill-creator` | Skill Creator |
| Evaluator | `skill-evaluator` | Skill Evaluator |

---

## 5. 常见陷阱

| # | 陷阱 | 根因 | 解决方案 |
|---|------|------|---------|
| 1 | `skill_creator` 被 Azure 拒绝 | 下划线不在允许字符列表中 | 使用 `skill-creator`（连字符） |
| 2 | `Skill Creator` 被拒绝 | 空格不允许 | sanitize 为 `Skill-Creator` |
| 3 | 名字超过 63 字符 | Azure 限制 63 字符，代码写了 64 | 截断到 63 |
| 4 | 名字以连字符开头/结尾 | Azure 要求字母数字开头结尾 | strip 首尾连字符 |
| 5 | 用 `display_name` 当 `agent_name` | display_name 可含空格 | 始终用 `name` 字段（预格式化） |
| 6 | 版本号自己算 `+1` | Portal 操作也会递增版本 | 用 `result.version` 返回值 |
| 7 | metadata value >512 字符 | Azure 512 字符硬限制 | 省略 null/默认值（见文档 05） |

---

## 6. 相关代码文件

| 文件 | 作用 |
|------|------|
| `backend/app/services/agent_sync_service.py` | `_sanitize_agent_name()`, `create_agent()`, `update_agent()` |
| `backend/app/services/meta_skill_service.py` | Meta skill CRUD、agent sync、默认配置 |
| `backend/app/models/meta_skill.py` | MetaSkill ORM 模型 |
| `backend/tests/test_agent_sync_service.py` | Agent 名字 sanitization 测试 |
| `backend/tests/test_meta_skill_service.py` | Meta skill 服务测试 |
| `backend/tests/test_skill_creator_service.py` | Skill creator 集成测试 |

---

## 附录 A：Agent Skills 与 AI Coach Skill 的区别

| 维度 | Microsoft Agent Skills（开放规范） | AI Coach Platform Skills |
|------|-----------------------------------|-----------------------|
| 定义方式 | SKILL.md 文件 + 目录结构 | DB 存储 + SKILL.md 模板 |
| 加载方式 | `SkillsProvider` + `agent_framework` 库 | 直接作为 `instructions` 传入 `PromptAgentDefinition` |
| 命名规则 | SKILL.md `name` 字段：小写字母、数字、连字符，≤64 字符 | `agent_name` 参数：字母数字、连字符，≤63 字符 |
| 脚本支持 | `run_skill_script` 执行 `.py` 脚本 | 不支持（模板作为纯文本 instructions） |
| 资源支持 | `read_skill_resource` 读取参考文件 | Skill resources 作为 reference materials 上传 |

> **注意**：虽然概念上相似，AI Coach 当前不使用 `agent_framework` 库的 `SkillsProvider`。
> 而是将 Skill 模板直接作为 Agent 的 `instructions` 传给 Azure AI Foundry Agent Registry API。
> 未来可考虑迁移到 Agent Framework Skills 规范以获得更丰富的功能（脚本、资源、渐进式加载等）。
