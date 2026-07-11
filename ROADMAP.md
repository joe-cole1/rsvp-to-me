# RSVP to Me — Product Roadmap

This document outlines the short-term backlog, long-term ideas, and historical milestones of the **RSVP to Me** platform. It serves as our long-term reference for future features, unresolved issues, and product ideas.

---

## 🔴 High Priority

_Immediate attention items. High impact bugs, critical security gaps, and essential routing/data integrity fixes._

### 🛠️ Bug / Fix

- **RSVP Flow Confirmation Race Condition**: A guest submitting a new RSVP (without email/phone) transiently sees the "RSVP updated!" success screen instead of "You're in!" due to Next.js's Server Action page refresh. When the action completes, the URL is updated with the new `token` client-side, but the Server Action automatically triggers a page refresh, prompting Next.js to re-request the RSC payload with the new `token` URL parameter. On the server, `RsvpPage` reads this token and passes `existingRsvp` to the client `RsvpFlow` component, raising its `isEdit` flag to `true` and swapping the header text to "RSVP updated!". Fix by tracking a client-side `justCreated` flag that overrides the header check during the initial mount. _(Discovered during the [89d70d] themes E2E audit.)_

### 🔒 Backend / Security / DevOps

- **`scripts/preflight.sh` fails at the Prettier step in the primary dev clone**: `npx prettier --check .` exits non-zero with `EACCES: permission denied, scandir 'pg_data/18/docker'` — the dev Postgres bind mount (`./pg_data:/var/lib/postgresql` in `docker-compose.yml`) is owned by the container user with mode `700`, and Prettier's directory expansion errors on it even though `pg_data/` is listed in `.prettierignore`. Postgres itself requires the `700` permissions, so the directory can't simply be opened up. Workaround: run preflight from a clean temporary worktree (no `pg_data/`). Proper fix candidates: move the dev DB to a named Docker volume instead of a repo-relative bind mount, or scope the Prettier check to explicit top-level targets. _(Hit during [c58f78] effect-size work; out of scope there.)_

---

## 🟡 Medium Priority

_Functional improvements, layout adjustments, and secondary features that can be batched together for UX consistency._

### 🛠️ Bug / Fix

- **Host new-RSVP alert email is not wired up**: `sendHostRsvpAlertEmail` (and its SMS twin `sendHostRsvpAlertSms`) exist and now have a styled, previewable template, but nothing calls them — hosts do **not** actually receive a "New RSVP" email/SMS when a guest RSVPs, despite the notification toggles implying they do. The initial migration also carries orphaned `Event` columns (`hostAlertEmail`, `rsvpConfirmEmail`, …) that no longer exist in `schema.prisma` (schema drift). Wire the alert into `addRSVP` (respecting the per-event host-alert toggles) and reconcile or remove the stale columns. _(Discovered during the 2026-07 email-template rebuild.)_

### 🎨 UI / UX / Feature

- **Guest Check-In flow**: The `CheckIn` model exists and the admin Overview counts check-ins, but there is **no host-facing check-in feature** — no server action to mark a guest checked-in and no guest-list UI/button. Build the missing flow: a check-in toggle/action gated to host/cohost, real-time counts on the guest list, and an "undo" — then re-document it. _(Discovered during the 2026-06 docs accuracy pass.)_
- **Richer CSV export**: `app/e/[slug]/guests.csv/route.ts` currently exports only Name, Email, Status, Plus Ones, Approved, RSVP Date. Extend the export to include guest phone, questionnaire answers (one column per question), and check-in time once check-in exists. _(Discovered during the 2026-06 docs accuracy pass.)_
- **Post-Event Photo Sharing**: Build a dedicated post-event photo section to link to shared albums (Google Photos, Apple Photos, Immich, etc.).

### 🔒 Backend / Security / DevOps

- **[M-3] CSP `script-src 'unsafe-inline'`**: Already tracked as **SEC-9** (deferred, needs nonce middleware). No new entry.
- **[M-5a] Static scrypt salt**: Already tracked as **SEC-8** (deferred; re-encryption migration required). No new entry.

---

## 🟢 Low Priority & DevOps

_Aesthetic branding, advanced webhooks, automation, and long-term ideas (Icebox)._

### 🛠️ Bug / Fix

### 🎨 UI / UX / Feature

- **Post-Event Photo Upload Prompt (low priority)**: After an event ends, prompt guests to upload or share their photos. Removed from Auto-Reminders settings as an unimplemented stub; the full feature would integrate with a dedicated photo-sharing section and optionally link to external album services (see Priority 2).
- **White-Label Options**: Add system settings allowing hosts/admins to white-label the application (custom logo, website name, custom branding colors).
- **One-Click Bookmark for Magic Links**: Provide hosts with a quick button/shortcut to bookmark their magic link RSVP sessions, keeping them logged in across devices.
- **Custom Cover Images**: Enable host upload cropping and stock image selection templates.
- **Custom Effect Upload**: Let admins (and eventually hosts) upload their own effect sprite sets for the animated background layer, Partiful-style — the registry in `lib/effects.ts` currently requires a code change to add a set.
- **Interactive Effect Particles (cursor physics)**: Make drifting motifs react to pointer movement/taps (repulsion force). Requires per-frame JS positioning (rAF or canvas) — a second rendering mode alongside the pure-CSS layer, which was deliberately chosen for battery/perf. Icebox until the effect system warrants a physics tier. _(Suggested in the [89d70d] post-PR code audit.)_
- **Unified Guest Updates**: Modify the update notification checkbox to "Notify guests" (sending via email or SMS, depending on which contact method the guest signed up with).

### ⚙️ Refactoring & Clean Code

- **Scoped CSS custom properties for event theming**: `resolveTheme()` produces a ~35-token JS object consumed as inline styles throughout the event components. An alternative is projecting those tokens as CSS custom properties (`--theme-accent`, …) on a wrapper element so components use plain CSS/Tailwind arbitrary values instead of `t.*` props. Note the JS object must remain regardless — `resolveEmailTheme()` derives the email palette from it server-side — so this is an additional projection layer, and a large cross-cutting refactor with zero user-visible change. Icebox until a concrete need (e.g. per-section theme overrides) justifies it. _(Suggested in the [89d70d] post-PR code audit.)_
- **[CLEAN-02] Shared Authorization Guards**: Route handlers (like `guests.csv` and backups download) hand-roll authorization checks (e.g. `session.role !== "ADMIN"` or mapping co-hosts inline) instead of reusing the `assertHost`, `assertHostOrCohost`, and `assertAdmin` helpers from action files.
  - _Recommended Fix_: Move `assertHost`, `assertHostOrCohost`, and `assertAdmin` into a single shared utility module (`lib/auth-guards.ts` or `lib/auth.ts`) and import them in both routes and actions.

### 🔒 Backend / Security / DevOps

