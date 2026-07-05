<!-- BEGIN:git-mcp-rules -->

# Git, Commits, and Pull Requests — Feature Branches & PR Workflow

**NEVER work from or commit directly to the `main` branch.**

You MAY run `git add`, `git commit`, `git push`, and `gh pr create` directly via CLI tools, but you MUST confirm with the user before doing so — describe exactly what you're about to commit/push and wait for explicit approval.

Follow this workflow:

1. At the start of a session, check remote main, sync, and create a new feature branch to work from.
2. When changes are complete and verified, confirm the exact commit message and files with the user before staging and committing.
   - **Skip Lint Check for Non-Substantive Changes:** If the changes do NOT affect application source code (e.g., only modifying `AGENTS.md`, `ROADMAP.md`, or markdown files in `docs/`), append the `--no-verify` flag to the `git commit` command to bypass lint/compile hooks. If there are any functional code modifications, do NOT include this flag.
3. Open Pull Requests from the feature branch to `main` only — never push directly to `main`. Use `gh pr create`.
4. Before committing, verify the local diff matches the intended changes. Run `git fetch` and confirm whether the local branch is in sync with remote.

<!-- END:git-mcp-rules -->

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:session-setup-rules -->

# Handoff and Session Startup Rules

At the start of every new chat session or when resuming work:

1. **Sync with Remote Main**:
   - First, run `git fetch origin` to check for any remote changes.
   - Run `git merge origin/main` (or pull/rebase appropriately) to ensure the local branch contains the absolute latest version of the code. If there are local changes, stash them first (`git stash`), sync, and then apply them back (`git stash pop`).
2. **Create Feature Branch**:
   - Verify we are synced with `main`.
   - Create a new feature branch on GitHub using the GitHub MCP `create_branch` tool.
   - Provide the user with the command to checkout and track the new branch locally.
3. **Go Straight to Plan**:
   - Do NOT rebuild or spin up Docker containers, run build/lint steps, or verify correctness at the start of a chat session. Simply sync with main, create the feature branch, and immediately proceed to research and plan creation.
4. **Approval Gate**:
   - Present the full implementation plan to the user before touching any source code.
   - Do NOT begin editing files until the user gives explicit approval to proceed.
   - If the plan requires clarification or the user requests changes to the approach, revise and re-present before implementing.
   <!-- END:session-setup-rules -->

<!-- BEGIN:post-modification-rules -->

# Post-Modification / Local Verification Rules

After making changes and before presenting Git commands to the user to push to GitHub, the AI agent MUST run the full local verification suite to ensure all changes conform to CI requirements:

1. **Format Check & Linting**:
   - Run Prettier formatting on all modified files: `wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && npx prettier --write <modified_files>'` (or format the whole codebase: `npx prettier --write .`).
   - Run ESLint to check for code quality issues: `wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && npm run lint'`.
   - Run TypeScript typecheck: `wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && npx tsc --noEmit'`.
2. **Database Health**:
   - Ensure the PostgreSQL and Redis containers are running with exposed ports: `docker compose up -d`.
3. **Verify All Tests (Unit, Integration, and E2E)**:
   - Run unit and regression tests: `wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && npm test'`.
   - Run integration tests: `wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && DATABASE_URL="postgresql://postgres:postgres_password_here@127.0.0.1:5432/rsvp_test" REDIS_URL="redis://:redis_password_placeholder@127.0.0.1:6379" npm run test:integration'`.
   - Run local Playwright E2E tests: `wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && npm run test:e2e:local'`.
4. **Exceptions (Non-Substantive Changes)**:
   - If the changes are purely non-substantive (e.g. editing `AGENTS.md`, `ROADMAP.md`, or markdown documentation files under `docs/`), you may skip full test suite/E2E executions and append `--no-verify` to your commit to bypass hooks.
5. **Post-Commit/Post-Push Local Server Restart**:
   - Immediately after any git commit and push operations complete, the AI agent MUST restart the local Next.js development server inside WSL 2 to ensure `http://localhost:3000` is always running and loaded with the absolute latest changes.
   - Use the command: `wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && pm2 restart rsvp-dev || pm2 start npm --name "rsvp-dev" -- run dev'` (run as a background task).
   <!-- END:post-modification-rules -->

