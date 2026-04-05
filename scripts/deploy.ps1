# BigBlueBam deploy/restart helper for Windows (PowerShell).
#
# Usage (from repo root):
#   scripts\deploy.ps1            # up (build + start, detached) — default
#   scripts\deploy.ps1 up         # same
#   scripts\deploy.ps1 restart    # restart running containers (no rebuild)
#   scripts\deploy.ps1 rebuild    # force-rebuild + recreate everything
#   scripts\deploy.ps1 stop       # stop without removing containers
#   scripts\deploy.ps1 down       # stop + remove containers (KEEPS volumes)
#   scripts\deploy.ps1 logs       # tail logs from all services
#
# If .\site exists, the root domain is served from the site service.
# Otherwise `/` redirects to `/helpdesk/` per the base nginx config.

$ErrorActionPreference = 'Stop'

# cd to repo root (this script lives in scripts/)
Set-Location (Join-Path $PSScriptRoot '..')

$cmd = if ($args.Count -gt 0) { $args[0].ToLower() } else { 'up' }

$composeArgs = @('-f', 'docker-compose.yml')

if ((Test-Path 'site') -and (Test-Path 'site/package.json')) {
    Write-Host "==> site/ detected - enabling marketing site overlay (root domain -> site)" -ForegroundColor Cyan
    $composeArgs += @('-f', 'docker-compose.site.yml')
} else {
    Write-Host "==> site/ not present - root domain will redirect to /helpdesk/" -ForegroundColor Yellow
}

switch ($cmd) {
    { $_ -in 'up','deploy' } {
        & docker compose @composeArgs up -d --build
    }
    'restart' {
        & docker compose @composeArgs restart
    }
    'rebuild' {
        & docker compose @composeArgs up -d --build --force-recreate
    }
    'stop' {
        & docker compose @composeArgs stop
    }
    'down' {
        # NOTE: no `-v` - we never wipe volumes from this script. Data is sacred.
        & docker compose @composeArgs down
    }
    'logs' {
        & docker compose @composeArgs logs -f
    }
    { $_ -in 'ps','status' } {
        & docker compose @composeArgs ps
    }
    default {
        Write-Host "Usage: deploy.ps1 [up|restart|rebuild|stop|down|logs|ps]" -ForegroundColor Red
        exit 1
    }
}

exit $LASTEXITCODE
