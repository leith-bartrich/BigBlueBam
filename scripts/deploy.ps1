# BigBlueBam Deployment Setup — Windows PowerShell bootstrap
$ErrorActionPreference = 'Stop'

Write-Host ""
Write-Host "+===========================================+" -ForegroundColor Cyan
Write-Host "|       BigBlueBam Deployment Setup         |" -ForegroundColor Cyan
Write-Host "+===========================================+" -ForegroundColor Cyan
Write-Host ""

# Check we're in the right directory
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot

if (-not (Test-Path "docker-compose.yml") -or -not (Test-Path "apps/api")) {
    Write-Host "Error: Please run this script from the BigBlueBam repository root." -ForegroundColor Red
    exit 1
}

# Check/install Node.js 22+
function Test-NodeVersion {
    try {
        $ver = & node -v 2>$null
        if ($ver) {
            $major = [int]($ver -replace '^v(\d+)\..*', '$1')
            return $major -ge 22
        }
    } catch {}
    return $false
}

if (-not (Test-NodeVersion)) {
    Write-Host "Node.js 22+ is required but not found." -ForegroundColor Yellow
    Write-Host ""

    $hasWinget = $null -ne (Get-Command winget -ErrorAction SilentlyContinue)
    if ($hasWinget) {
        Write-Host "Installing via winget..."
        & winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
        # Refresh PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    } else {
        Write-Host "Automatic installation not available."
        Write-Host "Please install Node.js 22+ from: https://nodejs.org/"
        Write-Host "Then re-run this script."
        exit 1
    }

    if (-not (Test-NodeVersion)) {
        Write-Host "Node.js installation failed. Please install manually from https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
    $nodeVer = & node -v
    Write-Host "Node.js $nodeVer installed" -ForegroundColor Green
}

# Docker check is deferred — Railway deployments don't need Docker locally
$nodeVer = & node -v
Write-Host "Node.js $nodeVer" -ForegroundColor Green

$hasDocker = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
if ($hasDocker) {
    try {
        & docker info 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) {
            $dockerVer = (& docker --version) -replace '^Docker version ([^,]+),.*', '$1'
            Write-Host "Docker $dockerVer" -ForegroundColor Green
        } else {
            Write-Host "Docker installed but not running (only needed for Docker Compose)" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "Docker installed but not running (only needed for Docker Compose)" -ForegroundColor DarkGray
    }
} else {
    Write-Host "Docker not detected (only needed for Docker Compose deployments)" -ForegroundColor DarkGray
}
Write-Host ""

# Hand off to Node.js orchestrator
# Nested Join-Path so this works on Windows PowerShell 5.1 too — the 3-arg
# form (Join-Path path child1 child2) only exists via -AdditionalChildPath
# in PowerShell 6+, which not every operator has installed.
$deployScript = Join-Path (Join-Path $PSScriptRoot "deploy") "main.mjs"
& node "$deployScript" @args
exit $LASTEXITCODE
