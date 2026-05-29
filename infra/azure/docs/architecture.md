# Azure deployment architecture

This deployment targets a Demo/PoC Azure footprint for the AI Coach platform while keeping existing application code unchanged.

## Topology

| Area | Azure resources |
|---|---|
| Runtime | Azure Container Apps Environment, backend Container App, frontend Container App |
| Images | Azure Container Registry Basic, ACR Tasks via `az acr build` |
| Data | Azure Database for PostgreSQL Flexible Server, app database |
| Secrets | RBAC-enabled Azure Key Vault |
| Files | Storage Account with Blob containers for materials, skills, audio, and exports |
| Observability | Log Analytics Workspace, Application Insights |
| Identity | Backend user-assigned managed identity, GitHub deployment user-assigned managed identity |
| AI | Azure AI Foundry account/project, Azure OpenAI, Azure Speech, Content Understanding account, Azure AI Search |

## Request flow

1. Users access the frontend Container App.
2. The frontend nginx container proxies `/api/` and WebSocket traffic to the backend URL through `BACKEND_URL`.
3. Backend connects to PostgreSQL through `DATABASE_URL`.
4. Backend uses managed identity/RBAC for Azure resources where the current app supports it, and Key Vault-backed secrets for paths that still require secret values.

## Foundry model

The Foundry module uses the current account/project model:

- `Microsoft.CognitiveServices/accounts@2026-03-01`
- `Microsoft.CognitiveServices/accounts/projects@2026-03-01`

Current local Bicep releases may show `BCP081` warnings because the type library has not caught up with these resource versions. The warning means local property validation is unavailable; it does not block template compilation.

## Network posture

The first deployment is public Demo/PoC networking:

- Container Apps have external ingress.
- ACR, Key Vault, Storage, PostgreSQL, and AI services use public network access.
- PostgreSQL includes an Azure-services firewall rule.

Production hardening should add private endpoints, VNet integration, restricted ingress, environment-specific CORS, tighter firewall rules, and a migration strategy before go-live.
