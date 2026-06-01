# Known deployment and runtime gaps

These are current repo/runtime gaps that Bicep cannot fully solve without later application-code or operations work.

## Application behavior

- Azure Blob cloud configuration is provisioned for the backend Container App. The deployed image must still be built from a branch that contains the Blob storage application code.
- PostgreSQL is deployed with username/password because the current app expects a normal `DATABASE_URL`. PostgreSQL Entra ID auth is not wired into the app.
- Azure AI Search is optional infrastructure only. The current app does not wire a direct Azure AI Search client path, so the default `foundryOnly` deployment leaves Search disabled.
- Some AI/Speech/Avatar/Content Understanding paths may still need key-based configuration or code updates even though managed identity and RBAC are provisioned.
- The first image deployment uses the current Dockerfiles as-is. If runtime dependencies or startup behavior differ in Azure, fix app/container code in a separate task.

## Azure service availability

- Azure OpenAI model versions and quota are region-sensitive.
- Realtime/Voice Live and Avatar availability can differ by region and subscription.
- Content Understanding and Foundry project APIs are preview/rapidly evolving.
- The Foundry Bicep resource version may produce local `BCP081` warnings until Bicep type definitions catch up.

## Production hardening

Before production:

- Add private endpoints and VNet integration. The current `networkProfile` supports only `publicDemo`.
- Restrict public network access and database firewall rules.
- Add backup/restore runbooks and migration strategy.
- Review Container Apps scale settings and cost budgets.
- Decide whether to update `.github/workflows\ci.yml` or add a separate deployment workflow.
- Add region-specific parameter files for China/EU data residency.
