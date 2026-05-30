# Azure one-click deployment

This folder contains the Bicep-based deployment assets for the AI Coach platform.

The first implementation goal is a complete Azure target deployment surface while keeping existing application code unchanged. Infrastructure is created here, and application gaps are documented separately instead of being hidden in the templates.

## Current defaults

| Setting | Value |
|---|---|
| Location | `swedencentral` |
| Environment | `demo` |
| Name prefix | `aicoach` |

## Intended scope

- Azure Container Registry
- Azure Container Apps for backend and frontend
- Log Analytics and Application Insights
- User-assigned Managed Identity
- Key Vault
- Azure Database for PostgreSQL Flexible Server
- Storage Account and Blob containers
- Azure AI Foundry / Azure AI Services
- Azure OpenAI deployments
- Azure Speech / Voice Live / Avatar
- Azure Content Understanding
- Azure AI Search
- GitHub Actions OIDC bootstrap
- RBAC role assignments

## Execution model

Start with a what-if:

```powershell
az login
az account set --subscription "<subscription-id-or-name>"
.\infra\azure\scripts\test-region-availability.ps1 -StopOnFirstPass
.\infra\azure\scripts\deploy.ps1 -WhatIf
```

Then deploy infrastructure:

```powershell
.\infra\azure\scripts\deploy.ps1
```

The script creates a local ignored `infra\azure\.local\main.parameters.generated.json`, deploys Bicep, and prints GitHub OIDC values. On later runs, it reuses existing Key Vault secrets instead of rotating application secrets.

If you also want to build/push backend and frontend images and update Container Apps:

```powershell
.\infra\azure\scripts\deploy.ps1 -DeployApp
```

Run `-DeployApp` from the branch/worktree that contains the code you want to test in Azure. The ACR build uses the local `backend\` and `frontend\` folders, so cloud testing the PostgreSQL, Blob Storage, Rubric, or Voice changes requires checking out a branch that contains those changes before running the command.

For infra-only changes where the app is already deployed, add `-Verify` if you want to check backend `/api/health` and frontend `/health`.

## Runtime behavior for current cloud testing

- PostgreSQL is configured through `DATABASE_URL` and uses the backend `postgresql` optional dependency.
- Azure Blob Storage is already wired in Bicep for the backend Container App:
  - `STORAGE_BACKEND=azure_blob`
  - `AZURE_STORAGE_ACCOUNT_URL=<storage account blob endpoint>`
  - `AZURE_STORAGE_CONTAINER_NAME=materials`
  - backend managed identity has `Storage Blob Data Contributor`.
- Local development remains unaffected by these cloud settings. The backend defaults to local storage when `STORAGE_BACKEND` is not set.
- Sample/demo seed data is still controlled by `SEED_DATA_IGNORE`. This template does not set `SEED_DATA_IGNORE=true`, so the app startup seed behavior remains the same as the application default.
- The deployment backend Dockerfile installs `.[postgresql,voice]` so Azure images include PostgreSQL and Voice Live runtime dependencies.

## Documentation

- `docs\architecture.md` explains the deployed Azure topology.
- `docs\parameters.md` explains required and optional parameters.
- `docs\operations.md` explains deployment, image updates, verification, GitHub OIDC, and teardown.
- `docs\deployment-lessons-learned.md` records first-deployment Azure issues and fixes.
- `docs\known-gaps.md` lists current app/runtime gaps that infrastructure cannot solve alone.

## Important constraint

This folder does not merge application feature branches. Infrastructure can provide cloud configuration, but the deployed image only contains whatever code is present in the local branch/worktree used by `-DeployApp`.
