[CmdletBinding()]
param(
    [switch]$CheckAzureRoles,
    [string]$SubscriptionId = ""
)

$ErrorActionPreference = "Continue"

function Write-Check {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][bool]$Passed,
        [string]$Detail = "",
        [bool]$Warning = $false
    )

    if ($Passed -and -not $Warning) {
        Write-Host "[PASS] $Name" -ForegroundColor Green
    }
    elseif ($Passed -and $Warning) {
        Write-Host "[WARN] $Name" -ForegroundColor Yellow
    }
    else {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
    }

    if (-not [string]::IsNullOrWhiteSpace($Detail)) {
        Write-Host "       $Detail"
    }
}

function Test-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Command)
    return $null -ne (Get-Command $Command -ErrorAction SilentlyContinue)
}

Write-Host "Azure deployment prerequisite check" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

$isPwsh = $PSVersionTable.PSEdition -eq "Core"
$psVersionOk = $PSVersionTable.PSVersion.Major -ge 7
Write-Check `
    -Name "PowerShell 7+" `
    -Passed $psVersionOk `
    -Warning (-not $psVersionOk) `
    -Detail "Current: $($PSVersionTable.PSEdition) $($PSVersionTable.PSVersion). Recommended install: winget install --id Microsoft.PowerShell --source winget"

$hasAz = Test-CommandExists "az"
Write-Check `
    -Name "Azure CLI" `
    -Passed $hasAz `
    -Detail $(if ($hasAz) { (& az version --query '"azure-cli"' --output tsv 2>$null) } else { "Install: winget install --id Microsoft.AzureCLI --source winget" })

if ($hasAz) {
    $bicepVersion = & az bicep version 2>$null
    Write-Check `
        -Name "Azure CLI Bicep" `
        -Passed ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($bicepVersion)) `
        -Detail $(if ($LASTEXITCODE -eq 0) { $bicepVersion } else { "Install/upgrade: az bicep install; az bicep upgrade" })

    $accountJson = & az account show --output json 2>$null
    $accountOk = $LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($accountJson)
    if ($accountOk) {
        $account = $accountJson | ConvertFrom-Json
        if (-not [string]::IsNullOrWhiteSpace($SubscriptionId) -and $account.id -ne $SubscriptionId) {
            Write-Check `
                -Name "Azure CLI selected subscription" `
                -Passed $true `
                -Warning $true `
                -Detail "Current subscription is $($account.name) ($($account.id)), expected $SubscriptionId. Run: az account set --subscription `"$SubscriptionId`""
        }
        else {
            Write-Check `
                -Name "Azure CLI login" `
                -Passed $true `
                -Detail "Signed in to subscription: $($account.name) ($($account.id)); tenant: $($account.tenantId)"
        }

        $signedInUserJson = & az ad signed-in-user show --output json 2>$null
        $signedInUserOk = $LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($signedInUserJson)
        if ($signedInUserOk) {
            $signedInUser = $signedInUserJson | ConvertFrom-Json
            Write-Check `
                -Name "Resolvable Entra signed-in user" `
                -Passed $true `
                -Detail "User: $($signedInUser.userPrincipalName); object id: $($signedInUser.id)"
        }
        else {
            Write-Check `
                -Name "Resolvable Entra signed-in user" `
                -Passed $false `
                -Detail "Default azureAd DB mode needs az ad signed-in-user show, or pass -PostgresEntraAdminLogin/-PostgresEntraAdminObjectId explicitly."
        }

        if ($CheckAzureRoles -and $signedInUserOk) {
            $scope = "/subscriptions/$($account.id)"
            $roleJson = & az role assignment list --assignee $signedInUser.id --scope $scope --include-inherited --output json 2>$null
            if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($roleJson)) {
                $roles = @($roleJson | ConvertFrom-Json)
                $roleNames = @($roles | ForEach-Object { $_.roleDefinitionName } | Sort-Object -Unique)
                $hasOwner = $roleNames -contains "Owner"
                $hasContributor = $roleNames -contains "Contributor"
                $hasUserAccessAdmin = $roleNames -contains "User Access Administrator"
                $roleSummary = if ($roleNames.Count -gt 0) { $roleNames -join ", " } else { "No explicit role assignments found for this user at subscription scope." }

                Write-Check `
                    -Name "Azure RBAC role hint" `
                    -Passed ($hasOwner -or ($hasContributor -and $hasUserAccessAdmin)) `
                    -Warning (-not ($hasOwner -or ($hasContributor -and $hasUserAccessAdmin))) `
                    -Detail "Detected explicit/inherited roles for user: $roleSummary. Required: Owner, or Contributor + User Access Administrator. Group-inherited roles may not be fully represented here."
            }
            else {
                Write-Check `
                    -Name "Azure RBAC role hint" `
                    -Passed $true `
                    -Warning $true `
                    -Detail "Could not list role assignments. Verify in Azure Portal that you have Owner, or Contributor + User Access Administrator, on the target subscription."
            }
        }
    }
    else {
        Write-Check `
            -Name "Azure CLI login" `
            -Passed $false `
            -Detail "Run: az login; az account set --subscription `"<subscription-id-or-name>`""
    }
}

$hasPython = Test-CommandExists "python"
if ($hasPython) {
    $pythonVersion = & python --version 2>&1
    $pythonCheck = & python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 11) else 1)" 2>$null
    Write-Check `
        -Name "Python 3.11+" `
        -Passed ($LASTEXITCODE -eq 0) `
        -Detail "$pythonVersion. Install: winget install --id Python.Python.3.11 --source winget"

    $dependencyCheck = & python -c "import azure.identity, psycopg2; print('azure.identity and psycopg2 available')" 2>&1
    Write-Check `
        -Name "Python backend PostgreSQL bootstrap dependencies (local-only)" `
        -Passed $true `
        -Warning ($LASTEXITCODE -ne 0) `
        -Detail $(if ($LASTEXITCODE -eq 0) { $dependencyCheck } else { "Missing azure.identity and/or psycopg2 in current Python environment. Only required for publicDemo/manual local DB bootstrap or backend tests. From backend: python -m pip install -e `".[postgresql]`"" })
}
else {
    Write-Check `
        -Name "Python 3.11+" `
        -Passed $false `
        -Detail "Install: winget install --id Python.Python.3.11 --source winget"
}

$hasGh = Test-CommandExists "gh"
Write-Check `
    -Name "GitHub CLI (optional)" `
    -Passed $true `
    -Warning (-not $hasGh) `
    -Detail $(if ($hasGh) { (& gh --version 2>$null | Select-Object -First 1) } else { "Optional. Needed only for set-github-vars.ps1. Install: winget install --id GitHub.cli --source winget" })

Write-Host ""
Write-Host "Next recommended commands:" -ForegroundColor Cyan
Write-Host "  .\infra\azure\scripts\test-region-availability.ps1 -StopOnFirstPass"
Write-Host "  .\infra\azure\scripts\deploy.ps1 -WhatIf"
Write-Host "  .\infra\azure\scripts\deploy.ps1"
