# Azure 部署人员权限与本地工具要求

> 用途：给准备运行 `infra\azure\scripts\deploy.ps1` 的同事确认自己是否具备部署权限和本地工具环境。
>
> 适用脚本：`infra\azure\scripts\deploy.ps1`、`infra\azure\scripts\build-and-push.ps1`、`infra\azure\scripts\test-region-availability.ps1`

## 一句话结论

最省事的部署账号权限是：**目标 Azure 订阅级 Owner**。

如果做最小权限拆分，部署账号至少需要：

- **Contributor**：创建/更新 Azure 资源。
- **User Access Administrator**：创建 RBAC role assignments。

只给 **Contributor 不够**，因为当前 Bicep 会自动给 backend Managed Identity 和 GitHub OIDC Managed Identity 分配 RBAC 角色。

## 1. 部署脚本为什么需要订阅级权限

`infra\azure\main.bicep` 是 subscription-scope template：

```bicep
targetScope = 'subscription'
```

部署脚本执行的是：

```powershell
az deployment sub create ...
```

所以部署用户需要在目标订阅上有足够权限，而不只是某个资源组里的权限。

脚本默认会创建或更新：

- Resource Group
- Azure Container Registry
- Azure Container Apps / Container Apps Job
- Log Analytics / Application Insights
- User-assigned Managed Identity
- Key Vault
- Azure Database for PostgreSQL Flexible Server
- Storage Account / Blob containers
- Azure AI Foundry / Azure AI Services
- Azure OpenAI model deployment
- 可选：VNet、Private Endpoint、Private DNS Zone
- 可选：Speech / Avatar、Content Understanding、Azure AI Search
- GitHub OIDC federated credential
- Azure RBAC role assignments

## 2. Azure RBAC 权限要求

| 权限 | 是否需要 | 原因 |
| --- | --- | --- |
| Owner | 推荐 | 同时包含资源管理和角色分配能力，最省事 |
| Contributor | 需要 | 创建/更新 ACR、Container Apps、PostgreSQL、Storage、Key Vault、Foundry 等资源 |
| User Access Administrator | 需要，如果不是 Owner | 创建 `Microsoft.Authorization/roleAssignments` |
| Reader | 不够 | 只能看资源，不能部署 |
| Contributor 单独使用 | 不够 | 不能创建 role assignments |

当前模板会创建这些 role assignments：

| 角色 | 分配给 | 用途 |
| --- | --- | --- |
| AcrPull | backend Managed Identity | 后端 Container App 拉取 ACR 镜像 |
| Key Vault Secrets Officer | backend Managed Identity | Admin UI 写 Key Vault service keys |
| Storage Blob Data Contributor | backend Managed Identity | 读写私有 Blob materials/audio |
| Cognitive Services User | backend Managed Identity | 调用 Azure AI / Foundry / Speech / CU |
| Azure AI Developer | backend Managed Identity | Azure AI / Foundry runtime 操作 |
| Search Index Data Contributor | backend Managed Identity，可选 | Azure AI Search 模式 |
| Contributor | GitHub OIDC Managed Identity | GitHub Actions 后续部署资源 |
| AcrPush | GitHub OIDC Managed Identity | GitHub Actions 推送镜像到 ACR |

## 3. Entra ID 权限要求

### 3.1 PostgreSQL Entra admin

默认部署模式是：

```powershell
-BackendDatabaseAuthMode azureAd
```

如果不显式传：

```powershell
-PostgresEntraAdminLogin
-PostgresEntraAdminObjectId
```

脚本会用当前 `az login` 用户作为 PostgreSQL Entra admin：

```powershell
az ad signed-in-user show
```

这里的 PostgreSQL Entra admin **不要求必须是 Entra 全局管理员**。通常普通 Entra ID user 也可以被设置为 PostgreSQL Entra admin，只要：

1. 这个 user 能被 Entra 解析到 `userPrincipalName` 和 `object id`。
2. 执行部署的 Azure 账号有足够 Azure RBAC 权限去创建 PostgreSQL administrator 子资源。
3. 后续 DB bootstrap 能用这个身份获取 PostgreSQL Entra token 并连接数据库。`privateBackend` 部署会在 Azure Container Apps Job 内执行 bootstrap；`publicDemo` 或手动运行脚本时才从本机执行。

生产环境更推荐使用 Entra group，而不是个人用户：

```powershell
.\infra\azure\scripts\deploy.ps1 `
  -PostgresEntraAdminLogin "<admin-group-name>" `
  -PostgresEntraAdminObjectId "<admin-group-object-id>" `
  -PostgresEntraAdminPrincipalType Group
