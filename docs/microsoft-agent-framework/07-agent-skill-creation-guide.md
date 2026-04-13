# 07 — Azure Agent API 操作指南

> **目标读者**：后端开发、Vibe Coding Agent
>
> **前置知识**：已阅读 01-06，了解 Agent Registry API、Metadata 约束
>
> **相关文档**：Skills 规范详见 [08-agent-skills-specification.md](./08-agent-skills-specification.md)

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

## 3. AI Coach 平台中的 Meta Skill Agent

### 3.1 架构

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

### 3.2 name vs display_name

| 字段 | 用途 | 约束 |
|------|------|------|
| `name` | 用作 `agent_name` 传给 Azure API | 必须符合命名规则（第 1 节） |
| `display_name` | UI 展示给管理员 | 无限制，可含空格中文等 |

### 3.3 同步流程

```
Admin 点击 "Sync" 按钮
  → meta_skill_service.sync_meta_skill_agent(db, "creator")
    → agent_sync_service.create_agent(db, name=meta.name, ...)
      → _sanitize_agent_name(meta.name)   # 确保名字合法
      → client.agents.create_version(agent_name=sanitized_name, ...)
    → meta.agent_id = result["id"]        # 存储 agent name
    → meta.agent_version = result["version"]  # 存储版本号
```

### 3.4 默认配置命名约定

| Meta Skill | `name` (DB / agent_name) | `display_name` (UI) |
|-----------|-------------------------|---------------------|
| Creator | `skill-creator` | Skill Creator |
| Evaluator | `skill-evaluator` | Skill Evaluator |

> **Skill 目录结构和 SKILL.md 格式规范**详见 [08-agent-skills-specification.md](./08-agent-skills-specification.md)。

---

## 4. 常见陷阱

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

## 5. 相关代码文件

| 文件 | 作用 |
|------|------|
| `backend/app/services/agent_sync_service.py` | `_sanitize_agent_name()`, `create_agent()`, `update_agent()` |
| `backend/app/services/meta_skill_service.py` | Meta skill CRUD、agent sync、默认配置 |
| `backend/app/models/meta_skill.py` | MetaSkill ORM 模型 |
| `backend/tests/test_agent_sync_service.py` | Agent 名字 sanitization 测试 |
| `backend/tests/test_meta_skill_service.py` | Meta skill 服务测试 |
| `backend/tests/test_skill_creator_service.py` | Skill creator 集成测试 |
