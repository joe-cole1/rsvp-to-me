---
title: Local Development on Windows and WSL
description: Run the application natively in WSL with disposable Docker services.
category: Getting Started
audience: admin
order: 15
---

# Local Development on Windows and WSL

For the fastest local workflow, run the Next.js application natively inside
WSL and use Docker Desktop only for PostgreSQL and Redis. Keep the repository
under your Linux home directory (for example,
`~/projects/rsvp-to-me`), not under `/mnt/c`.

## One-time setup

Install Node using nvm, then use the version recorded by the repository:

```bash
nvm install
nvm use
```

Repository scripts select `.nvmrc` automatically. When running raw Node or npm
commands from a noninteractive shell, load `$HOME/.nvm/nvm.sh` first. If that
shell inherited Windows `TEMP` or `TMP`, set `TMPDIR`, `TMP`, and `TEMP` to
`/tmp` before running Node tooling.

Enable Docker Desktop's WSL integration for your Ubuntu distribution. The
repository's `docker-compose.override.yml` disables the application container,
publishes Postgres and Redis on loopback-only ports, and stores their local data
in Docker named volumes.

## Daily workflow

Synchronize development services after switching branches or pulling changes:

```bash
npm run dev:sync
```

Start the application in a separate WSL terminal:

```bash
npm run dev
```

Visit `http://localhost:3000`. The Next.js dev server watches source files, so
restart it only after a dependency or environment change.

The full `scripts/preflight.sh` check uses port 3001 for its temporary E2E app.
That port must be free before the E2E phase starts; preflight exits with a clear
error if another listener is present. Its temporary npm/Next.js process group is
stopped on every exit path without affecting the normal development server on
port 3000.

The full check's Playwright coverage includes authentication and sign-out,
event-access gates, RSVP create/edit/validation behavior, protected exports, and
authenticated host creation and settings flows. E2E setup recreates deterministic
`e2e-*` fixtures on each run, and teardown removes them afterward.

When a branch changes `package.json` or `package-lock.json`, reconcile the
installed dependency tree with:

```bash
scripts/dev-sync.sh --deps
```

The repository overrides `esbuild` to patched version 0.28.1 to prevent the
Windows development-server path traversal described in
[GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr).
Keep that constraint in place while any transitive dependency can otherwise
resolve to a vulnerable version.

Other security overrides keep React Email on the application's patched Next.js
16 release, raise PostCSS to its patched release line, and constrain Prisma's
development tooling to patched `find-my-way` and Valibot versions.

ESLint 9 still resolves `minimatch` 3, whose legacy callable
`brace-expansion` API is incompatible with the named export in the only patched
release. `vendor/brace-expansion-compat/` temporarily exposes both interfaces
while delegating expansion to the official patched package. The root `.npmrc`
sets `install-links=true` so npm installs that local adapter as a regular
package rather than a depth-relative symlink. Do not remove the adapter,
override, or npm setting independently. Weekly Dependabot updates and
[issue #546](https://github.com/joe-cole1/rsvp-to-me/issues/546) track the
upstream releases and coordinated removal checklist.

## Reset disposable development data

This command permanently deletes the **local development** Postgres and Redis
named volumes, recreates them, applies migrations, and loads the baseline seed:

```bash
npm run dev:reset -- --confirm
```

It does not modify source code, `.env`, or deployment data. Never use it for a
production deployment.

## WSL-only commands

Run Git, npm, Prisma, tests, and Docker commands from WSL for this repository.
Mixing Windows Git with WSL Git can create misleading line-ending and executable
permission changes in the shared working tree.

### GitHub CLI authentication checks

`gh auth status` can report a stale token stored in `hosts.yml` even when a
different credential source is successfully authenticating live GitHub
requests. Treat that output as a troubleshooting hint, not proof that GitHub
access is unavailable.

Before refreshing credentials, verify the active identity and retry the intended
read-only repository operation:

```bash
gh api user --jq .login
gh repo view --json nameWithOwner,defaultBranchRef
gh pr list --head "$(git branch --show-current)" --state open
```

If those live calls succeed, no authentication repair is needed. If a call
fails because a sandbox or restricted shell blocks the network, retry it with
normal network access. Run `gh auth refresh` or `gh auth login` only after the
live identity and repository checks continue to fail with authentication errors.
