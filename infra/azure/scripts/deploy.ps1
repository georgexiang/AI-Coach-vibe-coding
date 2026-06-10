[CmdletBinding()]
param(
    [string]$Location = "swedencentral",
    [string]$EnvironmentName = "demo",
    [string]$NamePrefix = "aicoach",
    [string]$GithubOwner = "jeromeecho",
    [string]$GithubRepo = "AI-Coach-vibe-coding",
    [string]$GithubBranch = "main",
    [string]$ChatDeploymentName = "gpt-4o",
    [string]$RealtimeDeploymentName = "gpt-realtime-1-5",
    [ValidateSet("GlobalStandard", "Standard")]
    [string]$RealtimeDeploymentSkuName = "GlobalStandard",
    [ValidateRange(1, 1000)]
    [int]$RealtimeDeploymentCapacity = 5,
    [switch]$WhatIf,
    [switch]$DeployApp,
    [switch]$Verify,
    [switch]$SkipImageBuild,
    [switch]$KeepGeneratedParameters
)

$ErrorActionPreference = "Stop"

function Convert-SecureStringToPlainText {
    param([System.Security.SecureString]$Value)

    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function New-RandomSecret {
    param([int]$ByteCount = 48)

    $bytes = [byte[]]::new($ByteCount)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes)
}

function New-FernetKey {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    return [Convert]::ToBase64String($bytes).Replace("+", "-").Replace("/", "_")
}

function Get-KeyVaultSecretValue {
    param(
        [Parameter(Mandatory = $true)][string]$VaultName,
        [Parameter(Mandatory = $true)][string]$SecretName
    )

    $errorFile = New-TemporaryFile
    $value = az keyvault secret show `
        --vault-name $VaultName `
        --name $SecretName `
        --query value `
        --output tsv 2>$errorFile

    if ($LASTEXITCODE -ne 0) {
        $details = (Get-Content -Path $errorFile -Raw).Trim()
        Remove-Item -Path $errorFile -Force
        throw "Failed to read Key Vault secret '$SecretName' from '$VaultName'. The deployment script must read existing secrets to avoid rotating them. Check Key Vault data-plane RBAC and network access. Azure CLI error: $details"
    }

    Remove-Item -Path $errorFile -Force
    return $value
}

function Get-ContainerAppImage {
    param(
        [Parameter(Mandatory = $true)][string]$ResourceGroupName,
        [Parameter(Mandatory = $true)][string]$ContainerAppName,
        [Parameter(Mandatory = $true)][string]$DefaultImage
    )

    $image = az containerapp show `
        --resource-group $ResourceGroupName `
        --name $ContainerAppName `
        --query "properties.template.containers[0].image" `
        --output tsv 2>$null

    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($image)) {
        return $image
    }

    return $DefaultImage
}

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$AzureRoot = Split-Path -Parent $ScriptRoot
$RepoRoot = Split-Path -Parent (Split-Path -Parent $AzureRoot)
$TemplateFile = Join-Path $AzureRoot "main.bicep"
$LocalDir = Join-Path $AzureRoot ".local"
New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null

Write-Host "Checking Azure CLI login..." -ForegroundColor Cyan
$account = az account show --output json | ConvertFrom-Json
$subscriptionId = $account.id
$subscriptionSuffix = (($subscriptionId -replace "-", "").Substring(0, 6)).ToLowerInvariant()
$regionToken = ($Location -replace "[^a-zA-Z0-9]", "").ToLowerInvariant()

$defaultAcrName = "$($NamePrefix)$($EnvironmentName)$($subscriptionSuffix)$($regionToken)acr".ToLowerInvariant()
if ($defaultAcrName.Length -gt 50) {
    $defaultAcrName = $defaultAcrName.Substring(0, 50)
}

