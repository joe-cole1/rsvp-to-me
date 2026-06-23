<!-- BEGIN:git-mcp-rules -->
# Git, Commits, and Pull Requests — Feature Branches & PR Workflow

**Do not attempt to commit, push, or open pull requests to GitHub directly (neither via CLI nor via MCP tools).**
**NEVER work from or commit directly to the `main` branch.**

Instead, follow this workflow:
1. At the start of a session, check remote main, sync, and create a new feature branch via the GitHub MCP tool to work from.
2. When changes are complete, verified, and ready, show the exact PowerShell git commands for the USER to run on their system (e.g., `git add`, `git commit -m "..."`, and `git push origin <branch>`) to push to the feature branch.
   - **Skip Lint Check for Non-Substantive Changes:** If the changes do NOT affect application source code (e.g., only modifying `AGENTS.md`, `ROADMAP.md`, or markdown files in `docs/`), explicitly append the `--no-verify` flag to the suggested `git commit` command to bypass lint/compile hooks. If there are any functional code modifications, do NOT include this flag.
3. Instruct the user to open a Pull Request (PR) from their feature branch to `main` (never commit or push directly to `main`, use `gh pr create` or the GitHub web UI).
4. Verify that the local diff matches the changes we want to push before handing off. Also, run `git fetch` and verify whether the local branch is in sync with remote main/feature branches and if any PR is open or already merged before recommending any commit/push commands to the user.
5. Only use GitHub MCP tools for branch creation at startup and read-only operations (like checking PRs/commits) unless requested.

**Rationale:** This saves token overhead, avoids sandbox credential/TTY hang issues, prevents direct writes to production code on main, and ensures the user maintains complete control over commits.
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
<!-- END:session-setup-rules -->

<!-- BEGIN:post-modification-rules -->
# Post-Modification / Local Verification Rules

After making changes and before presenting Git commands to the user to push to GitHub:
1. **Verify Linter and TypeScript Correctness**:
   - Note: Do NOT run `npm run lint` or ESLint commands inside Antigravity's terminal environment. The linter will run automatically on the user's command line via their Git `pre-commit` hook during the commit process.
   - Verify that the local Git `pre-commit` hook is configured in `.git/hooks/pre-commit` to catch styling issues before committing.
2. **Wipe and Rebuild Local Docker Environment**:
   - Run `docker compose down` to shut down and clean up active containers and networks.
   - Run `docker compose up --build -d` to compile the application with the new changes and launch the containers from scratch, ensuring no cached database state, assets, or CSS remain.
3. **Verify Correctness**:
   - Ensure the application builds successfully, and tests pass.
<!-- END:post-modification-rules -->

<!-- BEGIN:pre-modification-rules -->
# Pre-Modification Rules

**CRITICAL RULE:** Always force a `git fetch` and `git pull` (or use GitHub MCP tools as appropriate to sync) to ensure you have the latest remote code *before* you touch, edit, or modify any files. Do this at the start of a chat session, when resuming work, or anytime the user indicates they made manual changes.
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
- **Documentation Sync Rule**: The agent WILL update the documentation suite (e.g., installation, configuration, features, email, SMS, admin, and upgrading guides) anytime a procedure, step, feature, environment variable, docker-compose configuration, or anything affected changes, ensuring the documentation always remains fully in sync with the codebase state.
- **Roadmap Sync Rule**: Every commit or PR that implements or addresses an item on [ROADMAP.md](file:///C:/Users/Joe/Documents/antigravity/optimistic-planck/ROADMAP.md) must update it accordingly (e.g., checking it off, removing it from the backlog, and moving it to the completed milestones).

## What it is / isn't
- **Is:** Invite friends, customize a beautiful event page, manage RSVPs, send text blasts and email blasts, see who's coming, let guests comment.
- **Isn't:** Ticketing, payments, seating charts, enterprise features.

## Tech Stack
| Layer | Choice |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 + Radix Themes |
| **Icons** | Lucide React |
| **Database** | PostgreSQL 18 via Prisma 7 |
| **Cache / Locks** | Redis (required) |
| **Auth** | Custom magic-link (iron-session cookies) |
| **Email** | nodemailer (SMTP); console fallback in dev |
| **SMS** | Twilio (optional) |
| **File Storage** | Local filesystem (`data/uploads/`) |
| **Testing** | Vitest (141 unit tests) |

## Common Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest unit tests
npx prisma migrate dev --name <name>   # Create + apply migration
npx prisma studio    # Browse database
npx prisma generate  # Regenerate client after schema changes

docker compose up --build                              # Local dev (build from working tree)
docker compose -f docker-compose.dev.yml up --build   # Build from GitHub main branch
```

## Important: Next.js 16 + Prisma 7 Patterns

### Params are Promises in Next.js 16
```tsx
export default async function Page(props: PageProps<'/e/[slug]'>) {
  const { slug } = await props.params
}
```

### Prisma Client Import Path
Always import generated models from the generated location rather than `@prisma/client`:
```ts
import { PrismaClient } from '@/app/generated/prisma'
```

### Prisma Client Singleton
Always use the singleton instance in `lib/db.ts`:
```ts
import { db } from '@/lib/db'
```

## Directory Structure
```
app/
  (auth)/           # Magic link sign-in pages (hosts only)
  (public)/         # Public-facing pages (no auth required)
    e/[slug]/       # Event page — guests RSVP here
      rsvp/         # Guest RSVP edit page (?token=<editToken>)
  dashboard/        # Host dashboard (protected)
  actions/          # Server actions (auth.ts, event.ts, createEvent.ts)
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

<!-- BEGIN:chat-tagging-rules -->
# Conversation Hash Tagging and Code Linkage

Every chat session is associated with a unique conversation hash (the first 6 characters of the UUID Conversation ID, e.g., `db8e2d`):
1. **Identify Hash**: The agent must extract the first 6 characters of the current `Conversation ID` (e.g., `db8e2d`).
2. **Suggest Chat Rename**: At the start of the chat, the agent will suggest renaming the chat title to start with `[hash]` (e.g., `[db8e2d] RSVP Security Review`).
3. **Branch Names**: All suggested feature branch names must start with the hash (e.g., `feature/db8e2d-security-review`).
4. **Commit Messages**: All suggested commit messages must begin with the hash prefix (e.g., `[db8e2d] feat: add rate limiter`).
5. **PR Titles**: The suggested `gh pr create` command must prefix the PR title with `[hash]` (e.g., `[db8e2d] Security & Best Practices Review`).
<!-- END:chat-tagging-rules -->