<!-- BEGIN:multi-pr-batch-rules -->

# Multi-PR Batch & CI Hygiene Rules

Proven during the 2026-07 security-audit tranches (PRs #218–#221 merged with zero CI failures). Follow these **in addition to** the existing prettier/label/test rules:

1. **Prettier covers EVERY file you touch, not just `.ts`/`.tsx`.** CI runs `npx prettier --check .` over the **whole repository**, so one unformatted `.md` or `.yml` fails the build. Run `npx prettier --write` on every file you create or edit — docs, `ROADMAP.md`, compose files, test files — and re-run `npx prettier --check` on any file after resolving a merge conflict in it (hand-resolved hunks are the most common way to break formatting).
2. **One branch per release label, each cut fresh from `origin/main`.** A PR carries exactly one release label, so work spanning labels (e.g. a `chore` and a `bug`) gets separate branches from the start — never plan to "split later". A small related item may ride along on a branch whose label it shares (e.g. two `chore` hardening items in one PR).
3. **Stack, don't collide.** When two PRs must touch the same large file (e.g. `app/actions/event.ts`), base the second branch on the first, state the merge order explicitly in **both** PR bodies, and after the base PR merges, merge `main` into the stacked branch so its diff collapses to only its own changes.
4. **Re-sync every open branch immediately after any PR merges.** GitHub sends no webhook for merge-conflict transitions — don't wait to find out. Fetch `main`, merge it into each remaining open branch, resolve, prettier-check, push. `ROADMAP.md` and `tests/regression/README.md` are guaranteed collision points (every PR strikes a checklist line and appends an index row); the correct resolution is always **keep both sides' entries**.
5. **Respect conflict resolutions made on GitHub.** If a push is rejected because the remote branch moved, the user may have clicked "Update branch" or resolved the conflict in the web UI. Fetch, inspect their resolution, and adopt it (`git reset --hard origin/<branch>`) rather than force-pushing your own duplicate merge over it.
6. **When a change intentionally alters behavior, update the tests that pin the OLD behavior in the same PR.** Grep the test tree for the touched function names, for mocked query/row shapes (e.g. an authz helper that now selects `coHosts` breaks every fixture that omits it), and for error-message assertions (`Forbidden` vs `Unauthorized`) — fix them alongside the change, never leave them for CI archaeology.
7. **Verify without the local toolchain (remote/cloud sessions).** `npm test` cannot run in remote containers, so before pushing: run `npx tsc --noEmit` and disregard only the environment-noise errors (missing `@types/node` / `react` module stubs) — when unsure whether an error is pre-existing, `git stash` and re-run against the unmodified tree to compare; validate `.yml` edits with a real YAML parser; and sanity-check new test assertions with a standalone `node` script where the logic allows. CI remains the final gate.

<!-- END:multi-pr-batch-rules -->

<!-- BEGIN:pre-modification-rules -->

# Pre-Modification Rules

**CRITICAL RULE:** Always force a `git fetch` and `git pull` (or use GitHub MCP tools as appropriate to sync) to ensure you have the latest remote code _before_ you touch, edit, or modify any files. Do this at the start of a chat session, when resuming work, or anytime the user indicates they made manual changes.

<!-- END:pre-modification-rules -->

<!-- BEGIN:out-of-scope-issues-rules -->

# Out-of-Scope Issues — Log, Never Ignore

**CRITICAL RULE:** If you encounter broken, incorrect, or insecure code, or failing tests that are **outside the scope of the current branch or prompt**, you MUST add them as a task in `ROADMAP.md` before moving on. Never silently pass over them.

- Add bugs and broken code under **🔴 Priority 1 — Bugs & Blockers**.
- Add security issues under **🔴 Priority 1 — Routing & System Safety** (or **⚙️ DevOps & Security** if deferred is more appropriate).
- Add failing tests under **🔴 Priority 1 — Bugs & Blockers** with a note that tests are failing.
- Be specific: include the file path, the nature of the problem, and why it was left out of scope.
- Do NOT fix out-of-scope issues in the current branch — log them and continue. Fixing unrelated things in the same PR creates noise and risk.

<!-- END:out-of-scope-issues-rules -->

---

# RSVP to Me — Developer Reference & Context Guide

A fun, social-first event and RSVP platform for personal events (house parties, wine nights, dinners). Inspired by Partiful's expressive aesthetic. No payments or ticketing — just invites, RSVPs, and connection.

## Development Workflow Rules

- **CRITICAL: PR Check**: ALWAYS check if there is an open PR (Pull Request) for the branch before committing or pushing additional code. You must query open PRs using the GitHub API or MCP tools to ensure you are not creating conflicts or duplicate work. Do not commit code to a branch with an open PR unless explicitly requested.
- **PR Labeling & Organization**: Each PR must be categorized using exactly ONE of the repository's standard release labels (`feature`, `ui/ux`, `bug`, `refactor`, `performance`, `documentation`, `tests`, `chore`). It must be the predominant "reason" for the commit/PR. When in doubt, split the work into separate commits and PRs.
- **PR Creation Commands**: When changes are complete and verified, the agent must always provide the user with a complete, copy-pasteable PowerShell/bash command using the GitHub CLI (`gh pr create`) that automatically populates the PR's `--title`, markdown `--body` (or `--body-file`), and the single appropriate `--label` flag.
- **PR Labeling via MCP (remote/cloud sessions)**: In Claude Code remote sessions where the `gh` CLI is unavailable, use `mcp__github__issue_write` (method: `"update"`, issue_number: PR number) with the `labels` array to apply the label immediately after the PR is created via `mcp__github__create_pull_request`. This is mandatory — every PR must carry exactly one release label regardless of how it was created.
- **Documentation Sync Rule**: The agent WILL update the documentation suite (e.g., installation, configuration, features, email, SMS, admin, and upgrading guides) anytime a procedure, step, feature, environment variable, docker-compose configuration, or anything affected changes, ensuring the documentation always remains fully in sync with the codebase state. The in-app Documentation tab in the Admin Panel renders these guides live from disk, so content edits flow through automatically with no extra step.
- **Mandatory Documentation Updates (pre-PR gate)**: Documentation is part of the change, not a follow-up — it MUST be updated **before** pushing and opening a PR. A PR that changes behavior without the required documentation update is incomplete.
  - **Every feature change, with no exceptions**, requires a corresponding **admin documentation** update under `docs/admin/` (installation, configuration, email, sms, admin, or upgrading — whichever applies). "Feature change" includes any new feature, behavior change, new/changed setting, environment variable, flag, or workflow.
  - Any change that affects **self-hosting/operations, the guest experience, or user-facing UX/UI** ALSO requires a **host documentation** update under `docs/host/` (the guides surfaced at `/help`).
  - Many changes touch both audiences and therefore require updates in **both** `docs/admin/` and `docs/host/`. When in doubt, update both.
  - Pure internal refactors with zero behavior, config, or UX change are the only changes exempt from an admin-doc update; state explicitly in the PR why no docs were needed.
- **In-App Documentation Sync Rule**: Documentation guides live under `docs/<audience>/*.md` — `docs/admin/` for operator/self-hoster guides (rendered in the **Admin Panel → Documentation** tab) and `docs/host/` for host-facing guides (rendered at `/help`, shown to HOST + ADMIN). Each file carries YAML **frontmatter** (`title`, `description`, `category`, `audience`, `order`) which is the single source of truth for the sidebar — `lib/docs.ts` scans the folder and reads the frontmatter, so there is **no central registry to edit**. To add a guide, drop a new `.md` with frontmatter into the correct audience folder; to remove one, delete the file. Keep all guides inside an audience subfolder (never loose in `docs/` root) — `tests/lib/docs.test.ts` enforces this. The Dockerfile already copies the whole `docs/` tree, so new guides ship with no Dockerfile change.
- **Roadmap Sync Rule**: Every commit or PR that implements or addresses an item on [ROADMAP.md](file:///C:/Users/Joe/Documents/antigravity/optimistic-planck/ROADMAP.md) must update it accordingly (e.g., checking it off, removing it from the backlog, and moving it to the completed milestones).

## What it is / isn't

- **Is:** Invite friends, customize a beautiful event page, manage RSVPs, send text blasts and email blasts, see who's coming, let guests comment.
- **Isn't:** Ticketing, payments, seating charts, enterprise features.

## Tech Stack

| Layer             | Choice                                     |
| ----------------- | ------------------------------------------ |
| **Framework**     | Next.js 16 (App Router)                    |
| **Language**      | TypeScript                                 |
| **Styling**       | Tailwind CSS v4 + Radix Themes             |
| **Icons**         | Lucide React                               |
| **Database**      | PostgreSQL 18 via Prisma 7                 |
| **Cache / Locks** | Redis (required)                           |
| **Auth**          | Custom magic-link (iron-session cookies)   |
| **Email**         | nodemailer (SMTP); console fallback in dev |
| **SMS**           | Twilio (optional)                          |
| **File Storage**  | Local filesystem (`data/uploads/`)         |
| **Testing**       | Vitest (141 unit tests)                    |

## Common Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest unit tests (see Docker Testing section below — npm NOT on host)
npx prisma migrate dev --name <name>   # Create + apply migration
npx prisma studio    # Browse database
npx prisma generate  # Regenerate client after schema changes

docker compose up --build                              # Local dev (build from working tree)
docker compose -f docker-compose.dev.yml up --build   # Build from GitHub main branch
```

## WSL 2 Development & Testing Workflow (CRITICAL)

All packages, linters, formatter rules, and tests must be executed natively inside WSL 2 (in the `~/projects/rsvp-to-me` directory) rather than inside Docker containers, to optimize file access performance and resolve hot-reloading issues.

**Step 1 — Start the local database containers**

Ensure the PostgreSQL and Redis containers are running and exposing their ports to the host (`5432` and `6379`). In the WSL project folder, run:

```bash
docker compose up -d
```

**Step 2 — Create the test database if needed**

If the `rsvp_test` database does not exist in the PostgreSQL container, create it:

```bash
docker exec rsvp-to-me-postgres-1 psql -U postgres -c "CREATE DATABASE rsvp_test;"
```

**Step 3 — Run the test suites natively in WSL**

- **Unit and Regression tests:**
  ```bash
  wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && npm test'
  ```
- **Integration tests:**
  ```bash
  wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && DATABASE_URL="postgresql://postgres:postgres_password_here@127.0.0.1:5432/rsvp_test" REDIS_URL="redis://:redis_password_placeholder@127.0.0.1:6379" npm run test:integration'
  ```
- **E2E Tests (Playwright):**
  Ensure browsers are installed natively: `npx playwright install --with-deps`. Then start the app server via `npm run dev` and run:
  ```bash
  wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && npm run test:e2e:local'
  ```
  Or run with UI mode:
  ```bash
  wsl bash -c 'export NVM_DIR=$HOME/.nvm && . $NVM_DIR/nvm.sh && cd ~/projects/rsvp-to-me && npm run test:e2e:local:ui'
  ```

## Important: Next.js 16 + Prisma 7 Patterns

### Params are Promises in Next.js 16

```tsx
export default async function Page(props: PageProps<"/e/[slug]">) {
  const { slug } = await props.params;
}
```

### Prisma Client Import Path

Always import generated models from the generated location rather than `@prisma/client`:

```ts
import { PrismaClient } from "@/app/generated/prisma";
```

### Prisma Client Singleton

Always use the singleton instance in `lib/db.ts`:

```ts
import { db } from "@/lib/db";
```

## Directory Structure

```
app/
  (auth)/           # Magic link sign-in pages (hosts only)
  (public)/         # Public-facing pages (no auth required)
    e/[slug]/       # Event page — guests RSVP here
      rsvp/         # Guest RSVP edit page (?token=<editToken>)
  dashboard/        # Host dashboard (protected)
  actions/          # Server actions (auth.ts, createEvent.ts, event/ feature modules + index.ts barrel)
  api/
    upload/         # POST — accepts image, saves to data/uploads/, returns url
    uploads/[filename]/ # GET — serves uploaded images from data/uploads/
  auth/verify/      # GET Route Handler — validates magic token, sets session cookie
  generated/prisma/ # DO NOT EDIT — Prisma auto-generated client
components/
  event/            # Event page, cover, theme picker, host bar
  rsvp/             # RsvpEditForm — guest RSVP edit form
  ui/               # Shared primitives
lib/
  db.ts             # Prisma singleton
  session.ts        # iron-session helpers (sealSession, getSession, COOKIE_NAME, SESSION_TTL)
  auth.ts           # Magic link generation + verification
  email.ts          # nodemailer send helpers; console fallback when SMTP_HOST unset
  sms.ts            # Twilio helpers; console fallback when TWILIO_* unset
  slug.ts           # Slug generation from event title
  theme.ts          # resolveTheme() — maps base theme + accent to full ResolvedTheme
tests/
  auth/             # verify route handler tests
  api/              # upload + file-serve route tests
  lib/              # email + sms unit tests
  setup.ts          # global env setup for tests
prisma/
  schema.prisma          # Source of truth for PostgreSQL schema
  postgres-migrations/   # Auto-managed by Prisma (single squashed init migration)
.github/
  workflows/
    ci.yml          # Lint + test + build on every PR and push to main
```

## Key Code Patterns

### DB Access

Always import from `@/lib/db`, never instantiate PrismaClient directly.

### Authentication & Sessions

- Hosts sign in via magic link sent to their email.
- Session is stored as an encrypted cookie via `iron-session`.
- `getSession()` in `lib/session.ts` returns `{ userId, email }` or null.
- Magic link verify is a **Route Handler** at `app/auth/verify/route.ts` — sets cookie directly on `NextResponse.redirect()` using `response.cookies.set()`; never use `cookies().set()` in a Server Component.
- Guests don't log in — they get a unique `editToken` per RSVP for updates.
- RSVP edit URL: `/e/[slug]/rsvp?token=<editToken>` — served by `app/e/[slug]/rsvp/page.tsx`.

### Host Access Control

- Hosts must have a valid invite code to register (gated for now; see Open Registration note below).
- Invite codes live in `HostInviteCode` table.
- Seed script (`prisma/seed.ts`) upserts `HOST_INVITE_CODE` on container startup.
- `User.role` defaults to `GUEST`. Users created during RSVP are created as `GUEST`s.
- Registration (`registerHost`) upgrades `GUEST`s to `HOST`s if they register with an existing RSVP email and provide a valid invite code (or if open registration is active).
- `assertHost(eventId)` — checks session + event.hostId.
- `assertHostOrCohost(eventId)` — checks session + event.hostId OR EventCoHost row.

### Open Registration

Controlled by `OPEN_REGISTRATION` env var (default `"false"`). Set to `"true"` in docker-compose to allow anyone to register — invite code field is hidden on the register page and `registerHost` in `lib/auth.ts` skips the code check.

- Guest RSVPs are linked to `User` accounts via `RSVP.userId`. When a guest RSVPs, a `User` account is automatically created with the `GUEST` role.

### Event Page UX

- Public event page at `/e/[slug]` — no auth required.
- When a host is authenticated and views their own event, they see inline edit controls overlaid on the same page (WYSIWYG, Partiful-style).
- `?preview=1` query param lets hosts see the guest view without losing host session.
- Edit controls appear as floating overlays / hover states on each editable section.

### File Uploads

Local filesystem storage — no external service needed.

- `POST /api/upload` — validates session + image type + 8MB limit, saves to `data/uploads/<uuid>.ext`, returns `{ url: "/api/uploads/<filename>" }`.
- Images are compressed client-side (Canvas API, max 1600×900, JPEG 0.85) before upload to prevent server hangs.
- `GET /api/uploads/[filename]` — serves the file; uses `path.basename()` to prevent path traversal.
- `data/` is a Docker volume mount — persists across container restarts.

### Email & SMS Blasts

- **Email:** `lib/email.ts` uses nodemailer. When `SMTP_HOST` is set, sends via SMTP. When unset, logs the payload to console (dev mode). No external API key required.
- **SMS:** `lib/sms.ts` uses Twilio. When `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` are set, sends real SMS. When unset, logs to console. `sendSmsBlast` uses `Promise.allSettled` so partial failures don't throw.

### Themed Emails (React Email) — Degradation Contract

- Email templates live in `emails/` as [React Email](https://react.email/) components, rendered to table-based HTML by `lib/email.ts`. A registry (`emails/registry.tsx`) is the single source of truth for template ids, default copy, placeholders, toggles, and sample data — it drives `lib/email.ts`, the admin editor, host/admin previews, and tests. `next.config.ts` lists the react-email packages in `serverExternalPackages` (required so `render()` works in App Router server actions and the reminder cron).
- **Event emails are themed at send time.** Each event-email call site loads the event's `theme` (EventTheme) and passes it through; `resolveEmailTheme()` in `lib/email-theme.ts` **derives** the email palette from `resolveTheme()`. Never build a parallel email palette. If you add an email call site for an event, `select`/`include` the `theme` and pass it — otherwise host theme changes and presets won't reach that email.
- **Degradation contract:** `resolveEmailTheme()` is the single place web-theme capabilities are mapped to email-safe values. Any new `ResolvedTheme` capability MUST declare its email equivalent there or explicitly degrade (background image → bulletproof hero bg with solid fallback; animation → static; rgba/hsla → solid hex; undeclared → ignored). Email rendering must never break because a web-only token was added. The preset-sweep test (`tests/lib/email-preset-sweep.test.tsx`) enforces this across all presets and asserts each email stays under Gmail's 102KB clip.
- **Admin-editable copy** lives in `SystemConfig` rows keyed `email_template_<id>` (JSON overrides only; reset = delete row), validated in `lib/email-settings.ts`. Editable copy is always rendered as React text nodes, never raw HTML.

## Environment Variables

```bash
# Required
DATABASE_URL="postgresql://postgres:password@localhost:5432/rsvp_db"
REDIS_URL="redis://:password@localhost:6379"
SESSION_SECRET=""             # 32+ random chars for iron-session encryption
OPEN_REGISTRATION="false"     # set "true" to allow anyone to register (no invite code)
HOST_INVITE_CODE=""           # Default invite code for host registration (only used when OPEN_REGISTRATION=false)
EMAIL_FROM=""                 # e.g. "RSVP to Me <noreply@yourdomain.com>"
NEXT_PUBLIC_APP_URL=""        # e.g. https://rsvp.yourdomain.com (no trailing slash)

# Email — SMTP (leave blank to log to console instead)
SMTP_HOST=""                  # e.g. smtp.gmail.com
SMTP_PORT="587"               # 587 = STARTTLS, 465 = SSL
SMTP_SECURE="false"           # set "true" for port 465
SMTP_USER=""
SMTP_PASS=""

# Optional — SMS (Twilio)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""
```

## Future Work Roadmap

- **User Dashboard Enhancement:** App dashboard features at-a-glance host and co-host event listings.
- **Check-in Flow:** Adding QR check-in scanning or check-in verification triggers on guest lists.
- **Guest List Exporters:** CSV extraction enhancements.

---

<!-- BEGIN:best-practices-rules -->

# Best Coding Practices

**ALWAYS search for and use best coding practices whenever doing something new.**

Before implementing any non-trivial feature, architectural pattern, or integration, search for the current best practices (via web search or official docs). Do not assume training data reflects the latest conventions — Next.js, Prisma, React, and related tools evolve quickly and have breaking changes between major versions.

**Reuse before reinventing — match the existing codebase.** Every implementation must follow best coding practices AND stay consistent with how the rest of the codebase already solves similar problems. Before writing new code, look at how analogous situations are handled elsewhere (e.g. rate limiting via `lib/rateLimit.ts` + `lib/clientIp.ts`, DB access via the `lib/db.ts` singleton, auth guards like `assertHost`/`assertHostOrCohost`, Redis via `lib/redis.ts`) and use the same helpers, patterns, and conventions wherever applicable. Do not re-implement functionality that already exists or invent a parallel pattern when an established one is available — extend or reuse the shared utility instead of remaking the wheel each time.

Specific rules:

- **Shared layouts over per-page nav**: Use Next.js App Router route group `layout.tsx` to share common UI (navigation, shells) across pages — never duplicate nav boilerplate per-page.
- **React `cache()` for server-side deduplication**: Wrap shared data-fetching helpers in `React.cache()` so multiple Server Components in the same request share one DB query.
- **`const` arrow functions are not hoisted**: Arrow functions declared with `const` must be defined before they are called. Use function declarations if hoisting is needed.
- **TypeScript strictness**: Keep `strict: true` in `tsconfig.json`. Never use `any` unless there is no viable alternative.
- **Prettier for formatting** _(planned — see ROADMAP.md)_: Run Prettier as a CI check once the codebase has been formatted. Do not add ad-hoc style fixes in individual PRs.

<!-- END:best-practices-rules -->

<!-- BEGIN:tone-rules -->

# Tone and Collaboration Style

- **Be technical, structured, and concise.** Avoid conversational filler, preamble, or restating what was just done.
- **Let the user drive decisions.** Present options and trade-offs clearly; do not make architectural choices unilaterally.
- **Flag unexpected discoveries immediately.** If something in the codebase contradicts the plan or introduces risk, stop and surface it before continuing.
- **Never guess at Next.js 16 or Prisma 7 patterns.** If uncertain, read `node_modules/next/dist/docs/` or `schema.prisma` before writing code.

<!-- END:tone-rules -->

<!-- BEGIN:chat-tagging-rules -->

# Conversation Hash Tagging and Code Linkage

Every chat session is associated with a unique conversation hash (the first 6 characters of the UUID Conversation ID, e.g., `db8e2d`):

1. **Identify Hash**: Extract the first 6 characters of the current Conversation ID (e.g., `db8e2d`).
2. **Chat Rename (Claude Code)**: When working in Claude Code (Claude's CLI/desktop agent), do NOT suggest renaming the chat — the user will manually rename the session to the branch name once the branch has been created. For all other Claude interfaces, suggest renaming the chat to `[hash] <Short Topic>` (e.g., `[db8e2d] RSVP Security Review`) once the topic is clear.
3. **Branch Names**: All feature branch names must start with the hash (e.g., `feature/db8e2d-security-review`).
4. **Commit Messages**: All commit messages must begin with the hash prefix (e.g., `[db8e2d] feat: add rate limiter`).
5. **PR Titles**: The `gh pr create` command must prefix the PR title with `[hash]` (e.g., `[db8e2d] Security & Best Practices Review`).
6. **Git Command Formatting**: Always break git and gh commands into individual fenced code blocks — one command per block — so the user can copy and execute them one at a time. Never bundle multiple commands into a single block.

<!-- END:chat-tagging-rules -->

<!-- BEGIN:regression-test-rules -->

# Regression Test Convention

For every bug fix, add a test to `tests/regression/` that would have caught it:

1. Create a test file named descriptively: `tests/regression/<short-description>.test.ts`
2. The test must **fail** before the fix is applied and **pass** after
3. Add a comment at the top explaining the bug, when it was found, and the root cause
4. Update the index table in `tests/regression/README.md`
5. Tests use the same Vitest unit setup as `tests/lib/` and `tests/actions/` — mock Prisma as needed

<!-- END:regression-test-rules -->

<!-- BEGIN:workflow-pointer -->

# Full Workflow Runbook

The complete end-to-end agent workflow (session start → sync → branch → plan → implement → local CI → commit → PR → CI check) lives in **`WORKFLOW.md`** at the repo root, automated by `scripts/dev-sync.sh`, `scripts/preflight.sh`, and `scripts/ship.sh`.

<!-- END:workflow-pointer -->
