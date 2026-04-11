# LangGraph Azure Hosted Agent 快速指南

## 项目简介
本项目演示如何用 LangGraph 构建支持“人类中断”（human-in-the-loop）的 Azure Hosted Agent，并部署到 Azure AI Foundry。

## 关键步骤

### 1. 本地调试
1. 安装依赖：
   ```bash
   pip install -r requirements.txt
   ```
2. 配置 `.env` 文件，仅保留如下变量（不要包含 AGENT_PROJECT_NAME 等平台保留变量）：
   ```env
   AZURE_OPENAI_ENDPOINT=你的OpenAI服务地址
   AZURE_AI_MODEL_DEPLOYMENT_NAME=你的模型部署名
   ```
3. 运行交互模式（推荐本地开发调试）：
   ```bash
   python main.py
   # 或强制交互模式
   RUN_MODE=interactive python main.py
   ```
4. 运行本地 REST API（模拟线上环境）：
   ```bash
   export AGENT_PROJECT_RESOURCE_ID="/subscriptions/mock/..."
   export APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=mock-key"
   python main.py
   # 访问 http://localhost:8088/
   ```

### 2. 部署到 Azure AI Foundry
1. 确保 `agent.yaml` 中所有名称小写，且无保留变量。
2. 不要在 `.env` 文件中包含 `AGENT_PROJECT_NAME` 等平台注入变量。
3. 清理本地和 VS Code 扩展缓存，避免项目选择和部署混乱：
   - 删除 `.foundry` 目录
   - 删除 VS Code `globalStorage/teamsdevapp.vscode-ai-foundry`
   - 删除 `workspaceStorage` 下相关缓存
4. 重新加载 VS Code，选择正确的 Azure AI Foundry 项目后再部署。
5. Apple Silicon（ARM）本地构建需加平台参数：
   ```bash
   docker build --platform=linux/amd64 -t image .
   ```

## 常见问题
- **环境变量未生效/报错**：用绝对路径加载 `.env`，且不要包含平台保留变量。
- **Docker 镜像名不合规**：`agent.yaml` 里所有名称必须小写。
- **部署到错误项目/缓存问题**：彻底清理 `.foundry` 和 VS Code 扩展缓存，重启 VS Code 并重新选择项目。
- **Apple Silicon 构建失败**：用 `--platform=linux/amd64` 构建镜像，或使用云端构建（`azd`）。

## 参考文档
- [Azure Hosted Agent 官方文档](https://learn.microsoft.com/zh-cn/azure/ai-foundry/agents/concepts/hosted-agents)
- [LangGraph 官方文档](https://docs.langchain.com/oss/python/langgraph/)

