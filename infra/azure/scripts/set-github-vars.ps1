[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Repository,
    [Parameter(Mandatory = $true)][string]$AzureClientId,
    [Parameter(Mandatory = $true)][string]$AzureTenantId,
    [Parameter(Mandatory = $true)][string]$AzureSubscriptionId,
    [Parameter(Mandatory = $true)][string]$ResourceGroupName,
    [Parameter(Mandatory = $true)][string]$AcrName,
    [Parameter(Mandatory = $true)][string]$BackendAppName,
    [Parameter(Mandatory = $true)][string]$FrontendAppName,
    [string]$BackendBootstrapJobName = "",
    [string]$EnvironmentName = ""
)

$ErrorActionPreference = "Stop"

$targetArgs = @("--repo", $Repository)
if (-not [string]::IsNullOrWhiteSpace($EnvironmentName)) {
    $targetArgs += @("--env", $EnvironmentName)
    Write-Host "Setting GitHub environment variables on $Repository / $EnvironmentName..." -ForegroundColor Cyan
}
else {
    Write-Host "Setting GitHub repository variables on $Repository..." -ForegroundColor Cyan
}

gh variable set AZURE_CLIENT_ID @targetArgs --body $AzureClientId
gh variable set AZURE_TENANT_ID @targetArgs --body $AzureTenantId
gh variable set AZURE_SUBSCRIPTION_ID @targetArgs --body $AzureSubscriptionId
gh variable set AZURE_RESOURCE_GROUP @targetArgs --body $ResourceGroupName
gh variable set ACR_NAME @targetArgs --body $AcrName
gh variable set BACKEND_APP_NAME @targetArgs --body $BackendAppName
gh variable set FRONTEND_APP_NAME @targetArgs --body $FrontendAppName

if (-not [string]::IsNullOrWhiteSpace($BackendBootstrapJobName)) {
    gh variable set BACKEND_BOOTSTRAP_JOB_NAME @targetArgs --body $BackendBootstrapJobName
}

Write-Host "GitHub variables updated." -ForegroundColor Green
