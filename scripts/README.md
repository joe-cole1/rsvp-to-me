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

Steps: `npm ci` → blocking production-dependency audits → non-blocking build-tool
advisory reports → Prettier `--check` → ESLint → Prisma generate + migrate → unit +
integration + component tests → `next build` → (E2E: start server, `wait-on`
health, `playwright test`).

The blocking audit covers dependencies that ship with the app or worker. Development
and build-tool advisories are still printed, but do not fail preflight when upstream
has not published a patched release. The production image separately installs with
`npm ci --omit=dev`, so those build-only packages are not copied into the runtime image.

Both modes always reconcile dependencies with `npm ci`. The installed Playwright
package selects its exact browser image through `playwright-image.cjs`, shared by
`check-playwright-docker.sh` and `run-e2e-docker.sh`. Package updates therefore
update the browser environment automatically; no image-release pin is copied
into a shell script. Browser failures remain blocking.

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

### `dev-restart.sh` — restart the dev server

`scripts/dev-restart.sh` serves the current checkout on :3000. It stops any
Next.js server already listening there, together with its `npm run dev` /
`next dev` wrappers, and waits for the port to close. Then it runs `dev-sync.sh`
(with `--deps` only when `package-lock.json` is newer than the last install),
removes the Turbopack dev cache in `.next/dev`, and starts `next dev` in the
foreground. A listener that is not a Next.js process is reported and left alone.
`--stop-only` stops the server without starting a new one, and `PORT` overrides
the port.

The listener is found with `ss`, because `lsof -i` does not list Node's
listening sockets in WSL. The dev cache is cleared because a cache built before
`npm ci` replaced `node_modules` fails every page with
`Cannot find module '@vercel/turbopack/postcss'`.

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

The PR title is the commit message's first line. The commit itself keeps the
full message, including its body and `Co-Authored-By` trailer.

**Preflight reuse.** Every passing `preflight.sh` run records the exact working
tree it checked: HEAD plus every tracked change and untracked, non-ignored file.
It is computed in a throwaway index and stored in the git directory as
`rsvp-preflight-pass`. When that tree has already passed in the requested mode
or a stronger one, `ship.sh` skips preflight; a full pass covers `--fast`, but
not the other way round. Changing any file, including through Prettier, means a
new run. `--rerun-preflight` forces one.

**Network retries.** `npm ci`, the npm audits, the Playwright browser install,
`git push`, and the `gh` calls go through `scripts/lib/net-retry.sh`. It retries
up to three times, five seconds apart, but only when the output shows a
transient network error such as a DNS `EAI_AGAIN`. A vulnerable package, a
rejected push, or a GitHub validation error fails at once.

**Shipping existing commits.** When the work is already committed on the branch
(for example one commit per fix, or a merge of `main`), use `--committed`
without a file list:

```bash
scripts/ship.sh "[<tag>] fix: two separate fixes" --committed --label bug --pr-body-file /tmp/pr.md
```

It requires a clean working tree and at least one commit ahead of
`origin/<base>`. It runs the same preflight and self-review guards on the
branch's diff from `origin/<base>`, then pushes and opens or reports the PR
without making a new commit.

Where `gh` cannot open PRs, use `--pr-handoff` and finish PR handling through
the GitHub integration:

```bash
scripts/ship.sh "[<tag>] chore: update local tooling" --pr-handoff --label chore --fast --pr-body-file /tmp/pr.md -- scripts/ship.sh
```

This explicit mode skips the `gh` requirement and every `gh` call. Formatting,
preflight, reviewed-path staging, self-review guards, commit, and push still run.
The body file and its required headings are mandatory, even with
`--allow-open-pr`. After a successful push, the script prints the base, head,
title, label, body-file path, and draft flag, then reports that PR handoff is
required. Create or update the appropriate PR and monitor CI through the
integration to finish shipping.

Before invoking this mode, check the branch's PR state through the integration.
An associated merged or closed PR must stop shipping under `AGENTS.md`;
an open PR must be updated under the current shipping authorization. The script
warns before formatting that PR state was not checked. `--allow-open-pr` retains
its normal-mode behavior but cannot enforce an open-PR guard in handoff mode.
Normal mode checks only open PRs, so checking for merged or closed PRs remains
the caller's responsibility in either mode.

### One-time WSL setup

- **Node 22** via nvm (`nvm install 22`).
- **Docker** (Docker Desktop with WSL integration) for the ephemeral services.
- **git push/pull**: share the Windows credential manager —
  `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`
- **gh**: authenticated in WSL (`gh auth login`, or reuse the Windows token),
  unless using `--pr-handoff` with a GitHub integration.
- **Playwright browsers** (only for full E2E): `npx playwright install --with-deps chromium` (one-time).