- **[SEC-8] Hardcoded scrypt salt in `lib/crypto.ts:11`** _(deferred)_: `scryptSync(secret, "rsvp-to-me-salt", 32)` uses a static salt. Deferred: the salt is a KDF stretcher for a high-entropy `SESSION_SECRET`; AES-GCM semantic security is maintained by the per-ciphertext random IV. Changing the salt without a re-encryption migration script would silently break all existing encrypted admin configs on deploy.
- **[SEC-9] CSP allows `'unsafe-eval'` + `'unsafe-inline'` in `script-src` — `next.config.ts`** _(partial fix [ed8436])_: `'unsafe-eval'` removed from production CSP; retained only in `NODE_ENV=development` for HMR. `'unsafe-inline'` remains — full removal requires nonce-based middleware injection (deferred).
- **ESLint 10 Upgrade (blocked)**: `eslint` is held at `^9` because `eslint-plugin-react` v7 (bundled in `eslint-config-next@16.2.9`) calls `context.getFilename()` which was removed in ESLint 10. Unblock by upgrading to a `next` / `eslint-config-next` version whose bundled plugins declare ESLint ≥10 peer deps. Tracked as of 2026-06-23.
- **Phone Number Encryption at Rest (M-2)**: Encrypt phone numbers deterministically at-rest using HMAC hashes for index lookups and AES-256-GCM for display.
- **HTTP Request Logging & Distributed Tracing (G-1)**: Track request duration, method, and statuses using request IDs mapped to Pino structured logs.
- **Separate Database Migration Stage (G-3)**: Extract Prisma migrations (`prisma migrate deploy`) out of application container startup to a separate init container or CI/CD deployment pipeline step. This is the long-term fix for CRIT-1 — a migration failure fails the _deployment_ rather than crash-looping the running app container.
- **Automated Database Backups (G-5)**: Implement cron backup service in `docker-compose.yml` to dump `prod.db` to S3 or secure local backups daily.
- **Bot Protection / CAPTCHA (G-6)**: Add Cloudflare Turnstile bot checks to authentication magic link requests and guest registration forms.
- **GDPR Compliance APIs (G-7)**: Implement export-data and account-deletion API actions for hosts and guests.
- **Admin Diagnostic Log Viewer**: Expose recent email dispatch diagnostic logs directly in the `/admin` settings dashboard.
- **SMTP Handshake Sandbox**: Allow interactive port and SSL handshake verification inside the dashboard.
- **Custom Domain Workers**: Enhance `isSafeWorkerUrl()` to support verified custom domains mapped to workers without triggering SSRF warnings.
- **Local `scripts/preflight.sh` full E2E fails on `auth.e2e.ts › magic link verify → dashboard`** _(discovered 2026-07-04, local-CI tooling PR)_: the ephemeral Redis the script starts (`127.0.0.1:56399`) isn't reachable by the app server during E2E (log shows persistent `[redis] Error … Redis error`), so the magic-link/rate-limit path fails-closed and the `/dashboard` redirect never happens. Fails identically on `main` locally but **passes in GitHub CI**, so it's an ephemeral-Redis reachability gap in the local harness, not an app bug. Fix: add a Redis-readiness wait (mirroring the `pg_isready` loop) and verify the server resolves `REDIS_URL` to the mapped port.

---

## ✅ Completed Milestones

_A log of completed capabilities._

### Rich Theme Presets & Seasonal Animated Themes (Batch [89d70d])

- [x] **Rich Theme Presets — custom typography**: Curated registry of 12 Google Fonts (`lib/fonts.ts` + loaders in `app/fonts.ts`), self-hosted at build time via `next/font/google` (`preload: false`) — no runtime Google requests, offline-safe. Hosts pick a heading font in Settings → Theme; admins can attach a default font to any preset in the Theme Manager. `EventTheme.fontId` / `ThemePreset.fontId` added with server-side registry validation; emails degrade to per-font email-safe stacks in `resolveEmailTheme()`.
- [x] **Rich Theme Presets — vibrant gradients**: Loosened `resolveTheme()` saturation clamps (DARK page-bg caps 20/16/12 → 36/30/24, brighter orb glows; SOFT page tint cap 20 → 34) and added 8 vivid presets (Miami Vice, Tropical Punch, Aurora, Ultraviolet, Citrus Pop, Flamingo, Blue Raspberry, Grape Soda) with matching font defaults.
- [x] **Theme cleanup — dead code + DRY defaults**: Deleted the orphaned `components/event/ThemePicker.tsx` (unimported since theme editing moved into `settings-page/ThemePanel.tsx`; had drifted behind the live panel) and extracted the card-opacity default fallback into a shared `getDefaultCardOpacity(base)` helper in `lib/theme.ts`, now used by `resolveTheme()`, SettingsPage state init, ThemePanel handlers, and the admin ThemePresetModal.
- [x] **Seasonal Themes — animated background effects**: Partiful-style DOM/CSS particle layer (`ParticleLayer.tsx`) — GPU-composited keyframes, randomized per-particle duration/delay/scale/sway, two motion modes (fall + float/twinkle), `prefers-reduced-motion` hides the layer. 19 effect sets with 56 hand-authored SVG sprites under `public/effects/` (leaves, turkeys, snow, snowflakes, hearts, Halloween, shamrocks, blossoms, Easter, winter holidays, presents, sun & palms, football, fireworks, stars, balloons, bubbles, confetti, beer); confetti/balloons tint from the theme palette via CSS masks. Effects are host-opt-in only (default None, never part of a preset), stored as `EventTheme.effectId/effectDensity/effectSpeed` with registry validation, seasonal-proximity sorting in the picker, and explicit no-op email degradation. This retires the long-stubbed `decorationVariant` hidden-div in `BackgroundDecorations.tsx`.

### Security & Cleanup Hardening (Batch [a27054])

- [x] **Information Disclosure ([SEC-14])**: Sanitized raw error messages returned by SMTP and Twilio configuration test actions, logging connection details on the server while presenting safe, user-friendly messages to the admin client.
- [x] **Consolidated System Config Loading ([CLEAN-01])**: Consolidated all system configuration retrieval codebase-wide to utilize the React `cache`-deduplicated `getSystemConfigMap()` utility, and optimized `resolveTwilioAuthToken` to avoid duplicate database queries during webhook signature checks.
- [x] **SSRF IP Hardening ([SEC-7])**: Hardened `isSafeWorkerUrl` to exhaustively parse and block loopback subnets (`127.0.0.0/8`, `0.0.0.0/8`, etc.), unique local / link-local IPv6 ranges, and IPv4-mapped IPv6 loopback/private subnets.

### Security Hardening & Edge Cases (Audit Batch)

- [x] **Upload Gating ([SEC-21c])**: Restricted `/api/upload` access to logged-in hosts or admins, blocking auto-created guest accounts.
- [x] **Magic Token Scope ([SEC-21a])**: Enforced scope checks in `verifyMagicToken` to ensure a login token cannot be used for email or phone updates.
- [x] **Paginated Blasts ([SEC-15])**: Paginated queries in `sendBlast` and `sendSmsBlast` to load RSVPs in chunks of 500, preventing high memory load on large events.
- [x] **Information Disclosure ([SEC-14a])**: Generalized authentication errors to prevent user email enumeration by returning a single generic `auth_failed` error code.
- [x] **Rate Limit Cleanup ([DEV-01])**: Configured the in-process cron scheduler to run `cleanupRateLimits()` daily, preventing table bloat.

### Default RSVP & Poll Settings (Batch [fd1443])

- [x] **Default settings to off/disabled**: Changed schema defaults for `plusOneAllowed` to `false`, `allowGuestsToAdd` (Polls) to `false`, and `emailHoursBefore` (Auto-Reminders) to `0` (off) in `schema.prisma`. Generated and applied a database migration, and aligned default fallback logic in settings panel UI components and test factories.

### Admin UI/UX Polish

- [x] **Reconcile Header & Page Admin Menus**: Removed the global `AdminHamburger` drawer button from the header navigation. Added a clear `🛡️ Admin Panel` link to the `ProfileDropdown` (only visible to admins) to serve as the single entry point.
- [x] **Filter Out Deleted Users in Admin panel**: Excluded anonymized/deleted users from the default view by defaulting the status filter in `UsersTab` to `"ACTIVE"`. Added a `"DELETED"` status filter option to specifically show them when selected. Also hid Actions controls for already deleted/anonymized users.
- [x] **Admin Mobile Navigation Improvements**: Repositioned the mobile hamburger drawer trigger in `/admin` to the top-left, and updated the slide-in drawer to open from the left side using the condensed design and opaque background style.

