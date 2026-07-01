# PR 描述：Foundry 独立区域与 privateBackend 部署加固

## 概要

这个 PR 加强 Azure 部署脚本和 Bicep 模板，支持应用资源和 Foundry/AI Services 资源部署到不同 Azure 区域，并修复 `privateBackend` 网络 profile 下 PostgreSQL Private Endpoint、公网访问关闭、部署失败后重跑和 PostgreSQL Entra bootstrap 的问题。

核心目标是让部署脚本在以下场景都可重复运行：

- 新环境首次部署
- 中途失败后继续重跑
- 已有 Key Vault / PostgreSQL / Container Apps 的增量部署
- `privateBackend` 下应用资源在 East Asia、Foundry 在 Sweden Central 的跨区域部署

## 主要变更

### 1. Foundry 独立区域参数

- 新增 `-FoundryLocation` 部署参数。
- `-Location` 继续控制应用和通用资源区域：
  - Resource Group
  - ACR
  - Storage
  - Key Vault
  - PostgreSQL
  - Container Apps
  - VNet / Private Endpoint
  - Monitoring / Managed Identity
- `-FoundryLocation` 控制 Azure AI Foundry / AI Services 相关资源区域：
  - Azure AI Foundry / AIServices account
  - Foundry project
  - chat/scoring model deployment
  - legacy Azure OpenAI（fullLegacy）
  - Content Understanding（启用时）

示例：

```powershell
.\infra\azure\scripts\deploy.ps1 `
  -NetworkProfile privateBackend `
  -ResourceGroupName ai-coach-privatesandbox01-rg `
  -Location eastasia `
  -FoundryLocation swedencentral `
  -DeployApp
```

### 2. PostgreSQL Private Endpoint + 关闭 public access

- 修复 PostgreSQL Flexible Server public access 配置。
- 将 PostgreSQL Bicep API version 升级到支持 `network.publicNetworkAccess` 的 GA API。
- `privateBackend` 下使用：

```bicep
network: {
  publicNetworkAccess: 'Disabled'
}
```

- 保持 Private Endpoint 模式，不使用 VNet injection，不传 `delegatedSubnetResourceId`。
- PostgreSQL Private Endpoint 使用 `postgresqlServer` groupId。
- `privateBackend` 下不再创建 `AllowAzureServices` firewall rule。

目标状态：

| 项 | 状态 |
| --- | --- |
| PostgreSQL public access | Disabled |
| Allow public access from Azure services | Off |
| Firewall rules | None |
| Private Endpoint | Approved |
| App to DB | Container Apps VNet + Private Endpoint + Private DNS |

### 3. 部署脚本可重跑加固

- 重新设计 bootstrap secret 管理逻辑，避免用“是否已有 Key Vault”粗略判断首次/二次部署。
- 独立判断并管理：
  - JWT secret
  - encryption key
  - PostgreSQL admin password secret
  - PostgreSQL server administrator password
- 部分失败后重跑时：
  - 已存在 secret 不会被默认覆盖。
  - PostgreSQL server 尚未创建时仍会传入必须的 admin password。
  - PostgreSQL server 已存在时不会无意重置 admin password。

### 4. privateBackend 下 PostgreSQL Entra bootstrap 改到 Azure 内执行

之前 PostgreSQL Entra bootstrap 从本机直接连接 PostgreSQL FQDN。`privateBackend` 下这不可靠，因为目标架构应只允许通过 VNet / Private Endpoint 访问 DB。

现在：

- `publicDemo` 仍可从本机执行 bootstrap。
- `privateBackend` 会在 backend Container Apps Job 内执行 `bootstrap_postgres_entra.py`。
- 该 Job 运行在 Container Apps Environment / VNet 内，通过 Private Endpoint 连接 PostgreSQL。
- 脚本会从当前 Azure CLI 登录获取 PostgreSQL Entra admin token，并作为一次性环境变量传给 Job。

这个 bootstrap 做的是 PostgreSQL 数据库内部授权：

- 使用 PostgreSQL Entra admin 登录 DB。
- 创建 backend Managed Identity 对应的 PostgreSQL role。
- 授权 database / schema / table / sequence 权限。

PostgreSQL Entra admin 设置仍由 Bicep 完成；默认使用当前 `az login` 用户，生产环境建议显式传 Entra group。

### 5. Azure 部署文档整理

- 将部署权限和本地工具说明移动到：

```text
infra\azure\docs\azure-deployment-permissions-and-tools.md
```

- 将部署前检查脚本移动到：

```text
infra\azure\scripts\check-azure-deploy-prereqs.ps1
```

- 根 `README.md` 增加：
  - 权限/工具文档链接
  - prereq 检查脚本说明
  - `-FoundryLocation` 说明
  - privateBackend + East Asia + Sweden Central 示例命令

## 验证

- `az bicep build --file infra\azure\main.bicep`
- `deploy.ps1 -WhatIf`
- What-If 确认 PostgreSQL 会从 `network.publicNetworkAccess: Enabled` 更新为 `Disabled`
- `python -m pytest tests\test_bootstrap_postgres_entra.py -q`
- PowerShell parser 检查部署脚本和 prereq 检查脚本
- Sandbox 部署验证：
  - infra 部署成功
  - app image 构建并部署到 ACR / Container Apps
  - PostgreSQL Private Endpoint 创建并 Approved

## 注意事项

- `privateBackend` 下 backend 是 internal ingress，本机不能直接访问 backend URL。
- 验证应通过 public frontend、Container Apps logs、bootstrap job 状态或 Azure Portal / CLI。
- `privateBackend -DeployApp` 不需要本机安装 backend `[postgresql]` 依赖；PostgreSQL Entra bootstrap 在 Azure Container Apps Job 内运行。
- `publicDemo` 或手动本机运行 `bootstrap_postgres_entra.py` 时，仍需要本机 Python 和 backend `[postgresql]` 依赖。
