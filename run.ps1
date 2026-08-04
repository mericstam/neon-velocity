# Install dependencies and run the app. Windows entry point.
#   .\run.ps1          -> dev server
#   .\run.ps1 build    -> production build
#   .\run.ps1 test     -> test suite
$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error 'node not found on PATH - install Node.js 20.19+ or 22.12+ first: https://nodejs.org'
  exit 1
}

& node (Join-Path $PSScriptRoot 'scripts/start.mjs') @args
exit $LASTEXITCODE
