# RSVP to Me — Agent Guide

## Scope and safety

- Work in the single WSL-native clone at `~/projects/rsvp-to-me`. Run Git, Node,
  npm, Prisma, and test commands natively in WSL; Docker Desktop runs only
  Postgres and Redis for development.
- Before any new task that edits files, run `git status --short --branch`,
  `git fetch --prune origin`, `git switch main`, and `git pull --ff-only`. If
  the tree contains changes you did not create for the active task, stop,
  report the files, and ask how to proceed.
- Never automatically stash, discard, reset, force-push, or overwrite changes.
  This includes adopting GitHub conflict resolutions; ask first.
- Give every editing task one eight-character lowercase hexadecimal task tag.
  Prefer the first eight characters of the Codex task UUID; if that ID is not
  available, generate a tag once with `openssl rand -hex 4`. Rename the Codex
  task to start with `[<tag>]`, and never regenerate the tag during that task.
- For an editing task with a clean tree, create a branch from `origin/main`:
  `codex/<label>-<tag>-<short-topic>`. Never commit directly to `main`.
- Read-only work, reviews, and planning do not require a new branch.
- Present an implementation plan and wait for approval before editing source,
  scripts, documentation, or configuration.

## Development environment

- The native Next.js dev server runs at `http://localhost:3000`.
- `docker-compose.override.yml` disables the Compose app service and exposes
  Postgres and Redis only at `127.0.0.1:5432` and `127.0.0.1:6379`.
- Start or reconcile local services with `scripts/dev-sync.sh`. Use
  `scripts/dev-sync.sh --deps` only after cloning or when dependencies change;
  it performs a clean `npm ci`.
- Repository scripts load nvm and select the exact version in `.nvmrc`.
  Noninteractive shells must load `$HOME/.nvm/nvm.sh` before running raw
  `node`, `npm`, `npx`, or Prisma commands, and should use `/tmp` rather than an
  inherited Windows temp path.
- Reset disposable local Postgres and Redis data only with explicit approval:
  `scripts/dev-reset.sh --confirm`.
- Development data is disposable, but do not delete Docker containers or
  volumes without explicit user approval.

## Implementation conventions

- `ARCHITECTURE.md` is the canonical repository map. Read its relevant section
  before broad searches, use its source-of-truth routing to scope changes, and
  update it when a PR changes an entry point or architectural boundary.
- This project uses Next.js 16 and Prisma 7. Before changing framework-specific
  code, read the relevant guide under `node_modules/next/dist/docs/` and inspect
  `prisma/schema.prisma` when database behavior is involved.
- In Next.js 16, route `params` are promises. Import Prisma models from
  `@/app/generated/prisma` and use the singleton in `@/lib/db`.
- Reuse existing helpers and patterns before introducing new ones. In particular,
  use the established access-control, rate-limit, Redis, and session helpers.
- Keep TypeScript strict; do not introduce `any` without a compelling reason.
- Use shared route-group layouts for shared navigation. Wrap shared server data
  fetches in `React.cache()` when multiple Server Components need the same data.
- For bugs, add a regression test in `tests/regression/` with a short root-cause
  header and add it to `tests/regression/README.md`.
- When behavior changes, update tests that assert the old behavior in the same
  change.

## Documentation and roadmap

- Any feature, behavior, configuration, environment-variable, or workflow
  change requires an appropriate `docs/admin/` update.
- Changes affecting operations, guest experience, or host-facing UX also require
  the relevant `docs/host/` update.
- Pure internal refactors with no user, operator, or configuration impact are
  exempt; say why in the PR.
- Update `ROADMAP.md` when the task implements a tracked item.
- Report out-of-scope bugs, security concerns, or failing tests with evidence.
  Add a roadmap item only after the user approves that unrelated documentation
  change.

## Verification

- Format every Prettier-supported edited file. Syntax-check shell scripts with
  Bash. `scripts/ship.sh` automatically formats its reviewed paths before
  preflight; CI also auto-formats drift.
- Run targeted tests while implementing.
- Run `scripts/preflight.sh --fast` before shipping normal application behavior,
  tests, refactors, or tooling changes.
- Run the full `scripts/preflight.sh` for database migrations, authentication,
  RSVP/public-flow changes, release-critical changes, or when requested.
- If a required check fails, report the failure and do not ship unless the user
  explicitly accepts the exception.

## Commit and PR workflow

- Before shipping, show the exact files, concise diff summary, verification
  results, proposed commit message, release label, and PR summary.
- Prefix every commit message and PR title with the task's `[<tag>]`. Using the
  same tag in the Codex task title, branch, commits, and PR makes each artifact
  searchable from the others.
- One explicit user approval (for example, `ship it`) authorizes staging the
  reviewed files, committing, pushing the current feature branch, and opening
  one PR. Do not commit, push, or open a PR without that approval.
- Stage only reviewed paths; never use `git add -A`. Never commit `.env` files,
  secrets, generated noise, or unrelated changes.
- Every PR targets `main` and has exactly one release label:
  `feature`, `ui/ux`, `bug`, `refactor`, `performance`, `documentation`,
  `tests`, or `chore`.
- Check for an existing open PR on the branch before committing or pushing more
  work. Do not update it without explicit user direction.
- Treat `gh auth status` as diagnostic rather than conclusive: it can report a
  stale token from `hosts.yml` even while another credential source is handling
  live GitHub requests. If it reports an authentication failure, do not stop or
  ask the user to reauthenticate yet. Run `gh api user --jq .login`, retry the
  intended read-only repository operation once (for example `gh pr list`,
  `gh pr view`, or `gh repo view`), and retry outside the sandbox when the first
  failure could be network isolation. If the live identity and repository calls
  succeed, continue normally. Ask the user to repair authentication only after
  the live checks still fail with authentication errors; do not start an
  interactive `gh auth refresh` or `gh auth login` without explicit permission.
- Use `scripts/ship.sh` with the reviewed paths after `--`; it runs preflight,
  stages only those paths, applies safety checks, commits, pushes, and opens the
  labeled PR.
- After a PR merges, return this single clone to its resting state: switch to
  `main`, fast-forward it with `git pull --ff-only`, delete the merged local
  feature branch with `git branch -d <branch>`, and run
  `git fetch --prune origin`. Never use `git branch -D` by default; preserve
  any branch that contains active or deliberately retained work.

## Project reference

RSVP to Me is a social event and RSVP platform built with Next.js 16,
TypeScript, Tailwind CSS, Radix Themes, PostgreSQL/Prisma, Redis, magic-link
authentication, Nodemailer, and optional Twilio SMS. It supports personal event
pages, RSVPs, guest comments, host/co-host management, and outbound email/SMS.

Important patterns:

- Hosts use magic links and encrypted `iron-session` cookies; guests use RSVP
  edit tokens.
- Use `assertHost(eventId)` or `assertHostOrCohost(eventId)` for host access.
- Event email call sites must select the event theme and pass it through to
  `resolveEmailTheme()`; that function is the sole web-to-email degradation
  boundary.
- Uploads go through `/api/upload` and are served through
  `/api/uploads/[filename]`; do not bypass its validation or path handling.
