# Developer Scripts

## Local CI — `preflight.sh` and `ship.sh`

Run the **entire** GitHub CI pipeline locally (in WSL) before pushing, so failures
surface in seconds on your machine instead of minutes later on GitHub.

### `preflight.sh` — full CI parity

Mirrors `.github/workflows/ci.yml` exactly. It spins up **ephemeral** Postgres/Redis
containers (identical to CI's service containers, on non-standard ports so they never
touch your dev database), runs the CI step list, and tears them down on exit.

```bash
scripts/preflight.sh          # full parity, including Playwright E2E
scripts/preflight.sh --fast   # everything except E2E (much faster)
```

Steps: `npm ci` → `npm audit` → Prettier `--check` → ESLint → Prisma generate +
migrate → unit + integration + component tests → `next build` → (E2E: start server,
`wait-on` health, `playwright test`).

Full preflight requires port 3001 to be free before E2E startup. It refuses to
continue if another listener is present, so the health check cannot accept a
stale application instance. The E2E app runs in its own process group, which is
terminated on success, failure, `SIGINT`, or `SIGTERM`; this cleanup is scoped to
the preflight-owned group and does not stop the development server on port 3000.

The Playwright suite exercises magic-link authentication and sign-out, anonymous
route protection, public/private/password event access, RSVP creation, validation
and token editing, calendar/CSV access boundaries, and authenticated host event
creation, dashboard, event-page, and settings flows. Its global setup seeds
independent deterministic fixtures so specs remain safe under parallel workers
and retries.

### `dev-sync.sh` and `dev-reset.sh` — local services

Run `scripts/dev-sync.sh` after switching branches to start and health-check the
local Postgres and Redis containers, regenerate Prisma, apply migrations, and
seed baseline data. Pass `--deps` after cloning or changing dependencies.

`scripts/dev-reset.sh --confirm` deletes only the disposable local named volumes
for Postgres and Redis, then recreates and reseeds them. It must never be used
against a production deployment.

### `ship.sh` — one-shot commit + push + PR

Runs `preflight.sh`, and **only if everything passes** commits, pushes, and opens the PR.
Nothing reaches GitHub unless it's green locally.

```bash
scripts/ship.sh "<commit message>" [options] --pr-body-file <path> -- <reviewed files...>

# examples
scripts/ship.sh "fix(auth): tighten session check" --label bug --pr-body-file /tmp/pr.md -- app/auth.ts
scripts/ship.sh "chore: update local tooling" --label chore --fast --pr-body-file /tmp/pr.md -- scripts/dev-sync.sh
```

The PR body file must contain `## Summary`, `## Verification`, and
`## Documentation` headings. The script rejects unsupported release labels,
pre-existing staged work, and unreviewed tracked or untracked changes.

### One-time WSL setup

- **Node 22** via nvm (`nvm install 22`).
- **Docker** (Docker Desktop with WSL integration) for the ephemeral services.
- **git push/pull**: share the Windows credential manager —
  `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
- **gh**: authenticated in WSL (`gh auth login`, or reuse the Windows token).
- **Playwright browsers** (only for full E2E): `npx playwright install --with-deps chromium` (one-time).