$storageToken = "$($NamePrefix)$($EnvironmentName)$($subscriptionSuffix)$($regionToken)".ToLowerInvariant()
if ($storageToken.Length -gt 22) {
    $storageToken = $storageToken.Substring(0, 22)
}
$defaultStorageName = "${storageToken}st"
$resourceGroupName = "rg-$NamePrefix-$EnvironmentName-$regionToken"
$backendContainerAppName = "ca-$NamePrefix-$EnvironmentName-backend"
$frontendContainerAppName = "ca-$NamePrefix-$EnvironmentName-frontend"
$defaultBackendImage = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"
$defaultFrontendImage = "mcr.microsoft.com/azuredocs/containerapps-helloworld:latest"

Write-Host "Resolving deployment secrets..." -ForegroundColor Cyan
$resourceGroupExists = az group exists --name $resourceGroupName --output tsv
if ($LASTEXITCODE -ne 0) {
    throw "Failed to check whether resource group '$resourceGroupName' exists."
}

$keyVaultName = ""
if ($resourceGroupExists -eq "true") {
    $keyVaultName = az resource list `
        --resource-group $resourceGroupName `
        --resource-type "Microsoft.KeyVault/vaults" `
        --query "[0].name" `
        --output tsv
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to list Key Vault resources in '$resourceGroupName'."
    }
}

if ($keyVaultName) {
    Write-Host "Reusing existing secrets from Key Vault '$keyVaultName'." -ForegroundColor Cyan
    $postgresAdminPassword = Get-KeyVaultSecretValue -VaultName $keyVaultName -SecretName "postgres-admin-password"
    $jwtSecret = Get-KeyVaultSecretValue -VaultName $keyVaultName -SecretName "jwt-secret-key"
    $encryptionKey = Get-KeyVaultSecretValue -VaultName $keyVaultName -SecretName "encryption-key"
}
else {
    Write-Host "No existing Key Vault found. Generating first-deployment secrets locally..." -ForegroundColor Cyan
    $postgresAdminPassword = Convert-SecureStringToPlainText (Read-Host "PostgreSQL admin password" -AsSecureString)
    $jwtSecret = New-RandomSecret
    $encryptionKey = New-FernetKey
}

$backendImage = $defaultBackendImage
$frontendImage = $defaultFrontendImage
if ($resourceGroupExists -eq "true") {
    Write-Host "Reusing existing Container App images when present..." -ForegroundColor Cyan
    $backendImage = Get-ContainerAppImage -ResourceGroupName $resourceGroupName -ContainerAppName $backendContainerAppName -DefaultImage $defaultBackendImage
    $frontendImage = Get-ContainerAppImage -ResourceGroupName $resourceGroupName -ContainerAppName $frontendContainerAppName -DefaultImage $defaultFrontendImage
}

$parametersPath = Join-Path $LocalDir "main.parameters.generated.json"
$parameters = [ordered]@{
    "`$schema" = "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#"
    contentVersion = "1.0.0.0"
    parameters = [ordered]@{
        namePrefix = @{ value = $NamePrefix }
        environmentName = @{ value = $EnvironmentName }
        location = @{ value = $Location }
        containerRegistryName = @{ value = $defaultAcrName }
        storageAccountName = @{ value = $defaultStorageName }
        backendImage = @{ value = $backendImage }
        frontendImage = @{ value = $frontendImage }
        postgresAdminPassword = @{ value = $postgresAdminPassword }
        jwtSecret = @{ value = $jwtSecret }
        encryptionKey = @{ value = $encryptionKey }
        githubOwner = @{ value = $GithubOwner }
        githubRepo = @{ value = $GithubRepo }
        githubBranch = @{ value = $GithubBranch }
        chatDeploymentName = @{ value = $ChatDeploymentName }
        realtimeDeploymentName = @{ value = $RealtimeDeploymentName }
        realtimeDeploymentSkuName = @{ value = $RealtimeDeploymentSkuName }
        realtimeDeploymentCapacity = @{ value = $RealtimeDeploymentCapacity }
    }
}
$parameters | ConvertTo-Json -Depth 20 | Set-Content -Path $parametersPath -Encoding utf8NoBOM

