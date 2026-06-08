# Azure 私有后端网络 Profile 规划

## 目的

本文档规划 AI Coach 平台的第二套 Azure 部署网络 profile。现有部署继续保留为公开 demo profile；新的 profile 目标是：只有 frontend 可以被公网访问，其余后端服务在 Azure 支持的情况下都通过私有网络访问。

本文档只做架构和网络规划，不修改当前 Bicep 部署。

## Profile 设计

| Profile | 用途 | 公网入口 |
|---|---|---|
| `publicDemo` | 当前快速验证/demo 部署 | Frontend 和 backend |
| `privateBackend` | 面向生产的私有后端部署 | 仅 frontend |

## 当前公网架构

当前模板是 public-first 部署：

- `main.bicep` 暴露了 `networkProfile` 参数，但目前只允许 `publicDemo`。
- Container Apps 没有接入 VNet。
- 在 public profile 下，frontend 和 backend Container Apps 都使用公网 ingress。
- PostgreSQL Flexible Server 是公网访问，并且包含 `AllowAzureServices` firewall rule。
- Storage 开启 public network access；容器本身是 private。
- Key Vault 开启 public network access，并且 `networkAcls.defaultAction` 是 `Allow`。
- Azure AI Foundry、Azure OpenAI、Speech/Avatar、Content Understanding、Azure AI Search 和 ACR 当前都可以通过公网访问。
- Log Analytics 和 Application Insights 的公网 ingestion/query 当前保持开启。

## 目标私有后端架构

`privateBackend` 的目标流量形态如下：

```text
Internet
   |
   v
Frontend Container App（public ingress）
   |
   | 私有 app-to-app 流量
   v
Backend Container App（internal ingress）
   |
   +--> PostgreSQL private network
   +--> Storage private endpoint
   +--> Key Vault private endpoint
   +--> Azure AI service / Foundry inbound private endpoints（如果支持）
   +--> Azure AI Search private endpoint（如果启用 Search）
   +--> ACR private endpoint（如果 SKU 和部署流程支持）
```

只有 frontend 应该能被公网直接访问。Backend API 只能从 Container Apps 环境内部或 VNet 内访问。

## 网络参数规划

部署应允许用户传入明确的 IP 网段。如果用户不传入，则模板自动创建 VNet 并使用安全默认值。

| 参数 | 默认值 | 用途 |
|---|---:|---|
| `vnetName` | 根据项目和环境生成 | 可选 VNet 名称；为空表示自动创建。 |
| `vnetAddressPrefix` | `10.60.0.0/16` | 部署 VNet 地址空间。 |
| `containerAppsSubnetPrefix` | `10.60.0.0/23` | Container Apps Environment infrastructure delegated subnet。 |
| `privateEndpointsSubnetPrefix` | `10.60.2.0/24` | Private endpoints 使用的 subnet。 |
| `buildAgentsSubnetPrefix` | 可选 | 未来给私有 build/deployment runner 使用。 |
| `jumpSubnetPrefix` | 可选 | 未来给 jump host、Bastion 或 VPN 运维访问使用。 |

Subnet 规则：

- Container Apps subnet 应 delegation 到 `Microsoft.App/environments`。
- Private endpoint subnet 应关闭 private endpoint network policies。
- 运维 subnet 可以预留，但第一版实现不强制需要。

## Private Endpoint 和 DNS 规划

Private endpoint 需要配套 private DNS zone，并 link 到部署使用的 VNet。

