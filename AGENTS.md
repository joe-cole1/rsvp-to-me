# RSVP to Me — Agent Guide

This file contains only RSVP to Me-specific requirements.

## Repository and Task Identity

Work in:

`~/projects/rsvp-to-me`

Run Git, Node, npm, Prisma, and tests natively in WSL.

Every editing task uses one stable eight-character lowercase hexadecimal task tag.

Prefer the first eight characters of the Codex task UUID. If unavailable:

`openssl rand -hex 4`

Rename the Codex task to begin with `[<tag>]`.

Preserve the same tag through task title, branch, commit, and PR title.

## Task Start and Branching

Before write-capable work:

- `git status --short --branch`
- `git fetch --prune origin`

If unexplained changes exist:

`BLOCKED — PRE-EXISTING WORKTREE CHANGES`

Do not stash, discard, reset, clean, restore away, or absorb them without an explicit decision on how to preserve them.

After the user approves the plan and a clean baseline is confirmed, branch from current `origin/main`:

`codex/<label>-<tag>-<short-topic>`

Never commit directly to `main`.

Read-only planning/review does not require a branch.

Before editing source/scripts/docs/config/tests, present the implementation plan and wait for user approval.

## Architecture

`ARCHITECTURE.md` is the canonical repository map.

Read the relevant section before broad reconnaissance and update it when a PR changes an entry point, architectural boundary, ownership boundary, or documented source of truth.

If applicable ADRs exist, read them before consequential architecture/trust-boundary changes and update/add/supersede them when required by the plan.

## UI and Design Language

Every UI change follows:

`docs/engineering/design-language.md`

Read it before building or changing a screen. Use its tokens, shared components and patterns; prefer fewer options over more configurability.

If a change needs a pattern the document doesn't cover, propose it in the plan and add it to the document in the same PR.

## Development Environment

Native Next.js dev server:

`http://localhost:3000`

`docker-compose.override.yml` disables the Compose app and exposes:

- Postgres `127.0.0.1:5432`
- Redis `127.0.0.1:6379`

Use:

`scripts/dev-sync.sh`

Use:

`scripts/dev-sync.sh --deps`

only after cloning or when the approved plan explicitly authorizes dependency refresh/change.

Repository scripts load nvm and `.nvmrc`.

For raw noninteractive Node/npm/npx/Prisma commands, load:

`$HOME/.nvm/nvm.sh`

Use `/tmp`, not inherited Windows temp paths.

Local dev Postgres/Redis, containers, and volumes are disposable.

Within the approved task scope, Codex may rebuild/restart/recreate local services and use:

`scripts/dev-reset.sh --confirm`

without an additional user gate.

## Framework Conventions

Project uses Next.js 16 and Prisma 7.

Before framework-specific changes, inspect relevant repo-local Next.js docs under:

`node_modules/next/dist/docs/`

When DB behavior is involved, inspect:

`prisma/schema.prisma`

Conventions:

- route `params` are promises
- import Prisma models from `@/app/generated/prisma`
- use singleton `@/lib/db`
- reuse established access-control, rate-limit, Redis, session, and other helpers
- keep TypeScript strict
- avoid `any` without compelling justification
- use shared route-group layouts for shared navigation
- use `React.cache()` for shared server fetches needed by multiple Server Components

## Bugs and Tests

Every bug fix adds a regression test under:

`tests/regression/`

Include a short root-cause header and add the case to:

`tests/regression/README.md`

When behavior changes, update tests asserting the old behavior.

Never weaken tests merely to pass.

## Dependencies

Do not add/remove/change dependencies unless the approved plan explicitly authorizes it.

`scripts/dev-sync.sh --deps` does not itself authorize dependency changes.

Unexpected package/lockfile changes must be explained.

## Documentation and Roadmap

Feature, behavior, configuration, environment-variable, or workflow changes require an appropriate:

`docs/admin/`

update.

Changes affecting operations, guest experience, or host-facing UX also require the relevant:

`docs/host/`

update.

Pure internal refactors with no user/operator/config impact are exempt; state why in the PR.

Update `ROADMAP.md` only for an already tracked item or when the user explicitly approves unrelated roadmap work.

Useful unrelated findings may become follow-on issues; do not fold them into the current task.

## Validation

Format every Prettier-supported edited file.

Syntax-check edited shell scripts with Bash.

Run targeted tests during implementation.

Canonical preflight:

Normal application behavior/tests/refactors/tooling:

`scripts/preflight.sh --fast`

Database migrations, authentication, RSVP/public-flow changes, release-critical work, or explicit request:

`scripts/preflight.sh`

These are authoritative gates.

A failing required check stops shipping unless explicitly waived by the user. A waiver is separate from `"ship it"` and must be documented.

## Shipping Preparation and Shipping

Before asking the user to ship, prepare exact reviewed paths, concise diff summary, validation results, proposed commit message, release label, PR title/body, and current branch/PR state.

Prefix every commit subject and PR title with:

`[<tag>]`

Normally use one coherent Conventional Commit per approved task.

One current `"ship it"` authorizes Codex to stage reviewed paths, commit, push the current feature branch, create/update the appropriate still-open PR, and monitor CI.

Stage only reviewed paths. Never use:

`git add -A`

Never commit `.env`, secrets, generated noise, or unrelated files.

Every PR targets `main` and has exactly one release label:

- `feature`
- `ui/ux`
- `bug`
- `refactor`
- `performance`
- `documentation`
- `tests`
- `chore`

Use:

`scripts/ship.sh ... -- <reviewed paths>`

as the canonical shipping mechanism after authorization.

If the branch's prior PR is MERGED or CLOSED:

`BLOCKED — EXISTING PR IS NOT OPEN`

If an appropriate PR remains OPEN, the current `"ship it"` permits updating it.

Never merge, enable auto-merge, force-push, rewrite published history, push directly to `main`/`master`, or delete remote branches.

## GitHub CLI Authentication in WSL

Treat `gh auth status` as diagnostic, not conclusive.

Before declaring auth broken:

1. `type -a gh`
2. `gh --version`
3. `gh api user --jq .login`
4. test the required read-only repo/PR operation
5. distinguish auth from sandbox/network/DNS/proxy/GitHub-service/stale-config failures
6. never print tokens or credential/config contents

Do not start `gh auth refresh` or `gh auth login` without explicit permission.

## CI

After push/PR creation/update, monitor CI.

On failure, gather workflow/job/check, failing command/test, concise logs, relevant files/lines, likely cause, and suggested correction; then assess the failure before changing code.

Any substantive correction requires review and another `"ship it"`.

## Post-Merge

After merge:

`git switch main`

`git pull --ff-only`

`git branch -d <merged-branch>`

`git fetch --prune origin`

Never use `git branch -D` by default.

Preserve active or intentionally retained branches.

## Project Reference

RSVP to Me uses Next.js 16, TypeScript, Tailwind CSS, Radix Themes, PostgreSQL/Prisma, Redis, magic-link authentication, Nodemailer, and optional Twilio SMS.

Important patterns:

- hosts use magic links and encrypted `iron-session` cookies
- guests use RSVP edit tokens
- use `assertHost(eventId)` or `assertHostOrCohost(eventId)` for host access
- event email call sites pass the selected event theme through `resolveEmailTheme()`
- `resolveEmailTheme()` is the sole web-to-email degradation boundary
- uploads go through `/api/upload` and `/api/uploads/[filename]`; do not bypass validation/path handling
