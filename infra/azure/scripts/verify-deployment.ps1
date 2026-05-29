[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BackendUrl,
    [Parameter(Mandatory = $true)][string]$FrontendUrl
)

$ErrorActionPreference = "Stop"

function Test-Endpoint {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Url
    )

    Write-Host "Checking ${Name}: $Url" -ForegroundColor Cyan
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 400) {
        throw "$Name returned HTTP $($response.StatusCode)"
    }
    Write-Host "$Name OK ($($response.StatusCode))" -ForegroundColor Green
}

Test-Endpoint -Name "Backend health" -Url "$BackendUrl/api/health"
Test-Endpoint -Name "Frontend health" -Url "$FrontendUrl/health"
