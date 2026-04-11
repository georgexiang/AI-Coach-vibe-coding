# Agent with Skills 操作指南

本文档介绍如何编译、配置和部署 agent-with-skills 到 Azure AI Foundry。

## 目录

- [前提条件](#前提条件)
- [项目结构](#项目结构)
- [本地开发](#本地开发)
- [配置说明](#配置说明)
- [部署到 Azure AI Foundry](#部署到-azure-ai-foundry)
- [自定义 Skill](#自定义-skill)
- [故障排查](#故障排查)

---

## 前提条件

- Python 3.12+
- Docker（本地构建镜像时需要）
- Azure CLI 已安装并完成登录（`az login`）
- Azure Developer CLI (`azd`) 已安装
- 一个 Azure AI Foundry 项目，且已部署 chat 模型（如 `gpt-4o`、`gpt-4.1-mini`）
- Azure OpenAI 资源及其 endpoint

### 安装 Azure Developer CLI

```bash
# macOS
brew install azd

# Linux
curl -fsSL https://aka.ms/install-azd.sh | bash

# Windows
winget install microsoft.azd
```

---

## 项目结构

```
agent-with-skills/
├── main.py               # Agent 入口，读取环境变量，加载 Skill，启动 HTTP 服务
├── skill_manager.py      # SkillManager 核心模块，负责加载和组合 Skill
├── agent.yaml            # Azure AI Foundry 部署配置
├── Dockerfile            # 容器镜像构建配置
├── requirements.txt      # Python 依赖
├── README.md             # 项目说明
└── skills/               # 内置 Skill 目录
    ├── travel-advisor/
    │   └── SKILL.md      # 旅行规划 Skill
    └── code-reviewer/
        └── SKILL.md      # 代码审查 Skill
```

---

## 本地开发

### 安装依赖

```bash
cd agent-framework/agent-with-skills
pip install -r requirements.txt
```

### 初始化环境变量

项目提供了 `.env.sample` 模板文件，包含所有环境变量及说明。

**步骤 1：复制模板**

```bash
cp .env.sample .env
```

**步骤 2：编辑 `.env`，填入实际值**

必需的两个变量是 `AZURE_OPENAI_ENDPOINT` 和 `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME`。你需要从 Azure 订阅中选择一个已部署 chat 模型的 OpenAI 资源。

查询当前订阅下的 OpenAI 资源和模型部署：

```bash
# 列出所有 OpenAI / AIServices 资源
az cognitiveservices account list \
  --query "[?kind=='OpenAI' || kind=='AIServices'].{name:name, rg:resourceGroup, endpoint:properties.endpoint, kind:kind}" \
  -o table

# 列出某个资源上的模型部署（替换 NAME 和 RG）
az cognitiveservices account deployment list \
  --name <resource-name> --resource-group <resource-group> \
  --query "[].{name:name, model:properties.model.name}" -o table
```

将查到的 endpoint 和部署名填入 `.env`：

```bash
AZURE_OPENAI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
AZURE_OPENAI_CHAT_DEPLOYMENT_NAME=<your-deployment-name>
```

**步骤 3：登录 Azure**

Agent 使用 `DefaultAzureCredential` 做认证，本地开发时依赖 Azure CLI 登录令牌，不需要配置 API Key：

```bash
az login --use-device-code
```

**步骤 4：加载环境变量并启动**

```bash
# 将 .env 文件加载到当前 shell
export $(grep -v '^#' .env | grep -v '^\s*$' | xargs)

# 启动 Agent
python main.py
```

`.env` 文件已在 `.gitignore` 中，不会被提交到仓库。

### 启动 Agent

```bash
python main.py
```

Agent 在 `http://localhost:8088/` 启动，提供 OpenAI Responses 协议兼容的 REST API。

### 测试 Agent

```bash
curl -X POST http://localhost:8088/responses \
  -H "Content-Type: application/json" \
  -d '{"input": "推荐一个三天的东京旅行计划"}' | jq .
```

---

## 配置说明

### 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `AZURE_OPENAI_ENDPOINT` | 是 | Azure OpenAI 资源的 endpoint URL |
| `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` | 是 | 模型部署名称（如 `gpt-4o`） |
| `AGENT_SKILLS` | 否 | 要加载的 Skill 列表（逗号分隔），不设置时自动加载 skills/ 目录下所有内置 Skill |
| `AGENT_BASE_INSTRUCTIONS` | 否 | 覆盖默认的 Agent 基础指令 |
| `AGENT_MAX_SKILL_TOKENS` | 否 | Skill 指令的 token 上限，默认 4000 |
| `ENABLE_WEB_SEARCH` | 否 | 设为 `true` 启用 Web 搜索工具 |
| `AZURE_AI_PROJECT_TOOL_CONNECTION_ID` | 否 | MCP 工具的连接 ID |

### AGENT_SKILLS 格式

使用 `source:identifier` 格式，多个 Skill 用逗号分隔：

| 来源 | 格式 | 示例 |
|------|------|------|
| 本地目录 | `local:<skill-name>` | `local:travel-advisor` |
| Git 仓库（全部） | `git:<repo-url>` | `git:https://github.com/org/skills.git` |
| Git 仓库（指定） | `git:<repo-url>#<name1>,<name2>` | `git:https://github.com/org/skills.git#skill-a` |
| ClawHub | `clawhub:<slug>` | `clawhub:couple-coach` |
| URL | `url:<url>` | `url:https://example.com/SKILL.md` |

示例：

```bash
# 仅加载内置 Skill
export AGENT_SKILLS="local:travel-advisor,local:code-reviewer"

# 从 Git 仓库安装全部 Skill
export AGENT_SKILLS="git:https://github.com/kepano/obsidian-skills.git"

# 混合来源
export AGENT_SKILLS="local:travel-advisor,clawhub:couple-coach,git:https://github.com/org/repo.git#my-skill"
```

### agent.yaml 配置

[agent.yaml](../agent-framework/agent-with-skills/agent.yaml) 是 Azure AI Foundry 的部署描述文件，定义 Agent 名称、协议和环境变量：

```yaml
name: af-agent-with-skills
description: >
  An AI agent that supports installing and composing external standard skills.
template:
  name: af-agent-with-skills
  kind: hosted
  protocols:
    - protocol: responses
  environment_variables:
    - name: AZURE_OPENAI_ENDPOINT
      value: ${AZURE_OPENAI_ENDPOINT}
    - name: AZURE_OPENAI_CHAT_DEPLOYMENT_NAME
      value: "{{chat}}"
    - name: AGENT_SKILLS
      value: "local:travel-advisor,local:code-reviewer"
```

关键字段说明：

- `kind: hosted` — 以托管容器方式运行
- `protocols: responses` — 使用 OpenAI Responses 协议
- `"{{chat}}"` — 在部署时自动替换为 Foundry 项目中配置的 chat 模型
- `${AZURE_OPENAI_ENDPOINT}` — 在部署时从 Foundry 项目环境中注入

修改 `AGENT_SKILLS` 的 value 字段来控制部署后 Agent 加载哪些 Skill。使用 Git 来源时不需要重新构建镜像，只需更新环境变量并重新部署。

---

## 部署到 Azure AI Foundry

### 步骤 1：登录 Azure

```bash
az login
azd auth login
```

### 步骤 2：初始化 Agent 项目

在 `agent-with-skills/` 目录下执行：

```bash
cd agent-framework/agent-with-skills
azd ai agent init
```

该命令读取 `agent.yaml`，配置项目资源绑定（Azure OpenAI endpoint、模型部署等），生成必要的部署元数据。

### 步骤 3：部署

```bash
azd up
```

`azd up` 执行以下操作：

1. 根据 `Dockerfile` 构建容器镜像（在云端构建，确保 linux/amd64 架构）
2. 将镜像推送到 Azure Container Registry (ACR)
3. 在 AI Foundry 上创建 Hosted Agent 版本和部署
4. 注入环境变量（从 agent.yaml 和 Foundry 项目中读取）

部署完成后，终端输出包含 Agent 的 endpoint URL。

### 步骤 4：验证部署

在 Azure AI Foundry 门户中查看 Agent：

1. 打开 [Azure AI Foundry](https://ai.azure.com)
2. 进入对应的项目
3. 在左侧导航栏找到 "Agents" 菜单
4. 找到名为 `af-agent-with-skills` 的 Agent
5. 在 Playground 中发送测试消息

也可以通过 CLI 测试：

```bash
curl -X POST <your-agent-endpoint>/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(az account get-access-token --query accessToken -o tsv)" \
  -d '{"input": "帮我规划一个五天的日本旅行计划"}' | jq .
```

### 更新部署

修改代码或配置后，重新部署：

```bash
# 仅更新 Agent 代码（不重新配置基础设施）
azd deploy

# 完整更新（包括基础设施变更）
azd up
```

---

## 自定义 Skill

### 添加内置 Skill

1. 在 `skills/` 目录下创建子目录，目录名即为 Skill 名称：

```bash
mkdir -p skills/my-skill
```

2. 创建 `SKILL.md` 文件，包含 YAML frontmatter 和 Markdown 指令：

```markdown
---
name: my-skill
description: 一句话说明 Skill 的用途和使用场景。
---

## Role

你在这里定义 Agent 的角色和行为...

## Capabilities

- 能力 1
- 能力 2
```

3. `name` 字段必须与目录名一致。

4. 重新构建镜像并部署：

```bash
azd up
```

### 通过 Git 仓库安装 Skill（免重建镜像）

修改 `agent.yaml` 中的 `AGENT_SKILLS` 值，添加 Git 来源：

```yaml
environment_variables:
  - name: AGENT_SKILLS
    value: "local:travel-advisor,git:https://github.com/your-org/your-skills.git"
```

然后重新部署：

```bash
azd deploy
```

Agent 在启动时自动从 Git 仓库克隆并加载 Skill，无需重新构建容器镜像。

---

## 故障排查

### 镜像架构不兼容

在 Apple Silicon (ARM64) 上本地构建的镜像无法在 Azure 上运行。使用 `azd up` 进行云端构建（推荐），或在本地构建时指定目标平台：

```bash
docker build --platform=linux/amd64 -t agent-with-skills .
```

### Agent 启动失败：缺少环境变量

Agent 启动时会检查 `AZURE_OPENAI_ENDPOINT` 和 `AZURE_OPENAI_CHAT_DEPLOYMENT_NAME` 两个必需变量。如果缺失，程序抛出 `AssertionError`。检查：

- 本地运行：确认已 `export` 对应的环境变量
- Foundry 部署：确认 `agent.yaml` 中的 `environment_variables` 配置正确

### Git Skill 加载失败

- 确认 Git URL 格式正确：必须以 `.git` 结尾
- 确认容器内有 `git` 命令（Dockerfile 已包含 `apt-get install git`）
- 检查 Git 仓库是否可公开访问（私有仓库需要配置认证）
- 克隆超时默认 60 秒，大型仓库可能超时

### ClawHub Skill 加载失败

- 确认 slug 名称仅包含字母、数字、下划线和连字符
- 下载限制为 1MB，超大 Skill 会被拒绝

### Token 超限警告

日志中出现 `Total token estimate exceeds max_tokens` 警告时，表示加载的 Skill 指令总量超过预算。处理方式：

- 减少同时加载的 Skill 数量
- 提高 `AGENT_MAX_SKILL_TOKENS` 值
- 精简 SKILL.md 中的指令内容
