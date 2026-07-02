# scripts/run-e2e-noninteractive.ps1
$appContainer = docker ps -q --filter "name=optimistic-planck-app"
if (-not $appContainer) {
    Write-Host "App container is not running." -ForegroundColor Red
    exit 1
}

$json = docker inspect $appContainer --format '{{json .Config.Env}}'
if (-not $json) {
    Write-Host "Failed to inspect container environment." -ForegroundColor Red
    exit 1
}

$envList = ConvertFrom-Json $json
$dbUrl = ""
$redisUrl = ""
$sessionSecret = ""

foreach ($line in $envList) {
    if ($line.StartsWith("DATABASE_URL=")) {
        $dbUrl = $line.Substring(13)
    }
    elseif ($line.StartsWith("REDIS_URL=")) {
        $redisUrl = $line.Substring(10)
    }
    elseif ($line.StartsWith("SESSION_SECRET=")) {
        $sessionSecret = $line.Substring(15)
    }
}

Write-Host "Starting Playwright E2E tests (non-interactive)..."

docker run --rm `
  --network optimistic-planck_default `
  -v "${PWD}:/work" `
  -w /work `
  -e PLAYWRIGHT_BASE_URL="http://host.docker.internal:3000" `
  -e DATABASE_URL="$dbUrl" `
  -e REDIS_URL="$redisUrl" `
  -e SESSION_SECRET="$sessionSecret" `
  mcr.microsoft.com/playwright:v1.61.1-noble `
  sh -c "npx playwright test"