| 服务 | Private DNS zone | 目标行为 |
|---|---|---|
| Storage Blob | `privatelink.blob.core.windows.net` | Backend 通过私有 blob endpoint 访问。 |
| Key Vault | `privatelink.vaultcore.azure.net` | Backend 和平台 Key Vault references 都应私有解析。 |
| PostgreSQL Flexible Server | `privatelink.postgres.database.azure.com` | private profile 下数据库不走公网。 |
| Azure AI Search | `privatelink.search.windows.net` | 仅在启用可选 Search 部署时需要。 |
| Azure Container Registry | `privatelink.azurecr.io` | 候选项：实现完全私有 image pull；可能要求 Premium SKU。 |
| Azure OpenAI / Cognitive Services | `privatelink.cognitiveservices.azure.com` | 实现前需要验证具体 endpoint 域名。 |
| Speech / Avatar / Voice Live | `privatelink.cognitiveservices.azure.com` | 需要验证目标区域和 preview 功能的 private endpoint 行为。 |
| Content Understanding | `privatelink.cognitiveservices.azure.com` | 需要在实现前验证 preview API endpoint 行为。 |
| Azure AI Foundry | 服务特定域名 | `privateBackend` 第一版只要求 inbound private endpoint；需要验证 Foundry project、target subresource 和 `services.ai.azure.com` 的 private link 行为。 |

## Azure AI Foundry 私有网络决策

Foundry 网络需要拆成 inbound 和 outbound 两层，不应只用“Foundry 是否 private endpoint”来概括。

### Inbound：Backend -> Foundry

`privateBackend` 第一版必须私有化这条 data-plane 路径：

- Foundry public network access 应禁用。
- Backend Container App 接入 VNet。
- 在应用 VNet 中创建 Foundry Private Endpoint。
- 配套 private DNS zone / VNet link，让 backend 在 VNet 内把 Foundry endpoint 解析到 private IP。
- Backend 调用 Foundry 的 URL 通常保持不变，由 DNS 决定走 private endpoint。
- Azure Portal、ARM、Azure CLI 等控制平面仍走 Azure 公共管理端点，这是 Azure PaaS 正常行为，不代表 data-plane 没有私有化。

### Outbound：Foundry -> 下游资源

`privateBackend` 第一版不把 Foundry outbound Managed VNet 作为必需项。

当前代码里明确会触发“Foundry/CU 需要访问存储”的问题是 voice score：

- 本地模式下，backend 读取本地音频文件，base64 后以 `data` 方式提交给 Content Understanding。
- 云端当前模式下，backend 把 Azure Blob URL 交给 Content Understanding；如果 Blob 是 private 且 URL 不带 SAS，CU 无法读取，voice score 会失败。

因此第一版建议把云端 voice score 改成和本地一致：

1. Backend 使用 Managed Identity 通过 Storage Private Endpoint 读取 Blob 音频。
2. Backend 将音频内容 base64 编码。
3. Backend 以 `data` 方式提交给 Content Understanding。
4. Content Understanding / Foundry 不需要直接访问 private Blob。

这样 Blob 只需要信任 backend，不需要为了 voice score 让 Foundry outbound 访问 Blob。网络边界更简单，也避免把应用数据流问题变成 Foundry 网络问题。

### 未来 Foundry outbound profile

如果后续使用 Foundry-managed Agent/RAG，让 Foundry Agent 自己访问 Storage、AI Search、Key Vault、数据库或内部 API，则再规划 Foundry outbound：

- 优先路线：Managed VNet + approved outbound / managed private endpoints。
- 最高安全路线：Customer VNet Injection，把 Foundry Agent/Capability Host 注入客户 VNet 的专用 subnet。

这些不作为 `privateBackend` 第一版的默认要求。

## 各资源目标状态

