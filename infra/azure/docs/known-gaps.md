# Known deployment and runtime gaps

These are current repo/runtime gaps that Bicep cannot fully solve without later application-code or operations work.

## Application behavior

- Azure Blob cloud configuration is provisioned for the backend Container App. The deployed image must still be built from a branch that contains the Blob storage application code.
- PostgreSQL Entra ID auth is wired for cloud deployments through backend Managed Identity and the deployment bootstrap scripts. Legacy password `DATABASE_URL` mode remains available only when explicitly selected.
- Azure AI Search is optional infrastructure only. The current app does not wire a direct Azure AI Search client path, so the default `foundryOnly` deployment leaves Search disabled.
- Some AI/Speech/Avatar/Content Understanding paths still pre-read API-key fallback configuration from Key Vault even though managed identity and RBAC are provisioned. Future app work should make those fallbacks lazy so MI-success paths do not require Key Vault service-key reads.
- The first image deployment uses the current Dockerfiles as-is. If runtime dependencies or startup behavior differ in Azure, fix app/container code in a separate task.

## Azure service availability

- Azure OpenAI model versions and quota are region-sensitive.
- Realtime/Voice Live and Avatar availability can differ by region and subscription.
- Content Understanding and Foundry project APIs are preview/rapidly evolving.
- The Foundry Bicep resource version may produce local `BCP081` warnings until Bicep type definitions catch up.

## Production hardening

Before production:

- Use `privateBackend` for VNet integration, backend internal ingress, and private endpoints for Storage, Key Vault, PostgreSQL, and Foundry. Review ACR private image pull and Azure Monitor Private Link separately.
- Restrict public network access and database firewall rules only after private endpoint DNS and runtime connectivity are verified from inside the Container Apps environment.
- Add backup/restore runbooks and migration strategy.
- Review Container Apps scale settings and cost budgets.
- Decide whether to update `.github/workflows\ci.yml` or add a separate deployment workflow.
- Add region-specific parameter files for China/EU data residency.
