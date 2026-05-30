[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Repository,
    [Parameter(Mandatory = $true)][string]$AzureClientId,
    [Parameter(Mandatory = $true)][string]$AzureTenantId,
    [Parameter(Mandatory = $true)][string]$AzureSubscriptionId,
    [Parameter(Mandatory = $true)][string]$ResourceGroupName,
    [Parameter(Mandatory = $true)][string]$AcrName,
    [Parameter(Mandatory = $true)][string]$BackendAppName,
    [Parameter(Mandatory = $true)][string]$FrontendAppName
)

$ErrorActionPreference = "Stop"

Write-Host "Setting GitHub repository variables on $Repository..." -ForegroundColor Cyan
gh variable set AZURE_CLIENT_ID --repo $Repository --body $AzureClientId
gh variable set AZURE_TENANT_ID --repo $Repository --body $AzureTenantId
gh variable set AZURE_SUBSCRIPTION_ID --repo $Repository --body $AzureSubscriptionId
gh variable set AZURE_RESOURCE_GROUP --repo $Repository --body $ResourceGroupName
gh variable set ACR_NAME --repo $Repository --body $AcrName
gh variable set BACKEND_APP_NAME --repo $Repository --body $BackendAppName
gh variable set FRONTEND_APP_NAME --repo $Repository --body $FrontendAppName

Write-Host "GitHub variables updated." -ForegroundColor Green