| 资源 | 当前状态 | `privateBackend` 目标 | 备注 |
|---|---|---|---|
| Frontend Container App | Public ingress | Public ingress | 唯一公网应用入口。 |
| Backend Container App | Public ingress | Internal ingress | Frontend 应通过 internal FQDN/service discovery 调用 backend。 |
| Container Apps Environment | 未接入 VNet | 接入 VNet | 需要独立 delegated infrastructure subnet。 |
| PostgreSQL Flexible Server | 公网访问，并有宽泛 Azure firewall rule | 仅私有网络访问 | private profile 下移除 `AllowAzureServices` 类访问。 |
| Storage | Public network enabled，容器 private | Private endpoint | 确认私有路径可用后再关闭 public network access。 |
| Key Vault | Public default allow | Private endpoint | 需要确认 Container Apps Key Vault references 可私有解析。 |
| Azure AI Foundry | Public network enabled | Inbound private endpoint；第一版不要求 Foundry outbound Managed VNet | Backend 私有访问 Foundry data-plane；voice score 改为 backend 读 Blob 后提交 data/base64。 |
| Azure OpenAI | Public network enabled | 支持时使用 private endpoint | 保持 model deployment 行为不变。 |
| Speech / Avatar | Public network enabled | 支持时使用 private endpoint | Voice Live/Avatar 的 private endpoint 支持受区域和 preview 状态影响。 |
| Content Understanding | Public network enabled | 支持时使用 private endpoint | CU preview API 需要验证 endpoint 域名。 |
| Azure AI Search | 如果部署则 public network enabled | 如果部署则使用 private endpoint | Search 保持可选。 |
| ACR | Public network enabled，Basic SKU | private endpoint 候选项 | Private endpoint 可能要求 Premium SKU，并影响部署流程。 |
| Log Analytics / Application Insights | Public ingestion/query | 第一版暂时保留 public | Azure Monitor Private Link 更复杂，建议作为后续 hardening。 |

## 部署和运维影响

私有服务会改变部署和排障方式：

- 本地开发机不能直接访问私有 PostgreSQL、Key Vault 或 Storage，除非有 VPN、Bastion、jump host 或其他私有网络路径。
- 数据库 migration 和 sample data bootstrap 应继续从 Azure 内部执行，例如使用现有 Container Apps Job 模式。
- Key Vault secret 写入和其他运维任务不应依赖本地 data-plane 访问。
- GitHub Actions 仍可通过 Azure Resource Manager 部署 ARM/Bicep，但所有 data-plane 初始化都必须从允许的网络路径执行。
- 在关闭 public access 之前，必须先从 Container Apps 环境内部验证 private endpoint DNS 和 runtime connectivity。

## Bicep 实现前需要 review 的决策

1. **分支基线**：`feat/network-private-profile` 是基于当前 infra hardening 分支继续做，还是等 hardening 合并后从 `main` 重新创建或 rebase。
2. **ACR private endpoint**：private profile 是否要把 ACR 升级到 Premium 以支持 private endpoint，还是第一版先保留 ACR public。
3. **Azure Monitor Private Link**：Application Insights/Log Analytics 第一版是否保持 public，还是纳入 Azure Monitor Private Link Scope。
4. **Azure AI private endpoint 支持**：在锁定 Bicep 设计前，需要验证 Foundry、Voice Live/Avatar、Content Understanding 在目标区域的 private endpoint 和 DNS 行为。
5. **Foundry outbound 是否需要进入第一版**：当前决策是不需要。Voice score 通过 backend 读取 Blob 并提交 data/base64 解决；Managed VNet 留给未来 Foundry-managed Agent/RAG 场景。
6. **运维访问方式**：本阶段是否需要 VPN/Bastion/jump host，还是 Azure-hosted bootstrap jobs 已足够。

## 文档 review 后的建议实施顺序

1. 保持 `publicDemo` 不变。
2. 在 `networkProfile` allowed values 中新增 `privateBackend`。
3. 新增 network module：VNet、subnets、private DNS zones、VNet links。
4. 将 Container Apps managed environment 接入 VNet。
5. 在 `privateBackend` 下把 backend ingress 改为 internal，frontend ingress 保持 public。
6. 为 PostgreSQL、Storage、Key Vault、Foundry inbound 和支持 private endpoint 的 AI 服务添加 private endpoints。
7. 修复 voice score 数据流：backend 从 Blob 读取音频，并以 data/base64 提交给 Content Understanding，避免 CU 直接读取 private Blob URL。
8. 只有在 private DNS 和 runtime connectivity 验证通过后，才关闭或限制 public network access。
9. 更新参数示例和部署文档。
10. 同时验证 `publicDemo` 和 `privateBackend` 两套 Bicep 部署路径。

## 本文档不包含的范围

- 不修改 Bicep。
- 不修改应用代码。
- 不迁移现有已部署资源。
- 不移除当前 public demo 部署路径。
