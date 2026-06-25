# RSVP to Me — Product Roadmap

This document outlines the short-term backlog, long-term ideas, and historical milestones of the **RSVP to Me** platform. It serves as our long-term reference for future features, unresolved issues, and product ideas.

---

## 🔴 Priority 1: High Priority (Bugs, UX Blockers & Core Fixes)
*Immediate attention items. High impact bugs, UX papercuts, and essential routing/data integrity fixes.*

### 🛠️ Bugs & Blockers
*   ~~**[CRIT-1] `migrate-db.js` crashes container on any migration failure — `scripts/migrate-db.js`**: `process.exit(1)` was called on any `prisma migrate deploy` error, causing indefinite Docker restart loops on transient failures or P3009 stuck migrations.~~ ✅ Fixed [e170ee] — 3-attempt retry with backoff; P3009 detected and logs actionable `prisma migrate resolve` command; `docker-compose.yml` app service changed to `restart: on-failure:3`.
*   ~~**[CRIT-2] No pre-migration database snapshot — `scripts/migrate-db.js`**: `prisma migrate deploy` ran with no prior backup, leaving no automated recovery path from a destructive migration.~~ ✅ Fixed [e170ee] — `pg_dump` via `execFileSync` (no shell, SEC-6 pattern) to `data/backups/pre-migration/` with timestamp before every migration run. Failure warns but never blocks the deploy.
*   ~~**[CRIT-3] Health endpoint does not verify migration state — `app/api/health/route.ts`**: `/api/health` returned 200 regardless of migration state, appearing healthy to load balancers while the schema was broken.~~ ✅ Fixed [e170ee] — queries `_prisma_migrations` for pending/stuck rows; returns 503 + `{ status: "degraded", migrations: "pending" }` if any found; 7 new tests added to `tests/api/health.test.ts`.
*   ~~**Failing Test Suite**: Unit tests in `tests/actions/event.test.ts` (potluck item claims) and `tests/actions/rsvpfields.test.ts` (`reorderRsvpFields`) were failing.~~ ✅ Confirmed resolved — both test files pass (124 and 18 tests respectively); fixes landed with SEC-2/SEC-4 in PR #161. Full suite: 535 tests passing across 31 files.