Write-Host "Validating Bicep..." -ForegroundColor Cyan
az bicep build --file $TemplateFile | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "Bicep build failed."
}

$deploymentName = "deploy-$NamePrefix-$EnvironmentName-$(Get-Date -Format yyyyMMddHHmmss)"
if ($WhatIf) {
    Write-Host "Running subscription what-if..." -ForegroundColor Cyan
    az deployment sub what-if `
        --name $deploymentName `
        --location $Location `
        --template-file $TemplateFile `
        --parameters "@$parametersPath" | Out-Host
    if ($LASTEXITCODE -ne 0) {
        if (-not $KeepGeneratedParameters) {
            Remove-Item -Path $parametersPath -Force
        }
        throw "Azure what-if failed."
    }
    if (-not $KeepGeneratedParameters) {
        Remove-Item -Path $parametersPath -Force
    }
    exit 0
}

Write-Host "Deploying Azure infrastructure..." -ForegroundColor Cyan
$deploymentJson = az deployment sub create `
    --name $deploymentName `
    --location $Location `
    --template-file $TemplateFile `
    --parameters "@$parametersPath" `
    --output json
if ($LASTEXITCODE -ne 0) {
    if (-not $KeepGeneratedParameters) {
        Remove-Item -Path $parametersPath -Force
    }
    throw "Azure infrastructure deployment failed."
}

$deployment = $deploymentJson | ConvertFrom-Json

$outputs = $deployment.properties.outputs
$outputPath = Join-Path $LocalDir "deployment.outputs.json"
$outputs | ConvertTo-Json -Depth 20 | Set-Content -Path $outputPath -Encoding utf8NoBOM

Write-Host "Infrastructure deployment complete." -ForegroundColor Green
Write-Host "Frontend URL: $($outputs.frontendUrl.value)"
Write-Host "Backend URL:  $($outputs.backendUrl.value)"
Write-Host "ACR:          $($outputs.containerRegistryLoginServer.value)"

if ($DeployApp -and -not $SkipImageBuild) {
    & (Join-Path $ScriptRoot "build-and-push.ps1") `
        -ResourceGroupName $outputs.resourceGroupName.value `
        -ContainerRegistryName $outputs.containerRegistryName.value `
        -BackendContainerAppName $outputs.backendContainerAppName.value `
        -FrontendContainerAppName $outputs.frontendContainerAppName.value `
        -BackendUrl $outputs.backendUrl.value
}
elseif (-not $DeployApp) {
    Write-Host "Skipping app image build/update. Pass -DeployApp to build and update Container Apps." -ForegroundColor Yellow
}
else {
    Write-Host "Skipping app image build/update because -SkipImageBuild was specified." -ForegroundColor Yellow
}

if ($DeployApp -or $Verify) {
    & (Join-Path $ScriptRoot "verify-deployment.ps1") `
        -BackendUrl $outputs.backendUrl.value `
        -FrontendUrl $outputs.frontendUrl.value
}
else {
    Write-Host "Skipping health verification. Pass -Verify to check existing app endpoints." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "GitHub OIDC values:" -ForegroundColor Cyan
Write-Host "AZURE_CLIENT_ID=$($outputs.githubDeploymentClientId.value)"
Write-Host "AZURE_TENANT_ID=$($outputs.tenantId.value)"
Write-Host "AZURE_SUBSCRIPTION_ID=$subscriptionId"
Write-Host "AZURE_RESOURCE_GROUP=$($outputs.resourceGroupName.value)"
Write-Host "ACR_NAME=$($outputs.containerRegistryName.value)"
Write-Host "BACKEND_APP_NAME=$($outputs.backendContainerAppName.value)"
Write-Host "FRONTEND_APP_NAME=$($outputs.frontendContainerAppName.value)"

if (-not $KeepGeneratedParameters) {
    Remove-Item -Path $parametersPath -Force
}