### High-Priority Bug Fixes (Batch [8f3093])

- [x] **[BUG-02] Bounded Slug Collision Probing Fallback Length Mismatch**: Resolved flakiness in the slug collision test by using a set of exact sequential slug candidates instead of a digit-matching regex.
- [x] **[BUG-03] Flaky Unit Test Timeouts in CI**: Configured default `testTimeout` and `hookTimeout` in `vitest.config.ts` and `vitest.components.config.ts` to `30000ms`, matching the integration test timeout configuration.
- [x] **[BUG/SAFE] Admin Protection Guard (Self & System Deletion)**: Added backend validation and UI locks to prevent the deletion/role change of the logged-in admin user and the `system` user, and excluded the `system` user from the admin user list.

### Event Page UI/UX Enhancements

- [x] **Event Host Display Name Override**: Added support for host and co-host display name overrides directly in the Hosts Settings panel (`?section=hosts`), prioritizing overrides across the event page, dashboard cards, and email templates/reminders.
- [x] **RSVP Deadline & Guest Gate**: Added RSVP deadline inputs, styled the deadline notice prominently, disabled and hid guest RSVP forms once the deadline passes, and added server-side validation to prevent late RSVP updates.
- [x] **Consistent Add Item Styling**: Converted Questionnaire, Polls, and Potluck panels to use collapsible "+ Add" buttons that expand into forms with aligned buttons.
- [x] **Questionnaire Auto-Enable**: Enabled the questionnaire automatically based on existing questions, and added detailed settings copy.
- [x] **Description Card Header**: Added the `📝 Description` title to the event page details card to align with the other sections.

### Host & Co-host Event Deletion

- [x] **Host Event Deletion**: Add a "Delete Event" button to the Display Options settings panel (Danger Zone) for the main host. Render a confirmation modal/prompt warning that this action is permanent and cannot be undone. Create a `deleteEvent` server action that validates `assertHost` and deletes the event. Tests: `tests/regression/sec-30-cohost-authz.test.ts`.

### Cover Image Variable Aspect Ratio

- [x] **Cover Image Variable Aspect Ratio**: Implement a flexible aspect ratio for cover images on the event page (capped between 200px and 450px) while maintaining the uniform 4:3 aspect ratio on the dashboard event cards and public feed cards for grid alignment. Tests: `tests/components/EventHero.test.tsx`.

### Event Sub-Route Access Gates & Guest-List Data Leak

- [x] **[SEC-34] Visibility/password gate bypass on `/e/[slug]` sub-routes + guest RSVP leak**: The main event page gated PRIVATE/password events, but three sibling routes did not. Extracted the gate into a single source of truth — `resolveEventAccess()` in `lib/eventAccess.ts` (host/co-host/admin session, signed unlock cookie, valid RSVP token, or logged-in guest with an existing RSVP) — and applied it to `app/e/[slug]/calendar.ics/route.ts` (was serving the full ICS — description, address, virtual URL, timings — to any anonymous caller; now returns 404 unless granted), `app/e/[slug]/guests/page.tsx` (was only checking `guestListVis === "HOST_ONLY"`; now redirects to the event page for gated events), and `app/e/[slug]/rsvp/page.tsx` (was letting anyone open the RSVP flow directly). The main `app/e/[slug]/page.tsx` was refactored onto the same helper to prevent drift. Also fixed the guest-list RSC payload leak: `serializeGuestRsvp()` in `lib/guestList.ts` now strips `editToken` (guest impersonation), `guestEmail`/`guestPhone` (contact-info leak), and questionnaire `answers` (private responses) for non-hosts — previously the full rows were serialized to every visitor even though the UI hid them — and the host-only Invited list is no longer serialized for guests. Regression test: `tests/regression/sec-34-event-access-gates.test.ts`.

### Themed, Responsive Email Templates (React Email)

