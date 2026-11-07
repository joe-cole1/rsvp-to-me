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
  -> Next.js Proxy (`proxy.ts`) for document requests — request-time security headers
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

| Path              | Responsibility                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `CONTRIBUTING.md` | Contributor setup, issue reporting, validation, and contribution licensing.                                                    |
| `app/`            | Next.js layouts, pages, route handlers, Server Actions, and generated Prisma client output.                                    |
| `proxy.ts`        | Request-time document boundary: generates the CSP nonce and forwards the matching policy into Next.js rendering.               |
| `app/(app)/`      | Shared authenticated application shell for dashboard, profile, help, and admin pages.                                          |
| `app/e/[slug]/`   | Public event, RSVP, guest-list, calendar, CSV, and host-settings routes.                                                       |
| `app/actions/`    | Primary mutation/query boundary for auth, profiles, administration, and event management.                                      |
| `components/`     | Client and shared UI grouped by dashboard, event, RSVP, documentation, and common shell.                                       |
| `lib/`            | Server-side domain services and cross-cutting helpers. Prefer these sources of truth over duplicating logic in routes/actions. |
| `emails/`         | React Email components, templates, registry, rendering, and template types.                                                    |
| `prisma/`         | PostgreSQL schema, migrations, and idempotent development/test seed data.                                                      |
| `tests/`          | Unit, API, action, component, integration, E2E, helper, and regression coverage.                                               |
| `docs/admin/`     | Installation, configuration, operations, email/SMS, upgrading, and local-development documentation.                            |
| `docs/host/`      | Host-facing and guest-experience help content rendered by the application.                                                     |
| `worker/`         | Optional independently deployed Cloudflare Email Worker.                                                                       |
| `public/`         | Static icons, event effects (incl. the pinned `effects/library/` icon art), preview artifacts, and web-manifest assets.        |
| `scripts/`        | Development sync/reset, preflight, shipping, migration, and E2E utilities.                                                     |
| `.github/`        | Community issue/PR templates, CI, releases, and dependency automation.                                                         |
| `perf/`           | Manual performance scenarios and notes.                                                                                        |
| `vendor/`         | Temporary, repository-owned compatibility packages for audited dependencies; each package must name its removal issue.         |

## Entry points and shared boundaries

### Application shell and pages

- `app/layout.tsx` is the root HTML/layout boundary. It resolves the request's UI
  locale and direction and supplies the selected `Ui` catalog to the client.
- The global header is rendered once at the root, including authentication and
  public access screens. Its language selector shares the profile preference
  action; event settings do not define a UI language.
- `messages/locales.json` is the supported-language registry (native names,
  direction, and locally hosted flags); `i18n/config.ts` derives the language
  menu order from it (English first, then native names alphabetically), so file
  order is not significant. `messages/en-US.json` defines catalog keys. `i18n/` owns safe English fallback, request resolution, and explicit-locale
  translators for background work. Only UI messages cross the client boundary.
- `User.preferredLocale` stores an optional account preference. Request resolution
  uses account, then validated browser cookie, then English. Preference writes
  use the authenticated user's identity. Only successful LOGIN verification can
  conditionally adopt an explicit browser choice for an account with no setting.
- `app/layout.tsx` waits for `connection()` so every document that passes
  through `proxy.ts` is rendered per request and can receive that request's
  CSP nonce.
- `proxy.ts` generates a fresh nonce for document requests, overwrites any
  client-supplied nonce or CSP request headers, and forwards one matching CSP
  policy to Next.js and the browser. API and `_next` namespaces use the
  fallback policy from `next.config.ts`.
- `lib/csp.ts` is the shared CSP policy source of truth for the request-time
  nonce policy and the no-nonce fallback. It keeps the existing theme-safe
  inline styles and Cloudflare Turnstile source in both policies.
- Server-rendered route wrappers read the request nonce and pass it through
  `components/ui/CaptchaProvider.tsx` to the Next.js Turnstile `Script`, keeping
  the optional bot-protection script under the same document policy.
- Full-document HTML carries its request nonce. During client navigation, Next's
  trusted loader may load Turnstile using the new response nonce;
  `strict-dynamic` permits this without requiring it to match the initial
  document nonce.
- `app/(app)/layout.tsx` supplies shared navigation and the cached session user
  for authenticated application pages.
