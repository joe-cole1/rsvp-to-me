# RSVP to Me — Architecture Map

This document is the durable map of the repository. Use it to identify the
smallest relevant part of the codebase before searching broadly. It describes
stable boundaries and source-of-truth files rather than cataloging every file.

Update this map when a change moves an entry point, introduces a subsystem,
changes storage or authentication boundaries, or adds/removes a deployment
mode. Product and operator instructions belong in `docs/`; agent rules belong
in `AGENTS.md`; implementation procedures belong in `WORKFLOW.md`.

## Runtime topology

```text
Browser
  -> Next.js 16 App Router (`app/`)
     -> Server Components and route handlers
     -> Server Actions (`app/actions/`)
        -> Prisma singleton (`lib/db.ts`) -> PostgreSQL 18
        -> Redis helpers (`lib/redis.ts`) -> Redis
        -> Email/SMS adapters (`lib/email.ts`, `lib/sms.ts`)
     -> Local uploads/backups (`data/` at runtime)

Optional Cloudflare Email Worker (`worker/`)
  <- outbound email requests from the app
  -> Cloudflare Email Routing / inbound forwarding
```

The development topology is different from the default deployment topology:
Next.js runs natively in WSL, while Docker Desktop runs only PostgreSQL and
Redis. See `docs/admin/local-development.md` and `WORKFLOW.md`.

## Repository map

| Path            | Responsibility                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `app/`          | Next.js layouts, pages, route handlers, Server Actions, and generated Prisma client output.                                    |
| `app/(app)/`    | Shared authenticated application shell for dashboard, profile, help, and admin pages.                                          |
| `app/e/[slug]/` | Public event, RSVP, guest-list, calendar, CSV, and host-settings routes.                                                       |
| `app/actions/`  | Primary mutation/query boundary for auth, profiles, administration, and event management.                                      |
| `components/`   | Client and shared UI grouped by dashboard, event, RSVP, documentation, and common shell.                                       |
| `lib/`          | Server-side domain services and cross-cutting helpers. Prefer these sources of truth over duplicating logic in routes/actions. |
| `emails/`       | React Email components, templates, registry, rendering, and template types.                                                    |
| `prisma/`       | PostgreSQL schema, migrations, and idempotent development/test seed data.                                                      |
| `tests/`        | Unit, API, action, component, integration, E2E, helper, and regression coverage.                                               |
| `docs/admin/`   | Installation, configuration, operations, email/SMS, upgrading, and local-development documentation.                            |
| `docs/host/`    | Host-facing and guest-experience help content rendered by the application.                                                     |
| `worker/`       | Optional independently deployed Cloudflare Email Worker.                                                                       |
| `public/`       | Static icons, event effects, preview artifacts, and web-manifest assets.                                                       |
| `scripts/`      | Development sync/reset, preflight, shipping, migration, and E2E utilities.                                                     |
| `.github/`      | CI, releases, and dependency automation.                                                                                       |
| `perf/`         | Manual performance scenarios and notes.                                                                                        |

## Entry points and shared boundaries

### Application shell and pages

- `app/layout.tsx` is the root HTML/layout boundary.
- `app/(app)/layout.tsx` supplies shared navigation and the cached session user
  for authenticated application pages.
- `app/page.tsx` is the public landing page.
- `app/e/[slug]/page.tsx` is the main public event page.
- `app/(app)/dashboard/page.tsx` is the host dashboard.
- `app/(app)/admin/page.tsx` is the administrator entry point.

### Data and caching

- `prisma/schema.prisma` is the data-model source of truth.
- `lib/db.ts` owns the process-wide Prisma singleton. Do not construct ad hoc
  Prisma clients.
- Prisma generates into `app/generated/prisma/`; generated output is not a
  hand-edited source directory.
- `lib/redis.ts` owns Redis connection and primitive cache/lock operations.
- `lib/capacityLock.ts`, `lib/rateLimit.ts`, and `lib/session.ts` build domain
  behavior on those primitives, with documented database fallbacks where used.