```

使用 group 的好处是人员变更时不用改 PostgreSQL admin，只需要维护 group 成员。

### 3.2 查询 Entra object id

如果使用当前登录用户：

```powershell
az ad signed-in-user show --query "{userPrincipalName:userPrincipalName,id:id}" --output table
```

如果使用 group：

```powershell
az ad group show --group "<group-name-or-object-id>" --query "{displayName:displayName,id:id}" --output table
```

如果当前用户没有查询 group 的权限，需要请 Entra 管理员提供 group object id。

## 4. 本地工具要求

| 工具 | 是否必须 | 用途 |
| --- | --- | --- |
| PowerShell 7+ | 推荐 | 运行 `deploy.ps1`，对 UTF-8 / `utf8NoBOM` 支持更稳定 |
| Azure CLI | 必须 | 登录 Azure、what-if、Bicep 部署、ACR build、Container Apps update |
| Azure CLI Bicep | 必须 | `az bicep build --file infra\azure\main.bicep` |
| Python 3.11+ | 视场景需要 | 只有从本机运行 `backend\scripts\bootstrap_postgres_entra.py`、本地开发或本地测试时需要；`privateBackend -DeployApp` 云端 bootstrap 不需要 |
| backend Python `[postgresql]` 依赖 | 视场景需要 | 只有本机运行 PostgreSQL Entra bootstrap 或 backend 测试时需要；`privateBackend -DeployApp` 使用云端 backend image 自带依赖 |
| GitHub CLI `gh` | 可选 | 只有运行 `set-github-vars.ps1` 写 GitHub repo variables 时需要 |
| Docker | 不必须 | `-DeployApp` 使用 `az acr build` 在 Azure ACR 远端构建 |
| Node.js / npm | 不必须 | 部署镜像构建在 ACR Dockerfile 里完成；本地开发/测试才需要 |

## 5. Windows 安装方法

### 5.1 PowerShell 7+

```powershell
winget install --id Microsoft.PowerShell --source winget
```

安装后用 `pwsh` 启动 PowerShell 7：

```powershell
pwsh
$PSVersionTable.PSVersion
```

### 5.2 Azure CLI

```powershell
winget install --id Microsoft.AzureCLI --source winget
```

验证：

```powershell
az version
az login
az account set --subscription "<subscription-id-or-name>"
az account show --output table
```

### 5.3 Azure CLI Bicep

Azure CLI 通常自带 Bicep 支持。验证：

```powershell
az bicep version
```

如果没有安装或版本太旧：

```powershell
az bicep install
az bicep upgrade
```

### 5.4 Python 3.11+（仅本机 bootstrap / 本地开发需要）

```powershell
winget install --id Python.Python.3.11 --source winget
```

验证：

```powershell
python --version
```

如果需要从本机运行 PostgreSQL Entra bootstrap 脚本（例如 `publicDemo`、手动排查，或本地测试 backend），安装 backend PostgreSQL 依赖：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[postgresql]"
```

如果使用 `privateBackend -DeployApp`，PostgreSQL Entra bootstrap 会在 Azure Container Apps Job 内运行，使用云端 backend image 中的依赖；本机只需要 Azure CLI、Bicep 和 PowerShell，不需要为这一步安装 backend Python 包。

如果还要本地运行完整开发/测试依赖：

```powershell
python -m pip install -e ".[dev,postgresql,voice]"
```

### 5.5 GitHub CLI（可选）

```powershell
winget install --id GitHub.cli --source winget
gh auth login
```

只有要运行下面脚本时才需要：

```powershell
.\infra\azure\scripts\set-github-vars.ps1 ...
```

## 6. 部署前推荐检查命令

从 repo 根目录运行：

```powershell
.\infra\azure\scripts\check-azure-deploy-prereqs.ps1
```

如果要顺便检查当前用户在订阅上的显式 role assignments：

```powershell
.\infra\azure\scripts\check-azure-deploy-prereqs.ps1 -CheckAzureRoles
```

注意：Azure role 可能来自 group 继承，脚本只能做基础提示，最终以 Azure Portal / `az role assignment` 实际结果为准。

## 7. 推荐部署前流程

```powershell
az login
az account set --subscription "<subscription-id-or-name>"

.\infra\azure\scripts\check-azure-deploy-prereqs.ps1 -CheckAzureRoles

.\infra\azure\scripts\test-region-availability.ps1 -StopOnFirstPass
.\infra\azure\scripts\deploy.ps1 -WhatIf
.\infra\azure\scripts\deploy.ps1
```

如果要同时构建并部署当前本地分支的应用镜像：

```powershell
.\infra\azure\scripts\deploy.ps1 -DeployApp
```

运行 `-DeployApp` 前请确认当前 git branch/worktree 就是要部署到 Azure 的代码，因为 ACR build 会使用本地 `backend\` 和 `frontend\` 目录。