- `components/ui/AppNav.tsx` owns the shared top-bar variants and composes the
  signed-in profile or signed-out viewer menu from `components/ui/ProfileDropdown.tsx`.
- `components/ui/` owns the one shared control set, each control reading the
  `ResolvedTheme` it is given (`APP_SHELL_THEME` on app pages, the event's theme on
  event pages, `chromeTheme()` in host-bar chrome): `Button.tsx` (every button
  look, plus `buttonProps()` for links), `Choice.tsx` (chips, tiles, swatches),
  `Field.tsx` (labels, inputs, selects, checkboxes, sliders, secret and color
  inputs), `Toggle.tsx`, `NavItem.tsx` and `Feedback.tsx` (inline alerts, status
  chips, the toast). Their focus and hover states live in the `.rsvp-control`,
  `.rsvp-press` and `.rsvp-field` classes in `app/globals.css`.
  `AppPrimitives.tsx` keeps only the app-shell card, `Dialog.tsx` owns
  accessible modal behavior, and `ConfirmDialog.tsx` (`useConfirm()`) is the one
  confirm step for destructive actions in place of the browser's `confirm()`.
- `app/page.tsx` is the public landing page.
- `app/e/[slug]/page.tsx` is the main public event page.
- `app/(app)/dashboard/page.tsx` is the host dashboard.
- `app/(app)/admin/page.tsx` is the administrator entry point.
- `lib/docs.ts` loads English help articles as the canonical slug/order/audience
  registry and overlays complete articles from `docs/locales/<locale>/<audience>/`.
  Missing articles fall back wholly to English with their actual language and
  direction. `lib/remark-canonical-headings.ts` safely preserves explicit English
  heading IDs in translated Markdown without enabling raw HTML. The Dockerfile
  packages the complete documentation tree.
- Documentation screenshots live in `public/docs/images/`. `components/docs/DocsPanel.tsx`
  maps repository-relative Markdown image paths to local `/docs/images/` URLs so
  GitHub and the in-app guides use the same assets without external image requests.

### Data and caching

- `prisma/schema.prisma` is the data-model source of truth.
- `lib/db.ts` owns the process-wide Prisma singleton. Do not construct ad hoc
  Prisma clients.
- Prisma generates into `app/generated/prisma/`; generated output is not a
  hand-edited source directory.
- `lib/redis.ts` owns Redis connection and primitive cache/lock operations.
- `lib/capacityLock.ts`, `lib/rateLimit.ts`, and `lib/session.ts` build domain
  behavior on those primitives, with documented database fallbacks where used.

- `lib/crypto.ts` owns authenticated v2 configuration-secret reads/writes.
  `lib/config-secret-migration.ts` is the only legacy decryption boundary.
  `scripts/migrate-config-secrets.ts` runs before Docker/native production
  startup and during development sync; it backs up and atomically converts the
  four secret `SystemConfig` settings, then records completion. It also owns
  read-only checking and selective downgrade. See [ADR 0002](docs/engineering/decisions/0002-configuration-secret-migration.md).

### Authentication and access control

1. `app/actions/auth.ts` validates sign-in/registration input and calls
   `lib/auth.ts` to create or verify magic-link tokens.
2. Verification route handlers under `app/auth/` create encrypted session
   cookies through `lib/session.ts`. `INITIAL_ADMIN_EMAIL` bootstrap promotion
   belongs exclusively to successful `LOGIN` magic-token verification in
   `lib/auth.ts` and `app/auth/verify/route.ts`; session reads and non-LOGIN
   verification flows must never promote roles.
3. `lib/session-user.ts` wraps the current-user lookup in `React.cache()` for
   Server Component reuse.
4. Host and administrator mutations must use guards from `lib/auth-guards.ts`.
5. Public event visibility/password/token decisions belong in
   `lib/eventAccess.ts`.
6. Guests edit an RSVP through its edit token; do not substitute host sessions
   or publicly visible RSVP fields for that authority.
7. User-content create/edit mutations call `assertCaptcha()` from `lib/captcha.ts`.
   Turnstile tokens are action-bound, passed directly with the protected mutation,
   and verified server-side. Never route them through shared browser state such as
   a cookie. Only administrators bypass this boundary; authenticated hosts and
   co-hosts remain protected.

### Event and RSVP flow

- Event reads begin in `app/e/[slug]/page.tsx` and render through
  `components/event/EventPage.tsx` plus `components/event/event-page/`.
