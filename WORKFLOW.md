# RSVP to Me — Codex Workflow

This is the operational runbook. `AGENTS.md` contains the durable rules;
scripts in this repository are the source of truth for repeatable commands.

## 1. Start an editing task

```bash
git status --short --branch
```

If the tree is dirty, stop and ask the user how to proceed. Do not stash or
reset it automatically.

```bash
git fetch origin
```

From a clean tree, create one branch from the latest remote main:

```bash
git switch -c codex/<label>-<topic> origin/main
```

Allowed labels are `feature`, `ui/ux`, `bug`, `refactor`, `performance`,
`documentation`, `tests`, and `chore`. Do not create a branch for a read-only
task.

Present the implementation plan and wait for approval before editing.

## 2. Synchronize local development services

The Next.js dev server runs natively in WSL. Docker Compose provides only the
Postgres and Redis services because `docker-compose.override.yml` disables the
app service and publishes database ports locally. The local override stores
Postgres and Redis in Docker named volumes, keeping container-owned database
files out of the repository.

```bash
scripts/dev-sync.sh
```

Use the dependency flag only after a fresh clone or a package-lock/package.json
change:

```bash
scripts/dev-sync.sh --deps
```

Start the app separately when needed:

```bash
npm run dev
```

The server watches source files. Restart it only after a dependency or
environment change, or when it is unhealthy. Development data is disposable,
but deleting Docker data remains an explicit user-approved action.

To discard and recreate the disposable local database and cache:

```bash
scripts/dev-reset.sh --confirm
```

## 3. Implement

- Follow the project conventions in `AGENTS.md`.
- Add regression coverage for bugs and update tests that encode old behavior.
- Update admin documentation for behavior, feature, configuration, or workflow
  changes; update host documentation when host/guest UX or operations change.
- Report unrelated issues; do not modify `ROADMAP.md` unless the user approves
  logging the issue.

## 4. Verify

Run targeted checks during implementation. Before shipping, select the
preflight level by risk:

```bash
scripts/preflight.sh --fast
```

Use fast preflight for normal application behavior, tests, refactors, and
tooling changes. It checks formatting, linting, generated Prisma client,
migrations against an isolated database, unit/integration/component tests,
build, and type checking.

```bash
scripts/preflight.sh
```

Use full preflight for migrations, authentication, public RSVP flows, or
release-critical work. It additionally starts an isolated app on port 3001 and
runs Playwright E2E tests. Both modes use ephemeral containers on ports 55432
and 56399 and never touch the dev database.

## 5. Review and ship

Show the user the files, diff summary, validation results, proposed commit
message, label, and PR summary. Wait for one explicit approval such as
`ship it`.

Use `scripts/ship.sh` with only the reviewed files after `--`:

```bash
scripts/ship.sh "chore: improve workflow guardrails" --label chore --fast --pr-body-file /tmp/rsvp-pr.md -- AGENTS.md WORKFLOW.md scripts/dev-sync.sh scripts/ship.sh
```

The script first runs Prettier only on reviewed paths that still exist, then
runs the chosen preflight, stages only those paths, rejects secrets, focused
tests, and debug artifacts, commits, pushes, and opens a PR to `main` with the
specified label. New PRs require a body file containing `## Summary`,
`## Verification`, and `## Documentation` sections. The script stops if the
branch has an open PR unless the user has explicitly authorized an update.

## 6. CI follow-up

After opening a PR, inspect its checks:

```bash
gh pr checks <pr-number> --watch
```

If a check fails, reproduce it locally when practical, make a focused fix,
re-run the relevant preflight, and obtain approval before shipping the update.