- [x] **Beautiful & Modern Email Templates**: Rebuilt all 8 transactional/blast emails with [React Email](https://react.email/) (`emails/`), rendered to responsive table-based HTML with a light canvas + themed gradient hero, `color-scheme` meta tags, mobile media queries, and a `prefers-color-scheme` dark enhancement. Event emails are themed **at send time** from the event's own theme via `resolveEmailTheme()` (`lib/email-theme.ts`), which **derives** the palette from the existing `resolveTheme()` — so new presets and host theme changes (including on cron reminders) flow into email automatically with no email-code changes. Invite uses an accent primary "Going" button with quiet Maybe/Can't-Go links; emails gained an add-to-calendar row (Google + a new `/e/[slug]/calendar.ics` route), a map-linked details card, and a themed host monogram. Admins can edit per-template copy + content-block toggles (stored in `SystemConfig`, rendered as escaped text nodes) and preview/test-send any template from **Admin → Email → Email Templates**; hosts can preview their event's themed emails and send themselves a test from **Settings → 💌 Emails**. A documented **degradation contract** in `lib/email-theme.ts` + `AGENTS.md` makes the theme→email mapper the single extension point for future theme capabilities, enforced by a preset-sweep test. Tests: `tests/lib/email-theme.test.ts`, `email-templates.test.tsx`, `email-preset-sweep.test.tsx`, `email-settings.test.ts`, `calendar.test.ts`, `tests/api/calendar-ics.test.ts`.
- [x] **Latent unescaped-message fix**: the old inline-HTML blast and approval templates interpolated host/guest-typed `message` strings directly into HTML (a stored-injection-into-email vector). The React rebuild renders all copy as text nodes, structurally eliminating it.

### Admin Mobile Drawer Trigger, Slug-Test Flake & Invite Logging

- [x] **[BUG-03] Admin mobile drawer can never open**: Added a `lg:hidden` hamburger button to the admin page banner (`AdminClient.tsx`) that calls `setIsDrawerOpen(true)`, so admins on screens below `lg` can open the sliding drawer and switch tabs. Regression test: `tests/regression/bug-03-admin-mobile-drawer-trigger.test.ts`.
- [x] **[BUG-02] Bounded Slug Collision Probing Fallback Length Mismatch**: Root-caused as a flaky test, not a code bug — `randomBytes(3)` has a ~6% chance of producing an all-digit 6-char hex suffix, which the "every numeric suffix is taken" fixture counted as a collision, pushing the generator to an 8-char suffix and failing the `{6}` assertion. `l7-slug-collision-bound.test.ts` now stubs `randomBytes` to a deterministic letter-bearing buffer.
- [x] **[L-4b] One missed L-4 site**: `logActivity(...).catch(() => {})` in `inviteFriendAsGuest` (`app/actions/event/invites.ts`) now routes through `logSafe("inviteFriendAsGuest")` like every other non-critical activity-log call. Regression test: `tests/regression/l4b-invite-friend-swallowed-error.test.ts`.

### components/event/SettingsPage.tsx God-File Split

- [x] **[L-3] God-file split (components/event/SettingsPage.tsx)**: Split the ~3,408 line `components/event/SettingsPage.tsx` into per-panel, props-driven components under `components/event/settings-page/` (`SettingsMenu`, `ThemePanel`, `HostsPanel`, `RsvpOptionsPanel`, `QuestionnairePanel`, `DisplayOptionsPanel`, `RemindersPanel`, `PollsPanel`, `PotluckPanel`, plus shared `types.ts`, `helpers.ts`, `styles.ts` (`buildStyles`), `ui.tsx` (`Label`/`Toggle`/`Section`), and `SettingsDecorations`). `SettingsPage.tsx` remains the state-owning orchestrator (~1,090 lines) with an unchanged import path, keeping all hooks, auto-save triggers, handlers, and URL-section sync in place. This closes out the L-3 god-file series (PRs #231, #232, #237).

### app/(app)/admin/AdminClient.tsx God-File Split

- [x] **[L-3] God-file split (app/(app)/admin/AdminClient.tsx)**: Split the ~5,270 line `app/(app)/admin/AdminClient.tsx` into per-tab, props-driven components under `app/(app)/admin/tabs/` (`OverviewTab`, `UsersTab`, `EventsTab`, `InvitesTab`, `EmailTab`, `SmsTab`, `BackupsTab`, `ThemesTab`, plus `ThemePresetModal`, `CreateUserModal`, `AdminSidebar`, `AdminMobileDrawer`, and shared `types.ts`). `AdminClient.tsx` remains the state-owning orchestrator (~1,120 lines) with an unchanged import path, keeping all hooks, handlers, and URL-tab sync in place.

### Self-Service Account Deletion Revocation & Admin Override [PR #234](https://github.com/joe-cole1/rsvp-to-me/pull/234)

- [x] **[UX-01] Account Deletion Revocation**: Added a "Cancel Deletion Request" button on the host Profile page, implemented the `cancelMyAccountDeletion` server action, and updated host FAQs.
- [x] **Admin Deletion & Anonymization UI**: Displayed deletion request details on the Admin panel, allowed admins to bypass the 30-day grace period and delete/anonymize users immediately with warning prompts, and added role and status filter dropdowns to the Admin Users tab.
- [x] **[SEC-33] Missing Cron locks on Backups & Deletions**: Implemented a reusable Redis-based distributed lock check (`runWithLock` helper) with local database-backed locking fallback. Wrapped in-process backup and deletion tasks with it.

### Admin Promotion Guard Bypass

- [x] **[SEC-32] Admin Promotion Guard Bypass**: Consolidated the `INITIAL_ADMIN_EMAIL` auto-promotion logic into a single helper (`promoteInitialAdmin` in `lib/admin-promotion.ts`) and enforced the `adminCount === 0` check consistently across all entry points, removing the privilege escalation vulnerability on the dashboard page.

### Phone Number Normalization [PR #233](https://github.com/joe-cole1/rsvp-to-me/pull/233)

- [x] **[BUG-01] Phone Number Normalization Inconsistency**: Imported and applied `normalizePhone` in `createAdminUser`, `inviteGuest`, and `inviteFriendAsGuest` before executing database queries or creations to prevent duplicate user rows and broken sign-in lookups.

### components/event/EventPage.tsx God-File Split [PR #232](https://github.com/joe-cole1/rsvp-to-me/pull/232)

- [x] **[L-3] God-file split (components/event/EventPage.tsx)**: Split the ~4,747 line `components/event/EventPage.tsx` into smaller, props-driven section components under `components/event/event-page/` (e.g., `BackgroundDecorations`, `EventHero`, `InfoSectionsBlock`, `RsvpSection`, `PendingApprovals`, `GuestListSection`, `ActivityFeed`, etc.) to improve maintainability and clean up the component hierarchy.

### app/actions/event.ts God-File Split [PR #231](https://github.com/joe-cole1/rsvp-to-me/pull/231)

- [x] **[L-3] God-file split (app/actions/event.ts)**: Split the ~2,273 line `app/actions/event.ts` into feature-specific modules under `app/actions/event/` (such as `rsvp.ts`, `invites.ts`, `blasts.ts`, `polls.ts`, `potluck.ts`, `settings.ts`, etc.) and re-exported them through a central barrel file to preserve existing import paths.

### Low-Priority Audit Cleanups [PR #221](https://github.com/joe-cole1/rsvp-to-me/pull/221)

- [x] **[L-2] Shared Blast Filter Helper**: Extracted a shared `buildRsvpStatusFilter` helper in `lib/blastFilters.ts` to deduplicate logic between email and SMS blast builders.
- [x] **[L-4] Swallowed Error Logging**: Funneled 25+ silent `.catch(() => {})` error-swallowing sites through a shared `logSafe` helper at debug level to preserve diagnostics.
- [x] **[L-5] Write-Only Twilio Token Check**: Verified the masked Twilio token is never returned decrypted to the admin client and kept the field strictly write-only.
- [x] **[L-7] Bounded Event Slug Collision retry**: Capped the sequential search probe for unique event slugs at 10, falling back to CSPRNG hex suffixes with growing entropy.

### Host/Co-Host AuthZ Consolidation [PR #220](https://github.com/joe-cole1/rsvp-to-me/pull/220)

- [x] **[SEC-30 / M-7] Co-host Authorization**: Consolidated all event mutation authorization guards into shared `assertHost` and `assertHostOrCohost` helpers, consistently enforcing permissions across all event actions and enabling co-host access as promised.
- [x] **[L-1] Info Section Updates**: Hardened `updateInfoSection` to only update the title when it is explicitly supplied, resolving a bug where editing a section could null its title.

### Health Endpoint Hardening [PR #219](https://github.com/joe-cole1/rsvp-to-me/pull/219)

- [x] **[SEC-31 / M-8] Health Endpoint Leak**: Restricted `/api/health` from leaking migration/DB status details to anonymous users, returning a minimal liveness body unless authenticated with a `HEALTH_CHECK_TOKEN`.

### Docker & Compose Security [PR #218](https://github.com/joe-cole1/rsvp-to-me/pull/218)

- [x] **[SEC-25 / H-4] Compose Secrets & Internal Ports**: Enforced `${VAR:?}` compose variables to require explicit passwords on startup and removed host-exposed ports for PostgreSQL/Redis to restrict access to internal Docker networks only.
- [x] **[L-6] Obvious Invite Code Placeholder**: Changed the default `.env.example` invite code to a placeholder rejected by the startup checks in production environments.

### Security Audit Hardening [PR #217](https://github.com/joe-cole1/rsvp-to-me/pull/217)

- [x] **[SEC-22 / H-1] Safe rate-limiting client IP**: Fixed client IP detection in `lib/clientIp.ts` by defaulting to loopback / local IP unless explicitly configuring a header via `TRUSTED_IP_HEADER`, preventing rate limit bypass via custom forwarding headers.
- [x] **[SEC-23 / H-2] Rate-limiting addRSVP**: Throttled unauthenticated RSVP creation per IP and per event+IP to prevent SMS/email bombing and Twilio cost exploitation.
- [x] **[SEC-24 / H-3] Secret editToken guest authz**: Hardened unauthenticated guest action routes (comments, polls, potluck) by validating a secret `editToken` rather than public `rsvpId`/`guestName` pairs.
- [x] **[SEC-26 / M-1] Twilio Token Decryption**: Corrected a check looking for a nonexistent `"enc:"` prefix, resolving a bug where DB-configured Twilio auth tokens were not decrypted correctly.
- [x] **[SEC-27 / M-2] Webhook DB Token Validation**: Enhanced Twilio webhook signature checks to use the decrypted dynamic database token instead of falling back only to the environment variable.
- [x] **[SEC-28 / M-4] CSPRNG editTokens**: Replaced predictable `cuid()` database defaults for RSVPs with CSPRNG-backed v4 UUIDs for all guest edit tokens.
- [x] **[SEC-29 / M-6] inviteGuest Rate Limits**: Implemented batch caps (max 200) and hourly rate limiting for host invites to restrict Twilio cost risks.

### Interactive Documentation Dashboard [PR #203](https://github.com/joe-cole1/rsvp-to-me/pull/203)

- [x] **Admin Documentation tab**: The operator guides are readable inside the app as the last tab of the **Admin Panel** (`/admin?tab=docs`), gated to ADMIN only (the panel itself is admin-gated). Rendered by `components/admin/DocsPanel.tsx` with `react-markdown` + `remark-gfm` (tables), `rehype-slug` (anchors), and `rehype-highlight` (syntax-highlighted code); category sidebar + full-text search; relative cross-links resolve within the panel.
- [x] **Frontmatter-driven, folder-based structure**: Guides live under `docs/<audience>/` (`docs/admin/` for operator guides, `docs/host/` for host guides). Each `.md` carries YAML frontmatter (`title`, `description`, `category`, `audience`, `order`); `lib/docs.ts` scans the folder and reads frontmatter — there is **no central registry** to maintain. Adding a guide = drop a `.md` with frontmatter. The Dockerfile copies the whole `docs/` tree so guides ship in the image. Covered by `tests/lib/docs.test.ts`; convention documented in AGENTS.md "In-App Documentation Sync Rule".
- [x] **Host-facing Help & Guides portal**: A reader at `/help` (linked from the profile dropdown, shown to HOST + ADMIN, guests redirected) renders the `docs/host/` guide set via `loadDocs("host")` and the shared `components/docs/DocsPanel.tsx`. The 11 host guides cover getting started, creating/customizing events, visibility, invitations, RSVPs, the guest list, messaging/reminders, polls/potluck/comments, co-hosting, and an FAQ.

### Security Hardening — Atomic RSVP Capacity Enforcement [PR #217](https://github.com/joe-cole1/rsvp-to-me/pull/217)

- [x] **[SEC-12] Race condition in RSVP capacity check**: `addRSVP` (`app/actions/event.ts`) previously ran `rSVP.count()` (check) and `rSVP.create()` (act) as separate queries with nothing between them, so two simultaneous GOING submissions could both pass a stale count and overbook the event. The re-count and the RSVP write now run inside a per-event Redis lock (`withEventCapacityLock` in `lib/capacityLock.ts`, mirroring the cron sync-lock pattern), so the count immediately precedes the write within one critical section. Lock acquisition retries with a short backoff so concurrent legitimate RSVPs serialize rather than being rejected; if Redis is unavailable it falls back to running without the lock. Regression test: `tests/regression/sec-12-rsvp-capacity-race.test.ts`.
- [x] **[SEC-21b] `updateRSVP` skipped deadline/capacity re-check**: a token-holding guest could flip their status to `GOING` after `rsvpDeadline` had passed or past `capacity` (a capacity-bypass cousin of SEC-12). `updateRSVP` now re-validates the deadline (declining to `NO` is still always allowed so guests can cancel late) and enforces capacity under the same per-event lock — but only when the RSVP is actually transitioning _into_ a GOING seat, so note edits and downgrades on an already-GOING RSVP are never blocked. Regression test: `tests/regression/sec-21b-updaterspv-capacity-deadline.test.ts`.

### Security Hardening — Comment AuthZ & Cross-Event Threading [PR #195](https://github.com/joe-cole1/rsvp-to-me/pull/195)

- [x] **[SEC-17] Comment authZ bypass + identity spoofing**: `addComment` (`app/actions/event.ts`) now authorizes the author and derives the stored display name server-side. Host/co-host/admin may comment freely; a guest with a **pending** (unapproved) RSVP is blocked; a logged-in user with no RSVP may comment on **PUBLIC/UNLISTED** events (they are publicly viewable) but is blocked on **PRIVATE** events — closing the PRIVATE-event authZ bypass. The stored name comes from the user record or the matched approved RSVP row — never the client `guestName` — closing the impersonation vector. Regression test: `tests/regression/sec-17-comment-authz-spoofing.test.ts`.
- [x] **[SEC-13] Cross-event parent comment**: replies now resolve the parent with `where: { id: parentId, eventId: data.eventId }` and reject if it isn't found, so a reply can't thread under a comment from a different event. Regression test: `tests/regression/sec-13-cross-event-parent-comment.test.ts`.
- [x] **Approved-guest participation UI**: the event page now reflects the server rule across comments, polls, and potluck — pending (unapproved) guests see an "awaiting host approval" notice instead of dead controls, and an admin commenting on an event they aren't RSVP'd to sees a notice. `approved` is threaded from `app/e/[slug]/page.tsx` through to `EventPage`.

### Security Hardening — Injection Escaping [PR #194](https://github.com/joe-cole1/rsvp-to-me/pull/194) · [PR #199](https://github.com/joe-cole1/rsvp-to-me/pull/199)

- [x] **[SEC-11] XML injection in Twilio webhook**: Added an `escapeXml()` helper in `app/api/webhooks/twilio/route.ts` and applied it inside `twiml()`, so user-controlled strings (event titles, guest names) can no longer break out of the `<Message>` element to inject arbitrary TwiML. Regression test: `tests/regression/sec-11-twilio-xml-injection.test.ts`.
- [x] **[SEC-16] CSV formula injection in guest export**: Hardened the `esc()` helper in `app/e/[slug]/guests.csv/route.ts` to prefix any cell beginning with `= + - @`, tab, or CR with a single quote before quoting, neutralizing spreadsheet formula evaluation of attacker-controlled `guestName`/`guestEmail`. Regression test: `tests/regression/sec-16-csv-formula-injection.test.ts`.
- [x] **[SEC-19] Rate limiting on event-password verification**: `verifyEventPassword` in `app/actions/event.ts` is now gated by `rateLimit("event-pw:<slug>:<ip>", 10, 600)`, short-circuiting brute-force attempts before any DB lookup or bcrypt compare. The private `getClientIp()` helper was extracted from `app/actions/auth.ts` into the shared `lib/clientIp.ts` and reused by both call sites. Regression test: `tests/regression/sec-19-event-password-rate-limit.test.ts`.
- [x] **[SEC-20] Mass assignment in `saveEventSettings`**: Added `SaveEventSettingsSchema` (explicit Zod allow-list) in `lib/schemas.ts`; `saveEventSettings` now parses `settings` through it before the `db.event.update`, stripping non-allow-listed columns (`status`, `slug`, `hostId`, …) so they can't be smuggled into the write. Regression test: `tests/regression/sec-20-save-event-settings-mass-assignment.test.ts`.
- [x] **[SEC-18] Uncapped outbound email/SMS via guest invite**: `inviteFriendAsGuest` (`app/actions/event.ts`) was authorized solely by a guest `editToken` and fanned out to SMTP/Twilio with no throttling, so a single token could drive unlimited email/SMS to arbitrary recipients (spam/phishing + Twilio cost). Now gated by the shared `rateLimit()`/`getClientIp()` helpers (same pattern as SEC-19/auth) with three layers: per-IP burst (`guest-invite:ip:<ip>`, 30/hr — checked before any DB lookup so it also throttles invalid-token enumeration), per-token burst (`guest-invite:token:<editToken>`, 10/10min), and a per-RSVP daily cap (`guest-invite:rsvp:<rsvpId>`, 20/24h). The token/RSVP limits are consumed only after the token is validated, authorized, and the target address is well-formed, so legitimate rejections don't burn the cap. Regression test: `tests/regression/sec-18-guest-invite-rate-limit.test.ts`.

### Notification Preferences [PR #189](https://github.com/joe-cole1/rsvp-to-me/pull/189)

- [x] **`prisma/schema.prisma`**: Added `NotificationChannel` enum (`EMAIL | SMS | BOTH`, default `BOTH`) and `notificationChannel` field on `User`.
- [x] **Migration** (`20260626000000_add_notification_channel`): `CREATE TYPE "NotificationChannel"` and `ALTER TABLE "User" ADD COLUMN "notificationChannel"`.
- [x] **`app/actions/profile.ts`**: Extended `updateNotificationSettings()` to accept and persist optional `notificationChannel`. Added `notificationChannel` to `getUserProfile()` select.
- [x] **`app/actions/event.ts`**: `addEventUpdate()` now queries guest `notificationChannel` and routes each notification — `SMS` → phone/SMS, `EMAIL`/`BOTH`/anonymous → email.
- [x] **`app/(app)/profile/ProfileClient.tsx`**: Renamed "Notification Opt-Outs" → "Notification Preferences". Added pill-button channel selector (Email / SMS / Both) shown only when both `channelConfig.email` and `channelConfig.sms` are enabled. Saves immediately on click via `handleChannelChange`.

### Guest Messaging Channel Toggles [PR #181](https://github.com/joe-cole1/rsvp-to-me/pull/181)

- [x] **`lib/config.ts`**: New `getChannelConfig()` (`React.cache`-wrapped) and `isChannelEnabled()` helpers. Reads `email_enabled`, `sms_enabled`, and `twilio_account_sid` from `SystemConfig` in a single DB query per request. `sms_enabled` auto-defaults to `true` when Twilio credentials are present, `false` otherwise. `email_enabled` defaults to `true`.
- [x] **Send-path gating**: Guest-facing email functions (`sendRsvpConfirmationEmail`, `sendEventInviteEmail`, `sendBlastEmail`, `sendApprovalEmail`) gated by `email_enabled`. All SMS functions gated by `sms_enabled`. Host auth (`sendMagicLinkEmail`), host alerts (`sendHostRsvpAlertEmail`), and admin emails (`sendWelcomeEmail`) are immune to both toggles.
- [x] **`getSystemConfig()` defaults**: Two new keys added in `app/actions/admin.ts` with Twilio auto-detection for `sms_enabled`.
- [x] **Admin UI** (`AdminClient.tsx`): Toggle cards at the top of the Email and SMS tabs. Labels: "Guest Email Notifications" and "SMS Notifications". Helper text clarifies that host functions are unaffected.
- [x] **RSVP form** (`RsvpFlow.tsx`): Phone field hidden when SMS is disabled.
- [x] **Event page / HostBar**: Invite form placeholder adapts to enabled channels. Invite form and Message Guests blast panel hidden when both channels are off. Individual Email/SMS delivery-channel checkboxes hidden when their respective channel is disabled.
- [x] **Event settings** (`SettingsPage.tsx`): Reminder toggles (email and SMS independently) hidden when the corresponding channel is disabled. Reminders section hidden entirely when both are off.
- [x] **Profile** (`ProfileClient.tsx`): Phone number field hidden when SMS is disabled. Notification Opt-Outs section hidden when both channels are off; individual email/SMS opt-out toggles hidden per channel.
- [x] **Both disabled = pure RSVP mode**: Guests fill out forms and hosts see a guest list — no outbound messaging of any kind. All host auth and admin functions continue to work normally.
- [x] **Unit tests** (`tests/lib/config.test.ts`): 10 tests covering default behavior, Twilio auto-detection, explicit overrides, and `isChannelEnabled` for both channels.
- [x] **Docs updated**: `docs/admin.md`, `docs/features.md`.

### Defensive Infra — Graceful Shutdown, Error Boundaries & Auth Fallback Alerts [PR #186](https://github.com/joe-cole1/rsvp-to-me/pull/186)

- [x] **[G-2] Graceful Shutdown Signal Handling**: `lib/cron-scheduler.ts` now captures all `cron.schedule()` task references and exports `stopInProcessCron()`. `instrumentation.ts` registers `SIGTERM`/`SIGINT` handlers that call `stopInProcessCron()` and exit cleanly. Dockerfile CMD updated to `exec ./node_modules/.bin/next start` so SIGTERM lands on Node.js (not the shell). `docker-compose.yml` adds `stop_grace_period: 30s` to allow in-flight requests to drain before SIGKILL.
- [x] **[G-4] React Error Boundaries**: Added `app/global-error.tsx` (catches root layout failures — renders own `<html>/<body>`), `app/error.tsx` (root-level route catch-all), and `app/(app)/error.tsx` (scoped boundary for authenticated app routes). All styled to match the dark APP_SHELL theme with a retry button and a home/dashboard link.
- [x] **Auth Fallback Alerts**: `sendMagicLinkAction` in `app/actions/auth.ts` now wraps email/SMS delivery in try/catch and returns `{ error: "delivery_failed" }` on failure. `SignInForm.tsx` handles this with a dedicated UI state pointing self-hosters to `[auth:magic-link-fallback]` in the container logs.

### Admin: Create User [PR #185](https://github.com/joe-cole1/rsvp-to-me/pull/185)

- [x] **Create User modal**: Added a "Create User" button to the Admin → Users tab that opens a modal form (name, email, phone, role). Validates email format and uniqueness, checks phone uniqueness if provided. After creation, generates a 48-hour magic token and sends a welcome email (`sendWelcomeEmail` in `lib/email.ts`) so the new user can sign in immediately. Email failure is non-blocking — user creation succeeds regardless. Server action `createAdminUser` in `app/actions/admin.ts` is admin-gated via `assertAdmin()`.

### Code Quality Sweep — Prettier, Session Dedup & Profile Nav [PR #175](https://github.com/joe-cole1/rsvp-to-me/pull/175) · [PR #176](https://github.com/joe-cole1/rsvp-to-me/pull/176)

- [x] **Prettier Formatting**: Added Prettier v3 as a devDependency with `.prettierrc` (double quotes, semis, 100-char printWidth) and `.prettierignore`. Ran `prettier --write` across the full codebase as a one-time prep commit. `npx prettier --check .` added to `ci.yml` to enforce formatting on every PR.
- [x] **`getSessionUser()` deduplication**: Replaced all remaining `getSession()` + `db.user.findUnique(session.userId)` duplicates with the existing `React.cache`-wrapped `getSessionUser()` helper across 6 files: `app/e/[slug]/page.tsx`, `app/e/[slug]/rsvp/page.tsx`, `app/e/[slug]/settings/page.tsx`, `app/e/[slug]/guests.csv/route.ts`, `app/actions/createEvent.ts`, and `app/actions/profile.ts`.
- [x] **Profile Nav Reactive Update**: Added `router.refresh()` call in `ProfileClient.tsx` after a successful profile save, so the layout re-runs `getSessionUser()` and the `ProfileDropdown` name/avatar updates immediately without a full page reload.
- [x] **Shared App Router layout**: Dashboard, admin, and profile pages migrated to a single route-group `layout.tsx` — per-page nav boilerplate eliminated.
- [x] **Global nav unified**: `AppNavLogo` / `ProfileDropdown` consistent across event page, RSVP flow, guests page, and settings page — all `AppShell` outliers resolved.

### Database Migration Hardening [PR #169](https://github.com/joe-cole1/rsvp-to-me/pull/169)

- [x] **[CRIT-1] `migrate-db.js` crash loop**: 3-attempt retry with backoff; P3009 detected and logs actionable `prisma migrate resolve` command; `docker-compose.yml` app service changed to `restart: on-failure:3`.
- [x] **[CRIT-2] Pre-migration database snapshot**: `pg_dump` via `execFileSync` (no shell) to `data/backups/pre-migration/` with timestamp before every migration run. Failure warns but never blocks the deploy.
- [x] **[CRIT-3] Health endpoint migration state check**: Queries `_prisma_migrations` for pending/stuck rows; returns 503 + `{ status: "degraded", migrations: "pending" }` if any found. 7 new tests added to `tests/api/health.test.ts`.
- [x] **Failing Test Suite**: Unit tests in `tests/actions/event.test.ts` (potluck item claims) and `tests/actions/rsvpfields.test.ts` (`reorderRsvpFields`) confirmed resolved. Full suite: 535 tests passing across 31 files.

### Security Hardening — Passwords, Backup & CSV [PR #163](https://github.com/joe-cole1/rsvp-to-me/pull/163) · [PR #164](https://github.com/joe-cole1/rsvp-to-me/pull/164)

- [x] **[SEC-5] Event passwords stored in plaintext**: `passwordHash` column added (bcryptjs, cost 10); `verifyEventPassword` uses `bcrypt.compare`; `saveEventSettings` hashes on write. Migration `20260624200000_rename_event_password_to_hash`.
- [x] **[SEC-6] `pg_dump` command injection**: Switched to `execFile('pg_dump', [...])` with explicit argument array in `lib/backup.ts` — no shell invocation.
- [x] **[SEC-7] CodeQL SSRF scanner bypass**: Removed `safeFetch` obfuscation (`String.fromCharCode` pattern) from `lib/email.ts`; GitHub Security alerts dismissed as false positives.
- [x] **[SEC-10] Co-hosts excluded from guest CSV**: `app/e/[slug]/guests.csv/route.ts` now mirrors the `assertHostOrCohost` pattern, granting co-hosts and admins download access.

### Security Fixes — IDOR & Auth Gaps [PR #161](https://github.com/joe-cole1/rsvp-to-me/pull/161)

- [x] **[SEC-1] `getDashboardActivity` IDOR**: Scoped `eventIds` to only events the caller owns or is a co-host/RSVP member of (`app/actions/event.ts`).
- [x] **[SEC-2] `reorderRsvpFields` IDOR**: Added `eventId` guard to prevent hosts from reordering fields belonging to other events.
- [x] **[SEC-3] `addComment` unauthenticated**: Enforced valid session or verified `editToken`/`rsvpId` check before inserting comments.
- [x] **[SEC-4] `claimPotluckItem` / `unclaimPotluckItem` unauthenticated**: Gated potluck claim creation and removal behind a valid `editToken` or host session.

### GitHub Release Workflow [PR #153](https://github.com/joe-cole1/rsvp-to-me/pull/153)

- [x] **GitHub Actions release automation**: Automated release tagging, version increments, and changelog generation on merge to main.

### Admin Theme Manager [PR #130](https://github.com/joe-cole1/rsvp-to-me/pull/130)

- [x] **Admin Theme Manager**: Admin settings page for dynamic theme creation — create/edit/delete themes, configure base style, accents, gradients, decorations, visibility, titles, and descriptions.

### Admin UX & Host Account Deletion [PR #135](https://github.com/joe-cole1/rsvp-to-me/pull/135)

- [x] **Admin Settings History & Refresh**: Active admin tab is synced to the URL (`/admin?tab=backups`) via `useSearchParams` + `router.replace`. Browser back/forward and page refresh all preserve the selected tab.
- [x] **Backup Schedule Picker**: Replaced raw cron text input (Admin → Backups) with a preset dropdown (Disabled, Hourly, Every 6h, Daily, Every 3 days, Weekly). A "Custom" option reveals the raw input for advanced cron expressions.
- [x] **Host Account Deletion Flow**: Hosts can delete their account from Profile settings. Upcoming published events must be explicitly deleted first (each shows a "Delete event" button; deleted events show a tombstone page at their original URL). After clearing events, the host types "DELETE" to confirm. Account is signed out immediately and anonymized within 24 hours. Admins see a "Deletion Pending" badge in the Users tab and can cancel within the window. Past events are reassigned to a SYSTEM tombstone user; guest RSVP/comment data for past events is preserved.

### Favicon & Page Titles [PR #123](https://github.com/joe-cole1/rsvp-to-me/pull/123)

- [x] **Root Layout Metadata**: Replaced `"Create Next App"` placeholder with branded title template (`"%s | RSVP to Me"`), real description, and Open Graph site defaults.
- [x] **Dynamic Event Metadata**: Added `generateMetadata` to `/e/[slug]` (title + OG cover image), `/e/[slug]/rsvp`, `/e/[slug]/settings`, and `/e/[slug]/guests`.
- [x] **Static Page Titles**: Added `metadata` exports to home, sign-in, register, dashboard, and new-event pages.
- [x] **Branded Favicon Set**: Added `app/icon.svg` (stylized "R", brand purple), `app/apple-icon.tsx` (180×180 ImageResponse PNG), and `public/site.webmanifest` for PWA/bookmark support.

### Event Page Bugs & RSVP Enhancements [PR #105](https://github.com/joe-cole1/rsvp-to-me/pull/105)

- [x] **Location Selector**: Implemented a responsive `LocationSelector` client component with PHYSICAL, VIRTUAL, and TBD types for event creation.
- [x] **Potluck Quantity Input**: Corrected quantity input behavior to allow temporary empty values for custom typing.
- [x] **Deep Linking Navigation**: Implemented smooth anchor scrolling behavior for target hashes (e.g. `#polls` and `#potluck`).
- [x] **Pending RSVP Management**: Added a "Pending Approval" filter tab on the guest list and updated stats headers for hosts to approve/decline RSVPs.
- [x] **Event Page Section Reordering**: Moved Polls and Potluck sections below the RSVP/sharing containers to improve hierarchy.
- [x] **RSVP "Next Actions"**: Added interactive "Next Steps" suggestions on the RSVP success screen to prompt voting and potluck contributions.
- [x] **Private Event Invitations**: Configured "guests can invite" settings and added the `inviteFriendAsGuest` server action to generate pending RSVPs.

### Core Platform Setup [PR #1](https://github.com/joe-cole1/rsvp-to-me/pull/1)

- [x] **Next.js 16 + Prisma 7 + SQLite Core**: Database schemas, seeds, and App Router structure.
- [x] **Magic Link Authentication**: Authentication mechanism via iron-session cookies.
- [x] **Seeding & Mock Data**: Automated test seeding of events, comments, and RSVPs via `SEED_TEST_DATA=true`.

### Event & Guest Engagement [PR #55](https://github.com/joe-cole1/rsvp-to-me/pull/55) · [PR #56](https://github.com/joe-cole1/rsvp-to-me/pull/56)

- [x] **Interactive Event Polls**: Anonymous voting, host controls, write-in suggestions, and vote audits.
- [x] **Comment Threading & Activity Feed**: Nested replies, activity log pagination, and user roles.
- [x] **WYSIWYG Host Controls**: Floating overlays and preview toggles (`?preview=1`) for event owners.

### Integrations & Diagnostics [PR #62](https://github.com/joe-cole1/rsvp-to-me/pull/62) · [PR #72](https://github.com/joe-cole1/rsvp-to-me/pull/72)

- [x] **SMTP & Cloudflare Workers**: Support outbound sending via custom worker or mail server.
- [x] **Setup Wizards**: Generate secrets, pre-fill Cloudflare subdomains, and toggle visibility.
- [x] **Email Diagnostics & Safety**: Connection-testing suite in `/admin`, SSRF validation checks, and console auth lockout safety fallbacks.
- [x] **Cloudflare Email Service Migration**: Upgraded Cloudflare Worker integration from Email Routing (`SEND_EMAIL`) to the newer Cloudflare Email Service (`EMAIL`), enabling transactional emails to arbitrary external recipients.
- [x] **Cloudflare Email REST API Option**: Direct transactional email sending using the v4 Cloudflare Accounts endpoint, with visual settings guides, DMARC warnings, and secrets masking.

### UI/UX Polish & Messaging Redesign [PR #77](https://github.com/joe-cole1/rsvp-to-me/pull/77)

- [x] **Event Settings Reorganization**: Split Polls and Potluck configurations into dedicated sub-setting sections, reordered categories (Hosts, Display, RSVP, Theme, Reminders, Polls, Questionnaire, Potluck), and added back-button state persistence.
- [x] **Message Guests Redesign**: Updated to support multi-select recipient filters (All, Invited, Yes, Maybe, No), checkboxes for delivery channels (Email/SMS), and a single Send button at the bottom. Toggling "All" deselects others, and selecting any other filter deselects "All".
- [x] **Host Control Panel & Cover Refinement**: Added hover highlight effects to all floating menu items and removed the redundant Theme picker button from the cover image.
- [x] **Activity Updates Labeling**: Updated "Notify guests via email" to "Notify guests of update" to support multiple notification channels.
- [x] **TS/ESLint Quality Sweep**: Cleared all errors and warnings across the app (including dynamic avatar img element warnings).

### Unified Dashboard & Image Refactoring [PR #79](https://github.com/joe-cole1/rsvp-to-me/pull/79)

- [x] **Unified Guest/Host Dashboard**: Opened `/dashboard` to guest users, showing active invitations, co-host overlaps, and comment activity counts.
- [x] **Partiful-style Grid Layout**: Implemented square cover photo layouts, overlay badges, search and pill-style filter tabs.
- [x] **RSVP Auto-linking Utility**: Created background process to merge/link guest RSVPs automatically during registration and login.
- [x] **Next.js Image Refactoring**: Replaced all raw `<img>` tags codebase-wide with Next.js `<Image>` / `<NextImage>` component, removing all `@next/next/no-img-element` overrides.

### UI/UX Polish & Potluck Multi-Claim Refactor [PR #82](https://github.com/joe-cole1/rsvp-to-me/pull/82)

- [x] **Potluck Multi-Claim Refactoring**: Shifted to a relational `PotluckClaim` schema model to support multiple claimants per item. Built backend controllers, mock data seeds, and unit tests, and designed a nested claimant visual UI with unclaiming actions.
- [x] **Dashboard Recent Activity Filters**: Added interactive filtering by event and action type to the dashboard activity log. Implemented day-level grouping headers and initials badge avatars.
- [x] **Unified Top Navigation**: Integrated `AppNavLogo` and `ProfileDropdown` menus into the event page header, unifying navigation bars codebase-wide, and removing the redundant top-nav settings button.
- [x] **Location Selector Layout Polish**: Prevented layout wrapping of option chips and corrected width scaling for the Physical/Virtual popover edit views to align with other card components.
- [x] **Questionnaire Serialization Fix**: Resolved select/checkbox option parsing bugs on RSVP forms by standardizing field config storage as JSON strings.

### PostgreSQL 18 Hard Requirement & SQLite Removal [PR #139](https://github.com/joe-cole1/rsvp-to-me/pull/139) · [PR #142](https://github.com/joe-cole1/rsvp-to-me/pull/142) · [PR #143](https://github.com/joe-cole1/rsvp-to-me/pull/143)

- [x] **Drop SQLite / Hard-Require PostgreSQL 18**: Removed all SQLite/LibSQL dependencies (`@libsql/client`, `@prisma/adapter-libsql`). `schema.prisma` is now the single Postgres schema. `REDIS_URL` throws at startup if unset. Squashed 5 incremental Postgres migrations into a single clean `20260623000000_init` migration. Updated CI to use a `postgres:18-alpine` service. Updated all docs, `docker-compose.dev.yml`, `.env.example`, `AGENTS.md`, and `tests/setup.ts`.
- [x] **node-redis v4 → v5 → v6 upgrade**: Two-hop upgrade (v4→v5 in PR #139, v5→v6 in PR #142). Updated RESP3 multi-exec result handling and TypeScript types throughout `lib/redis.ts`.

### PostgreSQL, Redis, In-Process Cron & UX Sweep [PR #94](https://github.com/joe-cole1/rsvp-to-me/pull/94) · [PR #97](https://github.com/joe-cole1/rsvp-to-me/pull/97) · [PR #98](https://github.com/joe-cole1/rsvp-to-me/pull/98)

- [x] **PostgreSQL & Redis Integrations**: Dynamic runtime database selection (SQLite/PostgreSQL), dual Prisma schema generation, connection pooling, Redis session caching, atomic rate-limiting, and Redis-based distributed cron synchronization locks.
- [x] **In-Process Cron Scheduler**: Migrated background tasks (automated DB backups and event reminders) to run in-process using Next.js 16's `instrumentation.ts` bootstrap, eliminating the dedicated `cron` container.
- [x] **Docker Image Healthcheck**: Integrated a lightweight native HTTP healthcheck into the `Dockerfile` and cleaned up compose configs.
- [x] **Dynamic Twilio SMS Config**: Implemented system configurations for Twilio SID, token encryption, and SMS blast capabilities, with connection testing in `/admin`.
- [x] **Responsive Mobile Admin Drawer**: Added sliding hamburger drawer navigation for mobile screens in the admin panel.
- [x] **Public Event Feed & Private Gating**: Rendered top 20 upcoming public events on the home page and gated unlisted/private events appropriately.
- [x] **UI/UX & Form Polish**: Split date/time edit inputs, grouped RSVP options, fixed copy link buttons, and placed toast notifications fixed at the top of the viewport.

### Theme Presets, Readability & Slug Collision Resolution [PR #108](https://github.com/joe-cole1/rsvp-to-me/pull/108)

- [x] **Theme Presets & Grids**: Implemented searchable/filterable preset grids, date-based dynamic sorting, light accent contrast improvements, and settings-preview parity.
- [x] **Event Slug Collision Resolution**: Verified automatic suffixing (e.g., appending `-1`, `-2`) during slug generation in `lib/slug.ts` when two events share the same name.

### RSVP Notification Toggles [PR #114](https://github.com/joe-cole1/rsvp-to-me/pull/114)

- [x] **Per-Event Notification Toggles**: Added 6 per-event boolean toggles under Event Settings → RSVP Options → Notification Settings: guest confirmation email/SMS on RSVP submission, host RSVP alert email/SMS (new — hosts are notified with guest name, status, note, and headcount), and approval notification email/SMS when a host approves or declines a pending RSVP. All default to on to preserve existing behavior.

### INVITED Status + Email RSVP Buttons + SMS Reply-to-RSVP [PR #151](https://github.com/joe-cole1/rsvp-to-me/pull/151)

- [x] **INVITED RSVPStatus Enum**: Added `INVITED` to `RSVPStatus` (alongside `GOING`, `MAYBE`, `NO`). Host-invited guests now carry an INVITED RSVP instead of a phantom GOING one, eliminating false "going" counts before guests respond.
- [x] **Email RSVP Buttons**: Replaced single "RSVP Now" button in invite emails with three colored anchor buttons — Going (green), Maybe (amber, hidden when `maybeEnabled = false`), Can't Go (red). Each links to `/e/{slug}/rsvp?token={editToken}&status=GOING|MAYBE|NO`, pre-selecting the response on the RSVP edit form. Guest still confirms name/questionnaire before submitting.
- [x] **SMS RSVP Reply Webhook**: Invite SMS now prompts guests to reply YES / NO / MAYBE. `POST /api/webhooks/twilio` validates the Twilio HMAC signature, looks up the pending invitation by phone number (no event code required), and updates the RSVP. Edge cases handled: past deadline, maybe-disabled events, capacity full, multiple pending invitations (disambiguation).
- [x] **Deduplication in addRSVP**: If a guest with an INVITED RSVP submits via the event page form, the existing RSVP is updated rather than a duplicate being created.
- [x] **Private Event Sign-in CTA**: Unauthenticated visitors to a private event now see a "Sign in to access" button linking to `/sign-in?redirect=/e/{slug}`.
