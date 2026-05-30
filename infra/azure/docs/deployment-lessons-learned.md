# Azure deployment lessons learned

This document records deployment issues found during the first Azure Bicep rollout and how to handle them next time.

## Summary

The successful demo deployment used:

| Item | Value |
|---|---|
| Region | `swedencentral` |
| Resource group | `rg-aicoach-demo-swedencentral` |
| Backend health | `/api/health` returned 200 |
| Frontend health | `/health` returned 200 |
| Image build path | ACR Tasks using deployment-only Dockerfiles under `infra\azure\docker\` |

No backend or frontend application source code was changed to fix these deployment issues. The fixes were made in Bicep modules, Azure scripts, and deployment-only Dockerfiles.

## 1. Region capacity and subscription restrictions are real preflight blockers

### Symptoms

`eastus2` failed with:

- PostgreSQL Flexible Server: `LocationIsOfferRestricted`
- Azure AI Search: `InsufficientResourcesAvailable`

These are not normal template syntax errors. They mean the subscription and region combination cannot currently provision the requested service or SKU.

### What to do

Run region preflight before deploying:

```powershell
.\infra\azure\scripts\test-region-availability.ps1 -StopOnFirstPass
```

Use full Bicep what-if instead of only checking provider registration. Provider registration can say a service exists in a region, while the actual deployment still fails because of quota, offer restrictions, model availability, or temporary capacity.

## 2. Cognitive Services custom subdomains can remain reserved after deletion

### Symptoms

After deleting a resource group, a later what-if or deployment failed with:

```text
CustomDomainInUse - Please pick a different name.
```

### Root cause

Cognitive Services and Foundry account subdomains can remain reserved during soft-delete retention. Deleting the resource group does not immediately make the custom subdomain reusable.

### Fix used

Resource group and globally unique resource names now include the location token or derive uniqueness from the region-aware resource group ID. For retries in a different region, the deployment uses names such as:

```text
rg-aicoach-demo-swedencentral
```

If this happens again, prefer changing the name/region token instead of waiting for soft-delete retention to expire.

## 3. Azure OpenAI model deployments need current model/SKU combinations

### Symptoms

Older realtime defaults failed because the model version was deprecated or unavailable in the chosen region/SKU.

### Fix used

The deployment now defaults to:

| Purpose | Model | Version | SKU |
|---|---|---|---|
| Chat | `gpt-4o` | region-supported default in parameters | `GlobalStandard` |
| Realtime | `gpt-realtime-1.5` | `2026-02-23` | `GlobalStandard` |

Model support is region-sensitive. If this fails later, rerun region preflight or check Azure OpenAI model availability for the exact target region.

## 4. Azure OpenAI deployments under the same account should be serialized

### Symptoms

Deployment failed with:

```text
RequestConflict - Another operation is being performed on the parent resource
```

### Root cause

Multiple model deployments were being created concurrently under the same Cognitive Services account.

### Fix used

The realtime deployment now depends on the chat deployment in `modules\ai-openai.bicep`, so model deployments happen serially.

## 5. ACR build failures must stop the deployment script

### Symptoms

Frontend ACR build failed, but the script still updated the frontend Container App to the failed image tag.

### Root cause

The script did not reliably stop after an Azure CLI build failure.

### Fix used

`scripts\build-and-push.ps1` now wraps Azure CLI calls and throws when `az` exits non-zero. This prevents Container Apps from being updated to missing images.

## 6. Use deployment-only Dockerfiles for Azure images

### Backend issue

The backend container crashed in Azure with:

```text
No module named 'asyncpg'
```

The deployed `DATABASE_URL` points to PostgreSQL, so the image needs the backend PostgreSQL optional dependency.

### Frontend issue

The original frontend build used:

```text
mcr.microsoft.com/mirror/docker/library/node:20-slim
```

That MCR mirror tag was unavailable during ACR build.

### Fix used

ACR Tasks now build from deployment-only Dockerfiles:

| File | Purpose |
|---|---|
| `infra\azure\docker\backend.Dockerfile` | Installs `.[postgresql,voice]`, including `asyncpg` and Voice Live runtime dependencies |
| `infra\azure\docker\frontend.Dockerfile` | Uses public `node:20-slim` and `nginx:alpine` |

This keeps Azure deployment fixes isolated from the app's normal Dockerfiles.

## 7. Azure CLI on Windows can fail while streaming ACR logs

### Symptoms

Azure CLI showed:

```text
UnicodeEncodeError: 'charmap' codec can't encode characters
```

### Root cause

On Windows, Azure CLI log streaming can fail when output contains characters not representable in the active console encoding.

### Fix used

The build script sets UTF-8-related environment variables before invoking Azure CLI. If the CLI still crashes while streaming logs, check the actual ACR run result:

```powershell
az acr task list-runs --registry "<acr-name>" --top 5 --output table
```

The log-streaming crash does not always mean the remote ACR build failed.

## 8. What-if can show unsupported role assignments

### Symptoms

What-if reported role assignment changes as `Unsupported`.

### Root cause

Some role assignment names depend on managed identity principal IDs that are only known during deployment.

### Guidance

This is acceptable if what-if exits successfully and there are no `ERROR:` messages. Treat non-zero what-if exit codes as blockers.

## Recommended deployment flow

```powershell
az login
az account set --subscription "<subscription-id-or-name>"

.\infra\azure\scripts\test-region-availability.ps1 -StopOnFirstPass
.\infra\azure\scripts\deploy.ps1 -Location swedencentral -WhatIf
.\infra\azure\scripts\deploy.ps1 -Location swedencentral
```

After deployment, verify explicitly:

```powershell
.\infra\azure\scripts\verify-deployment.ps1 `
  -BackendUrl "<backend-url>" `
  -FrontendUrl "<frontend-url>"
```

If image build or app update needs to be rerun:

```powershell
.\infra\azure\scripts\build-and-push.ps1 `
  -ResourceGroupName "<resource-group>" `
  -ContainerRegistryName "<acr-name>" `
  -BackendContainerAppName "<backend-app-name>" `
  -FrontendContainerAppName "<frontend-app-name>" `
  -BackendUrl "<backend-url>"
```