### Authentication and access control

1. `app/actions/auth.ts` validates sign-in/registration input and calls
   `lib/auth.ts` to create or verify magic-link tokens.
2. Verification route handlers under `app/auth/` create encrypted session
   cookies through `lib/session.ts`.
3. `lib/session-user.ts` wraps the current-user lookup in `React.cache()` for
   Server Component reuse.
4. Host and administrator mutations must use guards from `lib/auth-guards.ts`.
5. Public event visibility/password/token decisions belong in
   `lib/eventAccess.ts`.
6. Guests edit an RSVP through its edit token; do not substitute host sessions
   or publicly visible RSVP fields for that authority.

### Event and RSVP flow

- Event reads begin in `app/e/[slug]/page.tsx` and render through
  `components/event/EventPage.tsx` plus `components/event/event-page/`.
- New and existing RSVP flows use `app/e/[slug]/rsvp/page.tsx` and
  `components/rsvp/`.
- Event mutations are split by domain under `app/actions/event/`: RSVP,
  check-ins/walk-ins, settings, invitations, co-hosts, polls, potluck, comments,
  blasts, custom questions, and email previews/tests.
- Shared validation belongs in `lib/schemas.ts`; shared authorization belongs
  in `lib/auth-guards.ts` or `lib/eventAccess.ts`.
- Capacity-sensitive RSVP writes use `lib/capacityLock.ts`.

### Themes, effects, and email

- `lib/theme.ts`, `lib/fonts.ts`, and `lib/effects.ts` define web theme options.
- `lib/email-theme.ts` is the only web-theme-to-email degradation boundary.
- `emails/registry.tsx` defines template metadata/defaults and assembles sample
  previews; `emails/templates/` contains the renderable templates.
- `lib/email-settings.ts` merges saved template overrides.
- `lib/email.ts` selects SMTP, Cloudflare, or development delivery and renders
  through `emails/render.ts`.
- `lib/sms.ts` owns Twilio delivery. The webhook boundary is
  `app/api/webhooks/twilio/route.ts`.
- `worker/worker.ts` is a separately deployed optional Cloudflare worker; keep
  its documented admin template/call sites synchronized when its contract
  changes.

### Files and background work

- Uploads enter through `app/api/upload/route.ts` and are served only through
  `app/api/uploads/[filename]/route.ts`.
- `lib/backup.ts` and `app/api/admin/backups/[filename]/route.ts` own database
  backup creation/listing/download behavior.
- `instrumentation.ts` starts the in-process scheduler only in the Node runtime.
- `lib/cron-scheduler.ts` coordinates reminders, account deletion, rate-limit
  cleanup, and scheduled backups with Redis or database locks.
- `data/uploads/` and `data/backups/` are runtime data, not source files.

## Data-model groups

The Prisma schema is organized around:

- identity and access: `User`, `MagicToken`, `Session`, `HostInviteCode`;
- events and presentation: `Event`, `EventCoHost`, `EventTheme`, `ThemePreset`,
  `EventInfoSection`, `EventReminderSettings`;
- attendance: `RSVP`, `PlusOneGuest`, `RSVPField`, `RSVPAnswer`, `Invitation`;
- collaboration: `EventUpdate`, `Comment`, `PotluckItem`, `PotluckClaim`,
  `Poll`, `PollOption`, `PollVote`;
- operations: `SystemConfig`, `SentReminder`, `CheckIn`, `ActivityEvent`,
  `RateLimit`, `CronLock`, `CoHostInvitation`.

Inspect `prisma/schema.prisma` before changing persistence or relations. A
schema change normally requires a migration, updated tests, documentation, and
the full preflight.

## Deployment and development files

