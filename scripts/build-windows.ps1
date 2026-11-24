$ErrorActionPreference = 'Stop'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $RepoRoot
try {
    Write-Host '=== Installing workspace dependencies ===' -ForegroundColor Cyan
    & pnpm install
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed with exit code $LASTEXITCODE" }

    Write-Host '=== Building standalone Windows executable (with embedded Node.js runtime) ===' -ForegroundColor Cyan
    & node (Join-Path $PSScriptRoot 'build-app.mjs') '--target=win'
    if ($LASTEXITCODE -ne 0) { throw "build-app.mjs failed with exit code $LASTEXITCODE" }

    Write-Host '=== Windows standalone build complete ===' -ForegroundColor Green
} finally {
    Pop-Location
}
