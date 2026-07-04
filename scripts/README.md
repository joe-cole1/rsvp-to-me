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

### `ship.sh` — one-shot commit + push + PR

Runs `preflight.sh`, and **only if everything passes** commits, pushes, and opens the PR.
Nothing reaches GitHub unless it's green locally.

```bash
scripts/ship.sh "<commit message>" [--label <label>] [--base <branch>] [--fast] [--draft]

# examples
scripts/ship.sh "[abc123] fix(auth): tighten session check" --label bug
scripts/ship.sh "[abc123] chore: add local CI scripts" --label chore --fast
```

### One-time WSL setup

- **Node 22** via nvm (`nvm install 22`).
- **Docker** (Docker Desktop with WSL integration) for the ephemeral services.
- **git push/pull**: share the Windows credential manager —
  `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
- **gh**: authenticated in WSL (`gh auth login`, or reuse the Windows token).
- **Playwright browsers** (only for full E2E): `npx playwright install --with-deps chromium` (one-time).