| File                          | Intended use                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                  | Multi-stage production application image.                                                                               |
| `docker-compose.yml`          | Full locally built self-hosted stack.                                                                                   |
| `docker-compose.override.yml` | WSL development override: disables the app service, binds service ports to loopback, and uses disposable named volumes. |
| `docker-compose.release.yml`  | Self-hosting from the published GHCR image.                                                                             |
| `docker-compose.dev.yml`      | Build the current `main` branch directly from GitHub.                                                                   |
| `worker/wrangler.toml`        | Cloudflare Worker deployment configuration.                                                                             |

`.nvmrc` is the exact local Node selection. `package.json` expresses the
compatible Node/npm range. Repository scripts normalize WSL temporary paths,
load nvm, and select `.nvmrc` so they work from noninteractive Codex shells.

## Test map

| Path/config                                                 | Scope                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------- |
| `tests/actions/`, `tests/api/`, `tests/auth/`, `tests/lib/` | Fast Vitest unit and route/action tests.                |
| `tests/components/`, `vitest.components.config.ts`          | Browser-like component tests.                           |
| `tests/integration/`, `vitest.integration.config.ts`        | PostgreSQL-backed integration tests.                    |
| `tests/e2e/`, `playwright.config.ts`                        | End-to-end public/auth/host flows.                      |
| `tests/regression/`                                         | Root-cause-specific bug and security regression guards. |
| `scripts/preflight.sh`                                      | Local CI orchestration with isolated PostgreSQL/Redis.  |

## Common change routing

| Change                   | Start here                                 | Usually also inspect                                              |
| ------------------------ | ------------------------------------------ | ----------------------------------------------------------------- |
| Public event rendering   | `app/e/[slug]/page.tsx`                    | `components/event/`, `lib/eventAccess.ts`, theme helpers          |
| RSVP behavior            | `app/actions/event/rsvp.ts`                | `components/rsvp/`, `lib/schemas.ts`, capacity/access helpers     |
| Guest check-in           | `app/actions/event/checkins.ts`            | guest-list route/component, `CheckIn`, activity/privacy helpers   |
| Host event settings      | `app/actions/event/settings.ts`            | `components/event/settings-page/`, `prisma/schema.prisma`         |
| Dashboard                | `app/actions/event/dashboard.ts`           | `components/dashboard/`, `app/(app)/dashboard/`                   |
| Authentication/session   | `app/actions/auth.ts`, `app/auth/`         | `lib/auth.ts`, `lib/session.ts`, `lib/session-user.ts`            |
| Authorization            | `lib/auth-guards.ts`, `lib/eventAccess.ts` | relevant action/route and regression tests                        |
| Email templates/delivery | `emails/`, `lib/email.ts`                  | `lib/email-theme.ts`, `lib/email-settings.ts`, admin/host docs    |
| SMS/Twilio               | `lib/sms.ts`                               | Twilio webhook, admin actions, SMS docs                           |
| Admin panel              | `app/(app)/admin/`                         | `app/actions/admin.ts`, config/backup/email services              |
| Data model               | `prisma/schema.prisma`                     | migrations, seed, generated imports, full preflight               |
| Uploads/backups          | upload/backup route handlers               | `lib/backup.ts`, path-validation tests, operations docs           |
| Background jobs          | `lib/cron-scheduler.ts`                    | reminders, backups, account deletion, Redis/DB locks              |
| Local workflow/CI        | `scripts/`, `WORKFLOW.md`                  | Compose files, `.github/workflows/`, admin local-development docs |

## Maintenance rules

- Keep this map concise and boundary-oriented. Do not add a line for every
  component, test, migration, or asset.
- Prefer repository search within the mapped subsystem before a whole-tree
  search.
- Update this file in the same PR when an architectural boundary or entry point
  changes.
- Record lasting architectural decisions as short ADRs under
  `docs/engineering/decisions/` when the reasoning would otherwise be lost.
- Treat unreferenced files as review candidates, not automatically safe
  deletions; direct public URLs, deployment downloads, and external automation
  may not appear in static imports.
