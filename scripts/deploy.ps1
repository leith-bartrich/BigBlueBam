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

# Check Docker
$hasDocker = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
if (-not $hasDocker) {
    Write-Host ""
    Write-Host "Docker is required but not installed." -ForegroundColor Red
    Write-Host ""
    Write-Host "Install Docker Desktop from:"
    Write-Host "  https://docs.docker.com/desktop/install/windows-install/"
    Write-Host ""
    Write-Host "After installing, make sure Docker is running, then re-run this script."
    exit 1
}

try {
    & docker info 2>$null | Out-Null
} catch {
    Write-Host ""
    Write-Host "Docker is installed but not running." -ForegroundColor Yellow
    Write-Host "Please start Docker Desktop and re-run this script."
    exit 1
}
# Also check via exit code (docker info returns non-zero when daemon is down)
& docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Docker is installed but not running." -ForegroundColor Yellow
    Write-Host "Please start Docker Desktop and re-run this script."
    exit 1
}

$nodeVer = & node -v
$dockerVer = (& docker --version) -replace '^Docker version ([^,]+),.*', '$1'
Write-Host "Node.js $nodeVer" -ForegroundColor Green
Write-Host "Docker $dockerVer" -ForegroundColor Green
Write-Host ""

# Hand off to Node.js orchestrator
$deployScript = Join-Path $PSScriptRoot "deploy" "main.mjs"
& node "$deployScript" @args
exit $LASTEXITCODE
