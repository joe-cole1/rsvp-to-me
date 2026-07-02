# scripts/run-e2e-docker.ps1
# A script to run Playwright E2E tests locally inside a Docker container.
# This runs without using LLM tokens and operates purely locally on your machine.

# 1. Check if the app container is running
$appContainer = docker ps -q --filter "name=optimistic-planck-app"
if (-not $appContainer) {
    Write-Host "App container is not running. Starting Docker environment..." -ForegroundColor Yellow
    docker compose up -d
    Start-Sleep -Seconds 5
    $appContainer = docker ps -q --filter "name=optimistic-planck-app"
    if (-not $appContainer) {
        Write-Host "Failed to start or locate the app container." -ForegroundColor Red
        exit 1
    }
}

# 2. Extract configuration from the running app container
Write-Host "Extracting connection strings from running app container..." -ForegroundColor Cyan
$json = docker inspect $appContainer --format '{{json .Config.Env}}'
if (-not $json) {
    Write-Host "Failed to inspect the container environment." -ForegroundColor Red
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

if (-not $dbUrl -or -not $redisUrl) {
    Write-Host "Failed to extract DATABASE_URL or REDIS_URL from the container." -ForegroundColor Red
    exit 1
}

# 3. Resolve test files to run
$testTarget = ""
if ($args.Count -gt 0) {
    $testTarget = $args[0]
    Write-Host "Targeting test: $testTarget" -ForegroundColor Cyan
}

# 4. Run the Playwright container
Write-Host "Starting Playwright container (v1.61.1-noble) and running E2E tests..." -ForegroundColor Cyan

$shCommand = "npm ci"
if ($testTarget) {
    $shCommand += " && npx playwright test $testTarget"
} else {
    $shCommand += " && npx playwright test"
}

docker run --rm -it `
  --network optimistic-planck_default `
  -v "${PWD}:/work" `
  -w /work `
  -e PLAYWRIGHT_BASE_URL="http://host.docker.internal:3000" `
  -e DATABASE_URL="$dbUrl" `
  -e REDIS_URL="$redisUrl" `
  -e SESSION_SECRET="$sessionSecret" `
  mcr.microsoft.com/playwright:v1.61.1-noble `
  sh -c $shCommand
