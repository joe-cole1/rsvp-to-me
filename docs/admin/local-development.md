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

## Contributing

For issue reporting, translation and code contributions, testing expectations,
and contribution licensing, see the
[contributing guide](https://github.com/joe-cole1/rsvp-to-me/blob/main/CONTRIBUTING.md).
The commands and environment setup below support that workflow.

## Codex instructions

The repository's `AGENTS.md` records project setup, architecture pointers,
validation commands, and approval and shipping requirements. Delegation uses
Codex's built-in agents without project-specific model or reasoning restrictions.
Ask for subagents or parallel agent work when you want to delegate a task.

## Dependency maintenance

`.github/dependabot.yml` is the source of truth for dependency automation.
Dependabot checks the application, optional email worker, and GitHub Actions
every Monday at 09:00 Asia/Seoul. Each job batches available patch and minor
updates into one routine PR, after a seven-day release cooldown. This targets
three routine batches per week when updates are available, rather than a PR
for every package release. A release can wait until the next weekly check after
its cooldown ends.

Major upgrades stay separate from routine batches. The application's existing
Next.js, Radix, Prisma, React, Vitest, and React Email package families stay
grouped for coordinated upgrades; other majors get individual PRs. Each family
group explicitly allows only major updates, so its more-specific package
patterns cannot take patch/minor updates out of the routine batch. Group order
alone does not provide that separation. Keep the
Node runtime and declaration major coordinated as described below. Version PR
limits are two for the application and one each for the worker and Actions;
majors share those limits, so these are queue limits, not weekly quotas.

Each job has a separate security-update group covering all its dependencies.
Keep Dependabot alerts and security updates enabled in the repository's
Advanced Security settings. Security updates bypass the version-update schedule
and cooldown and have a separate GitHub PR limit. Review them promptly rather
than waiting for the weekly maintenance session.

### Automatic merging

Application and worker npm PRs are automatically enrolled for squash auto-merge
when every dependency update is patch or minor, including qualifying security
fixes. GitHub merges them after the required merge checks pass. Major upgrades
and GitHub Actions updates remain manual.

If checks are already green when enrollment runs, the workflow can perform the
normal protected squash merge immediately. Both paths bind the request to the
inspected head SHA and enforce the same required merge rules.

Eligibility requires an open, non-draft, same-repository Dependabot PR targeting
`main`, a single verified Dependabot commit, and changes only to the selected
project's existing `package.json` and/or `package-lock.json`. Mixed projects,
unknown update types, source/workflow changes, added/deleted/renamed files, and
human-edited commits require manual review. Every dependency in a grouped PR is
checked individually. The enrollment request is bound to the inspected head SHA.

Keep repository auto-merge enabled and retain the `main` ruleset's required
`ci`, `Container (amd64)`, and `Container (arm64)` checks, CodeQL security gate,
and up-to-date branch requirement. The workflow refuses enrollment when those
protections are missing. It uses the built-in workflow token and no custom
secrets or administrator bypass. Its privileged job runs trusted base-branch
code without installing dependencies or executing PR code.

The workflow evaluates PRs when opened, reopened, updated, edited, or moved
between draft and ready. A newer head is evaluated by its own run. If a PR
becomes ineligible, the workflow revokes auto-merge that it previously enabled;
it preserves independently enabled maintainer auto-merge settings. Making a PR
a draft immediately prevents merging while it is investigated. Disabling the
workflow stops future enrollment; also disable auto-merge on already enrolled
PRs when pausing the policy. Merging the workflow does not bulk-enroll the
existing backlog; those PRs are evaluated on their next qualifying event.

Review dependency results weekly and inspect release notes and manifest/lockfile
diffs for PRs requiring manual review. If a batch fails because of one
dependency, isolate that dependency for investigation; do not weaken checks to
accept it. Major upgrades need a compatibility review and may require
application changes.

### Replacing an existing backlog

When changing this policy, first land the configuration on `main`, where
Dependabot reads it. Check open security alerts and existing PRs, then verify
replacement coverage before closing superseded PRs. Closing a Dependabot PR can
suppress that version, so do not assume closing the backlog will recreate the
same updates. Use the repository's Dependabot update page to check for updates,
and inspect ignored updates if an expected replacement is missing. Do not use
ignore commands as a backlog-cleanup shortcut.

## Saved configuration secrets

Saved provider credentials are converted automatically by `scripts/dev-sync.sh`
and `npm start`. If your development database contains older saved secrets,
keep the same `ENCRYPTION_KEY` / `SESSION_SECRET` and make `pg_dump` available
on PATH. Conversion requires writable `data/backups/pre-migration/` storage.
`npm run db:secrets -- --check` checks without writing; `--rollback` is only for
a deliberate downgrade with all app instances stopped. See
[Upgrading](./upgrading.md#automatic-configuration-secret-conversion-328--339).

## One-time setup

Install Node using nvm, then use the version recorded by the repository:

```bash
nvm install
nvm use
```

Create a local configuration file before starting the services:

```bash
cp .env.example .env
```

Use a disposable local database and development credentials. Set
`POSTGRES_PASSWORD` and `REDIS_PASSWORD` in `.env`, and generate `SESSION_SECRET`
with `openssl rand -base64 32`. The native Next.js process also needs explicit
connection URLs; Compose only constructs those URLs for the containerized app.
Replace the password placeholders in these values with the matching local
passwords (URL-encode reserved characters when needed):

| Variable              | Local value                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`        | `postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5432/rsvp_db` |
| `REDIS_URL`           | `redis://:<REDIS_PASSWORD>@127.0.0.1:6379`                         |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000`                                            |

Use a local test address for `INITIAL_ADMIN_EMAIL` and configure email delivery,
then visit `/setup` to create the first administrator without sample data. Leave
`SEED_TEST_DATA=false` for a clean install. Set it to true only for demo content.
Host invite codes are managed in the Admin Panel; `HOST_INVITE_CODE` is retired.

Repository scripts select `.nvmrc` automatically. When running raw Node or npm
commands from a noninteractive shell, load `$HOME/.nvm/nvm.sh` first. If that
shell inherited Windows `TEMP` or `TMP`, set `TMPDIR`, `TMP`, and `TEMP` to
`/tmp` before running Node tooling.

Keep the root `@types/node` dependency on the supported Node 22 major. It now
uses `^22.20.4`, replacing the Node 26 declarations that could allow APIs absent
from the deployed runtime. Declaration-package patch numbers do not need to
match Node's runtime patch number. Dependabot continues checking Node 22 typing
updates; major typing upgrades require a coordinated runtime change. When
changing Node's major, review `.nvmrc`, `package.json` engines, the Docker base,
CI, and the type declarations together, then run type checks and container QC.

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
restart it only after switching branches, pulling, a dependency or environment
change, or a full `scripts/preflight.sh` run (which reinstalls `node_modules`).
To restart, run:

```bash
scripts/dev-restart.sh
```

It stops the server already on port 3000, syncs services, rebuilds the dev
cache, and starts a new server in the foreground. If port 3000 is held by
something other than a Next.js server, it names that process and stops without
touching it. To stop the server without starting a new one, run
`scripts/dev-restart.sh --stop-only`.

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

Prisma 7.10.1 pins `effect` 3.20.0 through `@prisma/config`, which loads
whenever migrations run. A scoped `@prisma/config` override raises it to the
patched 3.22 line for
[GHSA-7589-6fvf-x4pw](https://github.com/advisories/GHSA-7589-6fvf-x4pw).
The override sits at the top level because an override nested under `prisma`
does not reach that grandchild. Remove it once a stable Prisma release depends
on `effect` 3.22.1 or later; the regression guard keeps checking every
installed copy.

ESLint 9 still resolves `minimatch` 3, whose legacy callable
`brace-expansion` API is incompatible with the named export in the only patched
release. `vendor/brace-expansion-compat/` temporarily exposes both interfaces
while delegating expansion to the official patched package. The root `.npmrc`
sets `install-links=true` so npm installs that local adapter as a regular
package rather than a depth-relative symlink. Do not remove the adapter,
override, or npm setting independently. Weekly Dependabot updates and
[issue #546](https://github.com/joe-cole1/rsvp-to-me/issues/546) track the
upstream releases and coordinated removal checklist.

## Dependency updates

Dependabot checks the application and independent `worker/` npm project daily,
with up to 10 version-update PRs open per project. Additional updates can appear
as earlier PRs close, so check the queue again after each batch. React Email's
CLI and UI packages share an update group.

All dependency tests check application behavior, documented security minimums,
or compatibility of resolved packages. A compatible update must not require
editing a test's copy of the selected release. Security guards check every
present resolution and allow upstream to remove a transitive dependency.
Independent toolchains may use different patched versions; overlapping manifest
ranges need not have identical text. Keep functional tests, runtime security
audits, and coverage thresholds blocking. Parse DOM attributes and numeric CSS
values when formatting is not part of the application contract.

CI selects Node from `.nvmrc`, and its cache identities include that selection.
Playwright's global setup starts a loopback-only SMTP sink, points the disposable
test database's email configuration at it, and restores that configuration on
teardown. It acknowledges sign-in and invitation messages without retaining their
contents or contacting external providers. Production no-transport failures are
therefore exercised separately from successful browser delivery flows (#849).

Both preflight modes run a clean `npm ci` even when `node_modules` already exists,
so switching branches or lockfiles cannot silently test an old dependency tree.
Vitest's `server-only` marker is repository-owned; production builds retain
Next.js's actual client/server boundary checks.
Generated test/build workspaces under `.vitest/` and agent worktrees under
`.claude/` are excluded from application lint, type checks and unit discovery,
so generated dependency-test artifacts cannot introduce unrelated failures.

The root lint command uses ESLint 10 with the existing Next.js Core Web Vitals
and TypeScript presets (#340). Next.js added ESLint 10 compatibility in
`eslint-config-next` 16.4.0; keep the Next.js/config versions aligned below.
Some bundled React, import and accessibility plugins still declare older ESLint
peer ranges. npm may report peer warnings even though the Next.js preset supports
ESLint 10. Use the repository's normal `npm ci`; do not add `--force` or
`--legacy-peer-deps` to suppress them. The #340 regressions exercise actual React,
Hooks, accessibility, import, Next.js and TypeScript diagnostics, including the
intentional email markup exceptions. The #546 brace-expansion adapter remains
necessary for the bundled plugins' legacy minimatch dependencies.
Workflow regression tests declare `js-yaml` directly as a development dependency;
they no longer rely on ESLint to install it transitively. Its override references
that direct declaration, so dependency updates have one version source of truth.

Next.js and `eslint-config-next` share one update group and must resolve to
the same release. The regression baseline requires Next.js 16.4.1 or
later, including every locked Next.js runtime, native compiler, and ESLint
package. This is a minimum security version, so a coordinated later patch
does not require changing the test just to accept the new version. Keep the
patched `source-map-js` 1.2.2 or later resolution when regenerating the lockfile;
earlier releases fail the production dependency audit.

Roboto is bundled in `app/font-files/` and loaded through `next/font/local`.
Some Google Fonts responses use extensionless `/l/font?kit=...&skey=...` URLs;
Next.js 16.3.8 incorrectly splits their query string and reports
`Can't resolve '@vercel/turbopack-next/internal/font/google/font'`. This is the
upstream parser defect tracked in
[Next.js #99114](https://github.com/vercel/next.js/issues/99114), rather than a
missing npm package or an AMD64-only dependency. The local asset preserves
Roboto's regular/bold weights, CSS variable, glyph coverage, and lazy loading.
Turbopack remains the production bundler. The font's source, license, and
reproduction details are recorded in `app/font-files/README.md`; other Google
font families still require network access at build time.

React, React DOM, and their declaration packages share one update group; the
two runtime packages must resolve to exactly the same version. Vitest and its
coverage provider also share an update group and must stay on matching versions.
Grouping keeps related changes in one PR but does not replace compatibility
review, especially for major upgrades.

The Cloudflare worker toolchain uses stable minimum security floors rather than
exact pins: Wrangler 4.147.0, Undici 7.29.1, and
`@cloudflare/workers-types` 5.20261003.1 or later. The regression baseline
rejects missing, malformed, and prerelease versions, while allowing later
patched lockfile releases.

Vitest and `@vitest/coverage-v8` must resolve to the same release at or above
the documented security minimum. Component setup imports `@testing-library/jest-dom/vitest` so its
runtime matchers and TypeScript declarations attach to Vitest. Keep hoisted
mock calls at module scope and await asynchronous assertions; Vitest 5 enforces
both and clears mock call history before each test by default.

CI and both preflight modes also type-check the standalone email worker
(`worker/worker.ts`) with the same `npx tsc --ignoreConfig …` command, because
the root `tsconfig.json` excludes `worker/` and the `wrangler deploy --dry-run`
bundle check does not type-check. Keep the command in `scripts/preflight.sh`
identical to the **Type-check email worker** step in `.github/workflows/ci.yml`;
a regression test compares them.

CI and both preflight modes run `npm run test:coverage` for the unit suite,
enforcing the existing thresholds in `vitest.config.ts`: 70% branches and 80%
statements, functions, and lines. Coverage reports remain in `coverage/`;
Vitest's other generated reports use the ignored `.vitest/` directory. After
updates, review the coverage file set as well as percentages, then run the
separate integration and component suites, type checks, and browser tests.

Zod 4.6.5 uses Unicode code points for built-in string limits, a change introduced
in 4.5. The application preserves its existing UTF-16 code-unit limits through
`lib/string-length.ts`, matching JavaScript `String.length` and HTML `maxlength`.
Use these checks for bounded text in the shared form and email-template schemas;
keep each field's existing trim/transform order. For Zod updates, run the Unicode
boundary regression tests and full preflight, including authentication, RSVP
create/edit, questionnaire validation, URL restrictions, and email-template
tests. Require CI and both production container checks before merging and again
on `main` afterward.

React updates also need the component suite and React Email template/preset
rendering tests: these use the declared runtime packages, while the App Router
uses Next.js's bundled React build. Run the full browser suite and production
build too, covering RSVP creation/editing, form submission, dialog focus, and
host navigation. Check application and test types after updating both
declaration packages.

For patches to tools such as `tsx`, `@testing-library/user-event`,
and the React Email CLI, run a clean install and the existing unit, component,
and type checks. `tsx` is a runtime dependency for production seeding and must
resolve to a stable version at least 4.23.15; compatible patches need no exact
version assertion. Keep the remaining security overrides in place; patched
deepmerge-ts now comes from native upstream dependencies. Before merging, require CI
and production container QC on both AMD64 and ARM64; the container checks also
exercise database seeding through `tsx`. Repeat those checks on `main` after
the merge before continuing to the next batch.

For updates to `@testing-library/react`, run the complete component suite and
review event-dispatch or `act()` warnings. For Prettier updates, check formatting
across tracked files before merging and review any resulting rewrites. A
formatter patch can change Markdown or embedded template-literal output.

Both Playwright Docker entry points call `scripts/playwright-image.cjs`, which
derives the exact `v<installed-version>-noble` image tag from the installed
`@playwright/test` package. No second release pin needs updating when Dependabot
changes the lockfile. The Noble image is based on Ubuntu 24.04. Use a
supported WSL distribution such as Ubuntu 22.04 or 24.04. The application
continues to use the Node version in `.nvmrc`.

After a Playwright update, run the full preflight and browser suite. CI and both
preflight modes run `scripts/check-playwright-docker.sh`, which selects the
matching image and launches its bundled Chromium to verify rendering, clicks,
and screenshots. The shared check mounts the repository read-only. This
image check runs without network access or a database; the full application
flows run in the separate E2E step. Linux ARM64 uses Chrome for Testing starting in 1.63.

Changes to `jsdom` or `tailwind-merge` also need the component and browser
suites. Check form validation, dialog interactions, and guest-list behavior;
the DOM simulation can change while application code stays the same. For
class-merging updates, compare existing class combinations and custom
`className` overrides.

Upgrade the Prisma CLI (`prisma`), `@prisma/client`, and `@prisma/adapter-pg`
together. Prisma 7.10 continues to load the existing `prisma.config.ts`, including
the `prisma/postgres-migrations` path; this dependency update does not require a
config rename or a schema migration. Regenerate the client and run the full
preflight for database dependency updates. The PostgreSQL integration suite
checks transaction rollback and constraint errors, while container QC checks
migration deployment, seeding, health, and pre-migration backups on both
architectures.

Prisma Studio 7.10 binds to loopback and checks the browser origin. Open it using
the local `localhost` or `127.0.0.1` URL printed by `npm run db:studio`.

## Reset disposable development data

This command permanently deletes the **local development** Postgres and Redis
named volumes, recreates them, applies migrations, and loads sample data only when explicitly enabled:

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

Where `gh` cannot open PRs, the canonical `scripts/ship.sh` supports an explicit
`--pr-handoff` mode. Before invoking it, check the branch's open, closed, and
merged PR state through the GitHub integration under the repository shipping
rules. All local validation and Git safeguards still run; a body file with the
required headings remains mandatory. After pushing, use the printed handoff to
create or update the appropriate PR and monitor CI through the integration.
See [Developer Scripts](https://github.com/joe-cole1/rsvp-to-me/blob/main/scripts/README.md)
for usage and the PR-state caveat.

`scripts/ship.sh` does not repeat a preflight that already passed on the exact
files being shipped (`--rerun-preflight` forces a run). It retries `npm`, `git push`
and `gh` steps that fail with a transient DNS or connection error, and ships
commits already on the branch with `--committed`. The PR title is the commit
message's first line.

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

## CI checks and restarting development

CI checks formatting and lint without rewriting or pushing files. Local
work uses the selected branch; PR CI checks GitHub's temporary merge with
`main`. Push runs check the triggering commit, and manual runs still check the
selected branch or tag. The workflow uses checkout's event default and retains
all npm, Playwright and Next.js caches; PR cache writes stay within the PR's
merge-ref scope.

Local preflight uses the same format checker, a Redis image resolved from the source
Compose deployment, and zero Playwright retries. Full preflight and CI seed rich
fixtures explicitly before E2E; ordinary development and container startup
honor `SEED_TEST_DATA` from `.env`. No baseline seed or environment invite code
is needed. Both full gates also test `/setup` on a separate migrations-only database.

The first-run setup browser check reuses an active Node version that exactly
matches `.nvmrc`, including the version selected by CI's `actions/setup-node`.
It only loads nvm when Node is missing or differs, and disables nvm's automatic
selection while loading it. A successful nvm command must still leave the required
version active. No nvm version cache is required when the correct Node is already
on PATH; a missing or incorrect runtime stops before any database operation.

Full preflight and CI also run `bash scripts/check-turnstile-csp.sh` after the
CAPTCHA-disabled suite. The blocking enabled-Turnstile nonce check starts an
isolated production server on port 3003 with dummy keys and intercepts the browser
API script. It requires no production credentials and makes no live provider
verification calls. Port 3003 must be free. Fast preflight skips both E2E runs.

The release workflow reuses CI and native AMD64/ARM64 container QC as prerequisite
jobs for the released commit, with checkout-SHA verification before validation
and publication. Manual runs, event-default checkout and all caches remain.

After changing branches, pulling, or running preflight, use
`scripts/dev-restart.sh`. It starts normally when port 3000 is empty, replaces
an existing Next.js server, and refuses to stop a different service. Socket
inspection failures remain blocking and are reported. `--stop-only` succeeds
when there is no server to stop.

### Shipping configuration templates

Public `.env.example` and `.env.<name>.example` files are allowed in reviewed
shipping paths, including subdirectories. Templates contain placeholders only;
never put actual credentials or private values in them. The shipping guard blocks
real environment files such as `.env`, `.env.local` and `.env.production`, and
non-template suffixes such as `.env.example.bak`. This applies to both normal
shipping and `--committed` mode.