### 🔒 Routing & System Safety
*   ~~**[SEC-1] `getDashboardActivity` IDOR — `app/actions/event.ts:1155`**: Any authenticated user can pass arbitrary `eventIds[]` to `getDashboardActivity`. The action verifies a session exists but never checks the user has access to those events. A logged-in guest can enumerate activity feeds from events they don't belong to. Fix: filter `eventIds` to only those where `hostId = session.userId` OR co-host/RSVP membership exists before querying.~~ ✅ Fixed [PR #161]
*   ~~**[SEC-2] `reorderRsvpFields` IDOR — `app/actions/event.ts:948`**: `assertHostOrCohost(eventId)` is called for one event, but the field IDs passed in `orderedIds[]` are updated without verifying each field belongs to that `eventId`. A host of Event A can reorder questionnaire fields belonging to Event B. Fix: add a `where: { id: { in: orderedIds }, eventId }` guard or fetch-and-verify before bulk update.~~ ✅ Fixed [PR #161]
*   ~~**[SEC-3] `addComment` — no RSVP or identity check — `app/actions/event.ts:342`**: Any unauthenticated request that knows an `eventId` can post a comment as any guest name. The `rsvpId` field is optional and unverified. Enables spam and impersonation on all events with `commentsEnabled`. Fix: require either a valid session or a verified `editToken`/`rsvpId` that matches the submitting guest name before inserting a comment.~~ ✅ Fixed [PR #161]
*   ~~**[SEC-4] `claimPotluckItem` / `unclaimPotluckItem` — no auth — `app/actions/event.ts:800`**: Neither function performs any session or RSVP check. Any unauthenticated visitor can create or remove potluck claims with any guest name, polluting the host's potluck view with fake data. Fix: require a valid `editToken` (RSVP-linked) or host session to create/remove a claim.~~ ✅ Fixed [PR #161]

### 👥 Guest List & RSVP Enhancements
*   *(No pending priority 1 guest list enhancements)*

---

## 🟡 Priority 2: Medium Priority (Core UX & Feature Enhancements)
*Functional improvements, layout adjustments, and secondary features that can be batched together for UX consistency.*

### 🎨 Layout & Page Hierarchy
*   *(No pending priority 2 layout enhancements)*

### 🔒 Privacy & Sharing Controls
*   *(No pending priority 2 privacy controls)*

### ⚙️ Administration & Settings
*   **Post-Event Photo Sharing**: Build a dedicated post-event photo section to link to shared albums (Google Photos, Apple Photos, Immich, etc.).
*   ~~**Admin Theme Manager**: Add an admin settings page that allows dynamic theme creation. Admins can create new themes, modify settings for each theme (base style, accents, gradients, decorations), delete themes, set visibility, and customize titles and descriptions.~~ ✅ Completed

### 📖 Interactive Documentation Dashboard
*   [ ] Build an in-app documentation portal accessible via the host dashboard.
*   *   [ ] Render local markdown files (e.g., GitHub README, setup guides, and `docs/cloudflare_workers.md`) dynamically.
*   *   [ ] Implement search, category navigation, and responsive layout styling.

---

## 🟢 Priority 3: Low Priority & DevOps (Automation, Branding & Integrations)
*Aesthetic branding, advanced webhooks, automation, and long-term ideas (Icebox).*

### 📸 Post-Event & Follow-Up
*   **Post-Event Photo Upload Prompt (low priority)**: After an event ends, prompt guests to upload or share their photos. Removed from Auto-Reminders settings as an unimplemented stub; the full feature would integrate with a dedicated photo-sharing section and optionally link to external album services (see Priority 2).

### 🏷️ Branding & Customization
*   **White-Label Options**: Add system settings allowing hosts/admins to white-label the application (custom logo, website name, custom branding colors).
*   **One-Click Bookmark for Magic Links**: Provide hosts with a quick button/shortcut to bookmark their magic link RSVP sessions, keeping them logged in across devices.
*   **Rich Theme Presets**: Expand the theme builder with custom typography (from Google Fonts), vibrant gradients, and dynamic layout choices.
*   **Custom Cover Images**: Enable host upload cropping and stock image selection templates.
*   **Seasonal Themes**: Support seasonal themes featuring animated backgrounds (e.g., falling leaves for autumn, turkeys for Thanksgiving).

### 💬 Advanced Messaging Integrations
*   **Inbound Email Reply Logging**: Log guest email replies to sending addresses directly into a dedicated "Host Section" of the event dashboard (exploring unique routing addresses per event).
*   **Notification Preferences**: Rename "Notification Opt-Outs" to "Notification Preferences", allowing guests to prioritize either Email or SMS notifications.
*   **Unified Guest Updates**: Modify the update notification checkbox to "Notify guests" (sending via email or SMS, depending on which contact method the guest signed up with).

### 🧹 Code Quality & Best Practices Scrub
*   **Site-Wide Best Practices Scrub**: Audit the entire codebase against current Next.js 16 App Router, React, and TypeScript best practices. Key areas: (1) confirm all pages under `app/(app)/` use the shared layout rather than per-page nav; (2) review remaining uses of `AppShell` / `AppNavLogo` outside the route group (event page, RSVP flow, guests page, settings page) and decide whether to migrate them; (3) check for any remaining per-page `getSession` + `db.user.findUnique` duplicating what `getSessionUser()` already provides.
*   **Prettier Formatting CI Check**: Add Prettier to the GitHub Actions `ci.yml` workflow (`npx prettier --check .`) after running `npx prettier --write .` to format the existing codebase as a one-time prep commit. This enforces consistent style on every PR going forward.
*   **Profile Nav Reactive Update** *(minor UX)*: The shared layout nav shows the user's name and avatar from the server-rendered initial load. After a user saves new profile settings (name or avatar), the nav reflects the new values only after a page refresh/navigation — it does not update live. Consider adding a lightweight client-side state sync (e.g., revalidating the layout with `router.refresh()` after a successful profile save) so the nav avatar updates immediately.

### ⚙️ DevOps & Security (Deferred)
*   ~~**[SEC-5] Event passwords stored and compared in plaintext — `app/actions/event.ts:15`**~~: ✅ Fixed [ed8436] — `passwordHash` column (bcryptjs, cost 10); `verifyEventPassword` uses `bcrypt.compare`; `saveEventSettings` hashes on write. Existing plaintext passwords cleared by migration `20260624200000_rename_event_password_to_hash`.
*   ~~**[SEC-6] `pg_dump` command injection risk — `lib/backup.ts:84`**: The backup command is built via template-literal string interpolation and run through `exec` (invokes `/bin/sh`). If `DATABASE_URL` contains shell metacharacters in its hostname or database name segments, command injection is possible. Fix: switch to `execFile('pg_dump', ['-h', host, '-p', port, ...])` with an explicit argument array so no shell is involved.~~ ✅ Fixed [1e65a8]
*   ~~**[SEC-7] Intentional CodeQL SSRF scanner bypass — `lib/email.ts:34`**: `safeFetch` obfuscates the `fetch` call using char-code lookup specifically to defeat CodeQL's static-analysis SSRF detection (`String.fromCharCode(102,101,116,99,104)`). While `isSafeWorkerUrl` does validate URLs, intentionally hiding the call from security tooling makes future audits harder. Fix: remove the obfuscation, rely on `isSafeWorkerUrl`, and suppress the CodeQL finding with a proper annotation if needed.~~ ✅ Fixed [1e65a8] — alerts dismissed as false positives in GitHub Security
*   **[SEC-8] Hardcoded scrypt salt in `lib/crypto.ts:11`** *(deferred)*: `scryptSync(secret, "rsvp-to-me-salt", 32)` uses a static salt. Deferred: the salt is a KDF stretcher for a high-entropy `SESSION_SECRET`; AES-GCM semantic security is maintained by the per-ciphertext random IV. Changing the salt without a re-encryption migration script would silently break all existing encrypted admin configs on deploy.
*   **[SEC-9] CSP allows `'unsafe-eval'` + `'unsafe-inline'` in `script-src` — `next.config.ts`** *(partial fix [ed8436])*: `'unsafe-eval'` removed from production CSP; retained only in `NODE_ENV=development` for HMR. `'unsafe-inline'` remains — full removal requires nonce-based middleware injection (deferred).
*   ~~**[SEC-10] Co-hosts excluded from guest CSV download — `app/e/[slug]/guests.csv/route.ts:20`**: The CSV endpoint only permits the primary host (`event.hostId === session.userId`) and blocks co-hosts, who are otherwise authorized to manage the guest list. Fix: mirror the `assertHostOrCohost` pattern used elsewhere to also allow co-host and admin access.~~ ✅ Fixed [1e65a8]
*   **ESLint 10 Upgrade (blocked)**: `eslint` is held at `^9` because `eslint-plugin-react` v7 (bundled in `eslint-config-next@16.2.9`) calls `context.getFilename()` which was removed in ESLint 10. Unblock by upgrading to a `next` / `eslint-config-next` version whose bundled plugins declare ESLint ≥10 peer deps. Tracked as of 2026-06-23.
*   ~~**GitHub Release Workflow**: Setup a GitHub Actions workflow to automate release tagging, version increments, and changelog generation.~~ ✅ Completed [PR #153]
*   **Phone Number Encryption at Rest (M-2)**: Encrypt phone numbers deterministically at-rest using HMAC hashes for index lookups and AES-256-GCM for display.
*   **HTTP Request Logging & Distributed Tracing (G-1)**: Track request duration, method, and statuses using request IDs mapped to Pino structured logs.
*   **Graceful Shutdown Signal Handling (G-2)**: Handle SIGTERM signals in Next.js/Docker setup to allow in-flight requests to complete before exiting.
*   **Separate Database Migration Stage (G-3)**: Extract Prisma migrations (`prisma migrate deploy`) out of application container startup to a separate init container or CI/CD deployment pipeline step. This is the long-term fix for CRIT-1 — a migration failure fails the *deployment* rather than crash-looping the running app container.
*   **React Error Boundaries (G-4)**: Wrap core page components in error boundaries to prevent rendering crashes from taking down entire routes.
*   **Automated Database Backups (G-5)**: Implement cron backup service in `docker-compose.yml` to dump `prod.db` to S3 or secure local backups daily.
*   **Bot Protection / CAPTCHA (G-6)**: Add Cloudflare Turnstile bot checks to authentication magic link requests and guest registration forms.
*   **GDPR Compliance APIs (G-7)**: Implement export-data and account-deletion API actions for hosts and guests.
*   **Admin Diagnostic Log Viewer**: Expose recent email dispatch diagnostic logs directly in the `/admin` settings dashboard.
*   **SMTP Handshake Sandbox**: Allow interactive port and SSL handshake verification inside the dashboard.
*   **Custom Domain Workers**: Enhance `isSafeWorkerUrl()` to support verified custom domains mapped to workers without triggering SSRF warnings.
*   **Auth Fallback Alerts**: Alert users during login errors to reference the container console rescue log fallback.

---

## ✅ Completed Milestones
*A log of completed capabilities.*

### Security Fixes — IDOR & Auth Gaps [PR #161]
*   [x] **[SEC-1] `getDashboardActivity` IDOR**: Scoped `eventIds` to only events the caller owns or is a co-host/RSVP member of (`app/actions/event.ts`).
*   [x] **[SEC-2] `reorderRsvpFields` IDOR**: Added `eventId` guard to prevent hosts from reordering fields belonging to other events.
*   [x] **[SEC-3] `addComment` unauthenticated**: Enforced valid session or verified `editToken`/`rsvpId` check before inserting comments.
*   [x] **[SEC-4] `claimPotluckItem` / `unclaimPotluckItem` unauthenticated**: Gated potluck claim creation and removal behind a valid `editToken` or host session.

### GitHub Release Workflow [PR #153]
*   [x] **GitHub Actions release automation**: Automated release tagging, version increments, and changelog generation on merge to main.

### Admin Theme Manager
*   [x] **Admin Theme Manager**: Admin settings page for dynamic theme creation — create/edit/delete themes, configure base style, accents, gradients, decorations, visibility, titles, and descriptions.

### Admin UX & Host Account Deletion [7nce6r]
*   [x] **Admin Settings History & Refresh**: Active admin tab is synced to the URL (`/admin?tab=backups`) via `useSearchParams` + `router.replace`. Browser back/forward and page refresh all preserve the selected tab.
*   [x] **Backup Schedule Picker**: Replaced raw cron text input (Admin → Backups) with a preset dropdown (Disabled, Hourly, Every 6h, Daily, Every 3 days, Weekly). A "Custom" option reveals the raw input for advanced cron expressions.
*   [x] **Host Account Deletion Flow**: Hosts can delete their account from Profile settings. Upcoming published events must be explicitly deleted first (each shows a "Delete event" button; deleted events show a tombstone page at their original URL). After clearing events, the host types "DELETE" to confirm. Account is signed out immediately and anonymized within 24 hours. Admins see a "Deletion Pending" badge in the Users tab and can cancel within the window. Past events are reassigned to a SYSTEM tombstone user; guest RSVP/comment data for past events is preserved (GDPR-defensible: it is the guests' data). Added `DELETED` EventStatus; `deleteHostEvent()` server action; `requestAccountDeletion()` and `cancelAccountDeletion()` actions; hourly cron processing in `lib/cron-scheduler.ts`; Prisma migration `add_deletion_fields`.

### Favicon & Page Titles
*   [x] **Root Layout Metadata**: Replaced `"Create Next App"` placeholder with branded title template (`"%s | RSVP to Me"`), real description, and Open Graph site defaults.
*   [x] **Dynamic Event Metadata**: Added `generateMetadata` to `/e/[slug]` (title + OG cover image), `/e/[slug]/rsvp`, `/e/[slug]/settings`, and `/e/[slug]/guests`.
*   [x] **Static Page Titles**: Added `metadata` exports to home, sign-in, register, dashboard, and new-event pages.
*   [x] **Branded Favicon Set**: Added `app/icon.svg` (stylized "R", brand purple), `app/apple-icon.tsx` (180×180 ImageResponse PNG), and `public/site.webmanifest` for PWA/bookmark support.

### Event Page Bugs & RSVP Enhancements [b06146]
*   [x] **Location Selector**: Implemented a responsive `LocationSelector` client component with PHYSICAL, VIRTUAL, and TBD types for event creation.
*   [x] **Potluck Quantity Input**: Corrected quantity input behavior to allow temporary empty values for custom typing.
*   [x] **Deep Linking Navigation**: Implemented smooth anchor scrolling behavior for target hashes (e.g. `#polls` and `#potluck`).
*   [x] **Pending RSVP Management**: Added a "Pending Approval" filter tab on the guest list and updated stats headers for hosts to approve/decline RSVPs.
*   [x] **Event Page Section Reordering**: Moved Polls and Potluck sections below the RSVP/sharing containers to improve hierarchy.
*   [x] **RSVP "Next Actions"**: Added interactive "Next Steps" suggestions on the RSVP success screen to prompt voting and potluck contributions.
*   [x] **Private Event Invitations**: Configured "guests can invite" settings and added the `inviteFriendAsGuest` server action to generate pending RSVPs.

### Core Platform Setup
*   [x] **Next.js 16 + Prisma 7 + SQLite Core**: Database schemas, seeds, and App Router structure.
*   [x] **Magic Link Authentication**: Authentication mechanism via iron-session cookies.
*   [x] **Seeding & Mock Data**: Automated test seeding of events, comments, and RSVPs via `SEED_TEST_DATA=true`.

### Event & Guest Engagement
*   [x] **Interactive Event Polls**: Anonymous voting, host controls, write-in suggestions, and vote audits.
*   [x] **Comment Threading & Activity Feed**: Nested replies, activity log pagination, and user roles.
*   [x] **WYSIWYG Host Controls**: Floating overlays and preview toggles (`?preview=1`) for event owners.

### Integrations & Diagnostics
*   [x] **SMTP & Cloudflare Workers**: Support outbound sending via custom worker or mail server.
*   [x] **Setup Wizards**: Generate secrets, pre-fill Cloudflare subdomains, and toggle visibility.
*   [x] **Email Diagnostics & Safety**: Connection-testing suite in `/admin`, SSRF validation checks, and console auth lockout safety fallbacks.
*   [x] **Cloudflare Email Service Migration**: Upgraded Cloudflare Worker integration from Email Routing (`SEND_EMAIL`) to the newer Cloudflare Email Service (`EMAIL`), enabling transactional emails to arbitrary external recipients.
*   [x] **Cloudflare Email REST API Option**: Direct transactional email sending using the v4 Cloudflare Accounts endpoint, with visual settings guides, DMARC warnings, and secrets masking.

### UI/UX Polish & Messaging Redesign
*   [x] **Event Settings Reorganization**: Split Polls and Potluck configurations into dedicated sub-setting sections, reordered categories (Hosts, Display, RSVP, Theme, Reminders, Polls, Questionnaire, Potluck), and added back-button state persistence.
*   [x] **Message Guests Redesign**: Updated to support multi-select recipient filters (All, Invited, Yes, Maybe, No), checkboxes for delivery channels (Email/SMS), and a single Send button at the bottom. Toggling "All" deselects others, and selecting any other filter deselects "All".
*   [x] **Host Control Panel & Cover Refinement**: Added hover highlight effects to all floating menu items and removed the redundant Theme picker button from the cover image.
*   [x] **Activity Updates Labeling**: Updated "Notify guests via email" to "Notify guests of update" to support multiple notification channels.
*   [x] **TS/ESLint Quality Sweep**: Cleared all errors and warnings across the app (including dynamic avatar img element warnings).

### Unified Dashboard & Image Refactoring
*   [x] **Unified Guest/Host Dashboard**: Opened `/dashboard` to guest users, showing active invitations, co-host overlaps, and comment activity counts.
*   [x] **Partiful-style Grid Layout**: Implemented square cover photo layouts, overlay badges, search and pill-style filter tabs.
*   [x] **RSVP Auto-linking Utility**: Created background process to merge/link guest RSVPs automatically during registration and login.
*   [x] **Next.js Image Refactoring**: Replaced all raw `<img>` tags codebase-wide with Next.js `<Image>` / `<NextImage>` component, removing all `@next/next/no-img-element` overrides.

### UI/UX Polish & Potluck Multi-Claim Refactor
*   [x] **Potluck Multi-Claim Refactoring**: Shifted to a relational `PotluckClaim` schema model to support multiple claimants per item. Built backend controllers, mock data seeds, and unit tests, and designed a nested claimant visual UI with unclaiming actions.
*   [x] **Dashboard Recent Activity Filters**: Added interactive filtering by event and action type to the dashboard activity log. Implemented day-level grouping headers and initials badge avatars.
*   [x] **Unified Top Navigation**: Integrated `AppNavLogo` and `ProfileDropdown` menus into the event page header, unifying navigation bars codebase-wide, and removing the redundant top-nav settings button.
*   [x] **Location Selector Layout Polish**: Prevented layout wrapping of option chips and corrected width scaling for the Physical/Virtual popover edit views to align with other card components.
*   [x] **Questionnaire Serialization Fix**: Resolved select/checkbox option parsing bugs on RSVP forms by standardizing field config storage as JSON strings.

### PostgreSQL 18 Hard Requirement & SQLite Removal
*   [x] **Drop SQLite / Hard-Require PostgreSQL 18**: Removed all SQLite/LibSQL dependencies (`@libsql/client`, `@prisma/adapter-libsql`). `schema.prisma` is now the single Postgres schema. `REDIS_URL` throws at startup if unset. Squashed 5 incremental Postgres migrations into a single clean `20260623000000_init` migration. Updated CI to use a `postgres:18-alpine` service. Updated all docs, `docker-compose.dev.yml`, `.env.example`, `AGENTS.md`, and `tests/setup.ts`.
*   [x] **node-redis v4 → v5 → v6 upgrade**: Two-hop upgrade (v4→v5 in PR #139, v5→v6 in PR #142). Updated RESP3 multi-exec result handling and TypeScript types throughout `lib/redis.ts`.

### PostgreSQL, Redis, In-Process Cron & UX Sweep
*   [x] **PostgreSQL & Redis Integrations**: Dynamic runtime database selection (SQLite/PostgreSQL), dual Prisma schema generation, connection pooling, Redis session caching, atomic rate-limiting, and Redis-based distributed cron synchronization locks.
*   [x] **In-Process Cron Scheduler**: Migrated background tasks (automated DB backups and event reminders) to run in-process using Next.js 16's `instrumentation.ts` bootstrap, eliminating the dedicated `cron` container.
*   [x] **Docker Image Healthcheck**: Integrated a lightweight native HTTP healthcheck into the `Dockerfile` and cleaned up compose configs.
*   [x] **Dynamic Twilio SMS Config**: Implemented system configurations for Twilio SID, token encryption, and SMS blast capabilities, with connection testing in `/admin`.
*   [x] **Responsive Mobile Admin Drawer**: Added sliding hamburger drawer navigation for mobile screens in the admin panel.
*   [x] **Public Event Feed & Private Gating**: Rendered top 20 upcoming public events on the home page and gated unlisted/private events appropriately.
*   [x] **UI/UX & Form Polish**: Split date/time edit inputs, grouped RSVP options, fixed copy link buttons, and placed toast notifications fixed at the top of the viewport.

### Theme Presets, Readability & Slug Collision Resolution [fa3e8d]
*   [x] **Theme Presets & Grids**: Implemented searchable/filterable preset grids, date-based dynamic sorting, light accent contrast improvements, and settings-preview parity.
*   [x] **Event Slug Collision Resolution**: Verified automatic suffixing (e.g., appending `-1`, `-2`) during slug generation in `lib/slug.ts` when two events share the same name.

### RSVP Notification Toggles
*   [x] **Per-Event Notification Toggles**: Added 6 per-event boolean toggles under Event Settings → RSVP Options → Notification Settings: guest confirmation email/SMS on RSVP submission, host RSVP alert email/SMS (new — hosts are notified with guest name, status, note, and headcount), and approval notification email/SMS when a host approves or declines a pending RSVP. All default to on to preserve existing behavior.

### INVITED Status + Email RSVP Buttons + SMS Reply-to-RSVP
*   [x] **INVITED RSVPStatus Enum**: Added `INVITED` to `RSVPStatus` (alongside `GOING`, `MAYBE`, `NO`). Host-invited guests now carry an INVITED RSVP instead of a phantom GOING one, eliminating false "going" counts before guests respond.
*   [x] **Email RSVP Buttons**: Replaced single "RSVP Now" button in invite emails with three colored anchor buttons — Going (green), Maybe (amber, hidden when `maybeEnabled = false`), Can't Go (red). Each links to `/e/{slug}/rsvp?token={editToken}&status=GOING|MAYBE|NO`, pre-selecting the response on the RSVP edit form. Guest still confirms name/questionnaire before submitting.
*   [x] **SMS RSVP Reply Webhook**: Invite SMS now prompts guests to reply YES / NO / MAYBE. `POST /api/webhooks/twilio` validates the Twilio HMAC signature, looks up the pending invitation by phone number (no event code required), and updates the RSVP. Edge cases handled: past deadline, maybe-disabled events, capacity full, multiple pending invitations (disambiguation).
*   [x] **Deduplication in addRSVP**: If a guest with an INVITED RSVP submits via the event page form, the existing RSVP is updated rather than a duplicate being created.
*   [x] **Private Event Sign-in CTA**: Unauthenticated visitors to a private event now see a "Sign in to access" button linking to `/sign-in?redirect=/e/{slug}`.