- Event link metadata is built by `lib/event-social.ts`; `app/e/[slug]/layout.tsx`
  supplies the privacy-safe fallback used by not-found routes, while the
  colocated `opengraph-image.tsx` and `twitter-image.tsx` routes render
  privacy-gated social artwork from current event data.
- Access-granted event routes share their background and animated effects through
  `components/event/EventAtmosphere.tsx`, which composes `ThemeBackground` and
  `ParticleLayer`; event routes resolve persisted effect fields through the
  server-only `lib/effect-catalog.ts#resolveEventEffect` (custom library
  mixtures) and the pure `lib/effects.ts#resolveEffectConfig`. Public event sections use
  `components/event/event-page/EventCard.tsx` as their semantic surface.
- New and existing RSVP flows use `app/e/[slug]/rsvp/page.tsx` and
  `components/rsvp/`; RSVP response labels and controls are centralized in
  `components/rsvp/status.tsx`.
- Guest-facing list/count presentation is resolved by `lib/guestRsvpDisplay.ts`
  for both the event card and the dedicated guest list, with independent names
  and count per row (Going, Maybe, Can't make it, Invited). Host/co-host views
  always resolve to full reply lists and exact counts. `GuestRsvpDisplaySettings`
  is the Display options choice table. These preferences do not change the
  access boundary in `lib/guestList.ts` or RSVP collection; the one data rule they
  add is `lib/guestList.ts#invitedGuestsForViewer`, which decides how much of the
  Invited row (names only, or a count) a guest's payload may carry, and
  `stripHostOnlyEventData` empties it whenever the guest list is not public.
- Event mutations are split by domain under `app/actions/event/`: RSVP,
  check-ins/walk-ins, settings, invitations, co-hosts, polls, potluck, comments,
  blasts, custom questions, and email previews/tests.
- Shared validation belongs in `lib/schemas.ts`; shared authorization belongs
  in `lib/auth-guards.ts` or `lib/eventAccess.ts`.
- Client submissions request fresh Turnstile tokens through
  `components/ui/CaptchaProvider.tsx` and carry each token on that same server
  action or upload request; server actions and upload routes enforce them through
  `lib/captcha.ts`. The provider serializes widget execution while allowing
  already-verified requests for different actions to remain concurrent. Deletes
  and low-risk state toggles are outside this user-content boundary.
- Capacity-sensitive RSVP writes use `lib/capacityLock.ts`.
- `lib/invitation-draft.ts` owns the strict invitation syntax, contact
  normalization, and name validation shared by clients and server actions.
  The host composer works on editable rows: `lib/invitation-draft-rows.ts` owns
  the row reducer, structural undo, duplicate skipping, and per-row validation;
  `lib/invitation-paste.ts` (client-only, lenient) turns pasted lists into rows;
  `lib/invitation-spreadsheet.ts` parses CSV/TSV, suggests name/contact column
  mappings, and imports with the host-confirmed mapping. `HostBar` owns the draft
  so closing the Invite dialog keeps it until the page reloads;
  `components/event/InvitationComposer.tsx` and `components/event/invitations/`
  render the add → review → send steps.
- `lib/invitation-recipients.ts` validates bounded recipient inputs and resolves
  names and prior-invitation status from the current event only. `RSVP.guestName`
  is the event-scoped name authority; host invitation names never update
  `User.name`, and previews do not query account profiles.
- Invitation delivery requires a matching current same-channel RSVP contact.
  Historical `Invitation.rsvpId` links confer no credential authority: missing,
  mismatched, dangling, or cross-event links produce conflicts.
  `app/actions/event/invites.ts` serializes recipient preparation with a
  PostgreSQL transaction advisory lock shared by host and guest sends. Every
  host send (the invitation composer and guest-list Resend) carries a reviewed
  name and status from `previewGuestInvitations`.
  Resolution, reviewed-name/status checks, and record creation happen inside
  that transaction; email/SMS delivery happens after it completes. See
  [ADR 0001](docs/engineering/decisions/0001-invitation-recipient-identity.md).

### Themes, effects, and email

- `lib/notifications/` owns shared outbound notification policy and delivery
  outcomes. `event-update.ts` resolves the existing event audience and RSVP
  contacts; `dispatch.ts` routes through registered channel adapters.
  `transport.ts` bounds provider concurrency and deadlines. Result-bearing
  adapters in `lib/email.ts` and `lib/sms.ts` preserve service-specific rendering
  and stop fallback after accepted or uncertain submissions. Only aggregate
  feedback crosses the host action boundary. `preferences.ts` resolves which
  channels each message type may use (event row, then profile row, then profile
  default) and `deliveryRoutes()`: every proved destination gets its own copy and
  unproved ones share one message. `resolve.ts` treats event RSVP contacts as
  eligible, pauses contacts whose proof was revoked, and reports which
  destinations are proved. `service.ts` handles RSVP confirmations/decisions and organizer alerts
  (organizer eligibility comes from the event's alert switches), and reports
  which channels the site offers. `lib/reminders.ts` consumes channel-neutral
  schedule occurrences before dispatch. `manage.ts` owns account/RSVP-token
  authorization, versioned preference writes, destination challenges and
  connection removal, and builds its read model from the same resolvers producers
  use. `lifecycle.ts` retires proof on sign-in contact changes and purges old
  challenges. Connections never confer event access.
  `app/actions/notifications.ts` exposes minimal, masked management DTOs;
  `app/e/[slug]/notifications/page.tsx` is the private guest management entry
  point and seeds the editor from its authorizing server read.
  `components/notifications/` renders the choice table and contact lists from the
  shared settings `Toggle`/`Section` controls. Manual blasts, invitations and
  authentication retain separate delivery paths.
  See [ADR 0003](docs/engineering/decisions/0003-unified-notifications.md).
- `lib/theme.ts`, `lib/fonts.ts`, and `lib/effects.ts` define web theme options.
  `resolveTheme()` derives every readable text color (card text, `accentText`,
  `status`, hero text and `heroScrim`) from the event's own colors using the
  pure contrast helpers in `lib/theme-contrast.ts`;
  `tests/lib/theme-contrast-sweep.test.ts` enforces the contrast contract.
  [docs/engineering/design-language.md](docs/engineering/design-language.md) is
  the source of truth for how UI uses them: principles, shared components and
  patterns every screen follows.
- Background effects (#825): `lib/effects.ts` is the pure, client-safe model —
  the 19 built-in sets, Amount (density only), Size, Speed, Up/Down/Random
  movement, the reserved `custom` source and shape checks for library ids.
  `lib/effect-particles.ts` builds the particle paths `ParticleLayer` animates.
  The local icon library is fixed application data: artwork under
  `public/effects/library/<collection>/<version>/` and its manifest,
  provenance and four-language CLDR labels/keywords in `lib/effect-catalog-data/`.
  `lib/effect-catalog.ts` (`server-only`) is its only reader: it loads the data
  once per process, checks membership, resolves stored ids to trusted sprite
  paths and runs the search; `lib/effect-catalog-shared.ts` holds the small
  client-safe types. `app/api/effects/search/route.ts` is the host editor's
  authorized, rate-limited, uncached search endpoint. No icon or translation
  service is contacted at runtime. `EventTheme.effectIconIds` and
  `effectMovement` persist a mixture and its movement through `saveEventTheme`;
  the editor is `components/event/settings-page/EffectsPanel.tsx`.
- `app/fonts.ts` builds the theme fonts. Roboto uses the licensed local asset in
  `app/font-files/`; the other families use `next/font/google` at build time.
- `lib/email-theme.ts` is the only web-theme-to-email degradation boundary.
  `resolveEmailTheme()` derives the email's readable colors (`linkColor`,
  `linkColorDark`, hero text and the avatar initial) on email surfaces with the
  same `lib/theme-contrast.ts` helpers; templates only read its fields.
  `tests/lib/email-preset-sweep.test.tsx` enforces the email contrast contract.
- `emails/registry.tsx` defines template metadata/defaults and assembles sample
  previews; `emails/templates/` contains the renderable templates.
- `lib/email-settings.ts` merges saved template overrides.
- `lib/email.ts` selects SMTP, Cloudflare, or development delivery and renders
  through `emails/render.ts`. Notification call sites resolve recipient locales
  explicitly; background work does not depend on request cookies. Default copy
  is localized before existing administrator overrides are applied. Host-written
  content and administrator overrides remain verbatim.
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

| File                           | Intended use                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `Dockerfile`                   | Multi-stage production application image.                                                                               |
| `scripts/docker-entrypoint.sh` | Repairs only the uploads/backups bind mounts, then drops permanently to the application UID before startup.             |
| `docker-compose.yml`           | Full locally built self-hosted stack.                                                                                   |
| `docker-compose.override.yml`  | WSL development override: disables the app service, binds service ports to loopback, and uses disposable named volumes. |
| `docker-compose.release.yml`   | Self-hosting from the published GHCR image.                                                                             |
| `docker-compose.dev.yml`       | Build the current `main` branch directly from GitHub.                                                                   |
| `worker/wrangler.toml`         | Cloudflare Worker deployment configuration.                                                                             |

`.github/workflows/release.yml` publishes GHCR images for owner-published
releases. Both the initial actor and the rerun initiator must be the repository
owner; package-write permission is scoped to that guarded publishing job.
Repository Actions execution policies are configured separately from this YAML.
`scripts/release-image-tags.cjs` validates release names and selects exact-version
tags; only stable releases receive minor-version and `latest` aliases. The
metadata action's implicit `latest` behavior is disabled. Release-note drafts
live in `.github/release-notes/` and do not publish releases by themselves.

Document HTML and React Server Component responses contain request-specific CSP
nonces and must not be cached or replayed by a reverse proxy or CDN. Static
assets under `public/` and `_next/` may keep ordinary long-lived asset caching.
`next.config.ts` is the source of truth for the `private, no-store` response policy
on guest CSV, event calendar ICS, and admin backup download paths, including
denied and missing responses.

`.nvmrc` is the exact local Node selection. `package.json` expresses the
compatible Node/npm range. Repository scripts normalize WSL temporary paths,
load nvm, and select `.nvmrc` so they work from noninteractive Codex shells.

## Test map

| Path/config                                                 | Scope                                                                                                          |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `tests/actions/`, `tests/api/`, `tests/auth/`, `tests/lib/` | Fast Vitest unit and route/action tests.                                                                       |
| `tests/components/`, `vitest.components.config.ts`          | Browser-like component tests.                                                                                  |
| `tests/integration/`, `vitest.integration.config.ts`        | PostgreSQL-backed integration tests.                                                                           |
| `tests/e2e/`, `playwright.config.ts`                        | End-to-end public/auth/host flows.                                                                             |
| `tests/regression/`                                         | Root-cause-specific bug and security regression guards.                                                        |
| `scripts/preflight.sh`                                      | Local CI orchestration with isolated PostgreSQL/Redis.                                                         |
| `scripts/check-playwright-docker.sh`                        | Shared CI/preflight version guard and Chromium smoke test; image pin lives in `scripts/run-e2e-docker.sh`.     |
| `.github/workflows/container-qc.yml`                        | Builds and smoke-tests production images on AMD64 and ARM64 without publishing.                                |
| `scripts/container-smoke.sh`, `scripts/container-smoke.cjs` | Disposable PostgreSQL/Redis startup, permissions, health, seed, backup restore, and native image-codec checks. |

## Common change routing

| Change                   | Start here                                 | Usually also inspect                                              |
| ------------------------ | ------------------------------------------ | ----------------------------------------------------------------- |
| Public event rendering   | `app/e/[slug]/page.tsx`                    | `components/event/`, `lib/eventAccess.ts`, theme helpers          |
| RSVP behavior            | `app/actions/event/rsvp.ts`                | `components/rsvp/`, `lib/schemas.ts`, capacity/access helpers     |
| Guest check-in           | `app/actions/event/checkins.ts`            | guest-list route/component, `CheckIn`, activity/privacy helpers   |
| Host event settings      | `app/actions/event/settings.ts`            | `components/event/settings-page/`, `prisma/schema.prisma`         |
| Background effects       | `lib/effects.ts`, `lib/effect-catalog.ts`  | `ParticleLayer`, `EffectsPanel`, effect search route, design docs |
| Dashboard                | `app/actions/event/dashboard.ts`           | `components/dashboard/`, `app/(app)/dashboard/`                   |
| Authentication/session   | `app/actions/auth.ts`, `app/auth/`         | `lib/auth.ts`, `lib/session.ts`, `lib/session-user.ts`            |
| Authorization            | `lib/auth-guards.ts`, `lib/eventAccess.ts` | relevant action/route and regression tests                        |
| Bot protection           | `lib/captcha.ts`, `lib/captcha-types.ts`   | `components/ui/CaptchaProvider.tsx`, protected action/route calls |
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
