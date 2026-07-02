# RSVP to Me — Product Roadmap

This document outlines the short-term backlog, long-term ideas, and historical milestones of the **RSVP to Me** platform. It serves as our long-term reference for future features, unresolved issues, and product ideas.

---

## 🔴 Priority 1: High Priority (Bugs, UX Blockers & Core Fixes)

_Immediate attention items. High impact bugs, UX papercuts, and essential routing/data integrity fixes._

### 🛠️ Bugs & Blockers

_(No pending priority 1 bugs)_

### 🔒 Routing & System Safety

- ~~**[SEC-18] Uncapped outbound email/SMS via guest invite**~~ _(fixed — see Completed Milestones)_

#### 🛡️ Security Audit 2026-07 — Remediation Plan

_Full write-up with file:line references, fix snippets, and an architecture diagram lives in [`codebase-analysis-docs/REMEDIATION_PLAN.md`](./codebase-analysis-docs/REMEDIATION_PLAN.md). `STATE_BLOCK.md` (repo root) captures the architecture/data-flow context. Items are worked through one PR-checkpoint at a time; check off here as each lands with its regression test. Overlaps with already-deferred SEC-8 (static scrypt salt) and SEC-9 (CSP `'unsafe-inline'`) are cross-referenced, not duplicated._

**High**

- ~~**[SEC-22 / H-1] Spoofable IP for rate limiting**~~ _(fixed)_ — `lib/clientIp.ts` `getClientIp()` trusted `cf-connecting-ip` / `x-real-ip` / `x-forwarded-for` even when `TRUSTED_IP_HEADER` was unset, letting a client rotate `X-Forwarded-For` to mint fresh rate-limit keys and defeat the magic-link, registration, event-password (SEC-19), and guest-invite (SEC-18) limiters. Now default-deny: forwarding headers are consulted only when the operator names one via `TRUSTED_IP_HEADER`, and the **last** hop is used (not the client-controlled first entry); otherwise it falls back to loopback and identifier-keyed limits do the work. Regression test `tests/regression/sec-22-client-ip-spoofing.test.ts`; `docs/admin/configuration.md` updated (default-deny + set the header behind a proxy).
- ~~**[SEC-23 / H-2] Unauthenticated `addRSVP` fan-out with no throttle**~~ _(fixed)_ — `app/actions/event.ts` `addRSVP` (callable by anyone on PUBLIC/UNLISTED events) upserted a `User` from the supplied address and emailed/SMS-ed it with no `rateLimit()` — an email/SMS bomb + Twilio-cost vector. Now throttled before any DB write or send: per IP (`rsvp:ip:<ip>`, 15/10min) and per event+IP (`rsvp:evt:<id>:<ip>`, 8/10min), mirroring SEC-18/SEC-19. Regression test `tests/regression/sec-23-addrsvp-rate-limit.test.ts`; docs updated (`docs/admin/configuration.md` rate-limited surfaces, `docs/host/managing-rsvps.md` anti-abuse note).
- ~~**[SEC-24 / H-3] Guest identity spoofable via public `rsvpId` + `guestName`**~~ _(fixed)_ — unauthenticated branches of `addComment`, `castVote`, `addPollOption`, `claimPotluckItem`, `unclaimPotluckItem` authorized by matching a supplied `rsvpId` + `guestName`, both shipped to every viewer in `app/e/[slug]/page.tsx` — so the check compared two public values and anyone could act as any approved guest (residual of SEC-3/4/17). Now a shared `findApprovedGuestByToken(editToken, eventId)` authorizes by the secret per-RSVP `editToken` and the stored name is derived from that row, never the client. Client call sites in `EventPage.tsx` pass `guestEditToken`; `AddCommentSchema` swaps `rsvpId` → `guestEditToken`. Regression test `tests/regression/sec-24-guest-identity-token.test.ts` (+ updated `tests/actions/polls.test.ts`). No docs/config/UX change (internal authz hardening; guests act exactly as before), so exempt from the docs-update rule per AGENTS.md.
- **[SEC-25 / H-4] Docker default creds + host-exposed DB/Redis ports** — `docker-compose.yml` falls back to literal `postgres_password_here` / `redis_password_placeholder` and maps 5432/6379 to the host. Fix: `${VAR:?required}` (fail fast) and drop production host port mappings. Admin-docs update.

**Medium**

- ~~**[SEC-26 / M-1] SMS Twilio token never decrypted**~~ _(fixed)_ — `lib/sms.ts` gated decryption on a `"enc:"` prefix that `encryptConfig` never emits, so a DB-configured (encrypted) Twilio token was passed as ciphertext and all admin-panel-configured SMS failed auth. Now a shared `resolveTwilioAuthToken()` decrypts via `decryptConfig()` (DB config first, then env), and `decryptConfig` fails closed — returns `""` instead of raw ciphertext on an undecryptable value (**M-5b**). Regression test `tests/regression/sec-26-sms-token-decrypt.test.ts` (+ updated `tests/lib/crypto.test.ts`).
- ~~**[SEC-27 / M-2] Twilio webhook validates only the env token**~~ _(fixed)_ — `app/api/webhooks/twilio/route.ts` `validateTwilioSignature` used `process.env.TWILIO_AUTH_TOKEN` only, so admin-panel-only Twilio setups rejected every inbound reply (fail-closed but silently broke reply-to-RSVP). Now resolves the token via the shared `resolveTwilioAuthToken()` (DB config → env). Regression test `tests/regression/sec-27-twilio-webhook-db-token.test.ts`; `docs/admin/sms.md` clarifies the inbound webhook uses the same (Admin-Panel or env) token.
- ~~**[SEC-28 / M-4] `editToken` uses `cuid()`, not a CSPRNG**~~ _(fixed)_ — `prisma/schema.prisma` RSVP.editToken defaulted to `cuid()` (timestamp + monotonic counter → partially predictable), yet it is the sole guest edit credential and a PRIVATE-event gate bypass and travels in URLs/SMS. Changed the default to `uuid(4)` — a CSPRNG-backed v4 UUID — which covers every create path (addRSVP, inviteGuest, inviteFriendAsGuest, seed) uniformly. It is a Prisma client-side default (not a DB DEFAULT), so **no migration is required**; existing rows keep their tokens. Regression test `tests/integration/actions/rsvp.test.ts` (real DB — the token is engine-generated) asserts new tokens are v4 UUIDs, not cuids. No docs/config/UX change (internal token-format hardening), exempt per AGENTS.md.
- ~~**[SEC-29 / M-6] Host `inviteGuest` has no rate limit or batch cap**~~ _(fixed)_ — `app/actions/event.ts` `inviteGuest` fanned out email/SMS per comma-separated entry with no bound and no `rateLimit()`, so an abusive/hijacked host session could drive spam blasts + Twilio cost. Now capped at 200 recipients per request and throttled per IP (`host-invite:ip:<ip>`, 15/hr) and per host+event (`host-invite:<userId>:<eventId>`, 10/hr), mirroring `inviteFriendAsGuest` (SEC-18). Regression test `tests/regression/sec-29-invite-guest-rate-limit.test.ts`; docs updated (`docs/admin/configuration.md`, `docs/host/inviting-guests.md`).
- ~~**[SEC-30 / M-7] Inconsistent host/co-host authorization**~~ _(fixed)_ — inline `hostId === session.userId || role === ADMIN` checks were re-implemented ~15× in `app/actions/event.ts`, and a dozen event mutations were host-only even though the UI and `docs/host/co-hosting.md` promise co-host access. Every event-scoped mutation now routes through the shared `assertHost` / `assertHostOrCohost` helpers: co-hosts can edit event fields/location/theme/dates, info sections, settings, reminders, cover image, potluck items, RSVP fields, updates, blasts, `inviteGuest`, and RSVP approve/decline/delete; `deleteHostEvent`, `addCoHost`, and `removeCoHost` deliberately stay host-only. Folds in **L-1**'s `updateInfoSection` fixes (co-host access + `title` no longer force-nulled). Regression test `tests/regression/sec-30-cohost-authz.test.ts` (+ updated `tests/actions/event.test.ts`, `tests/actions/cohosts.test.ts`, `tests/actions/rsvpfields.test.ts`, `tests/regression/sec-20`/`sec-29` fixtures); docs updated (`docs/host/co-hosting.md` capability list, `docs/admin/admin.md` co-host note).
- **[SEC-31 / M-8] Health endpoint leaks migration/DB state** — `app/api/health/route.ts` returns `{migrations: "pending"|"unreachable"}` unauthenticated. Fix: minimal 200/503 for anonymous callers; detailed body behind an internal token.
- **[M-3] CSP `script-src 'unsafe-inline'`** — already tracked as **SEC-9** (deferred, needs nonce middleware). No new entry.
- **[M-5a] Static scrypt salt** — already tracked as **SEC-8** (deferred; re-encryption migration required). No new entry.

**Low** (batch as a cleanup PR)

- ~~**[L-1]** `updateInfoSection` force-nulls `title` on every edit and skips co-host access~~ _(fixed with SEC-30 — title only written when supplied; co-host access via `assertHostOrCohost`)_.
- ~~**[L-2]** Duplicated blast-filter builder in `sendBlast` / `sendSmsBlast` → extract shared helper~~ _(fixed — shared `buildRsvpStatusFilter()` in `lib/blastFilters.ts`, behavior-preserving; unit test `tests/lib/blastFilters.test.ts`)_.
- **[L-3]** God-files (`app/actions/event.ts` ~2349, `components/event/EventPage.tsx` ~4747, `app/(app)/admin/AdminClient.tsx` ~5136) → split by feature.
- ~~**[L-4]** `.catch(() => {})` swallowing (25+ sites) → funnel through a `logSafe()` at debug level~~ _(fixed — `logSafe(context)` in `lib/logger.ts`; all 27 `app/actions/event.ts` sites plus the `lib/reminders.ts`/`lib/session.ts`/`lib/redis.ts`/`lib/rateLimit.ts` sites now record swallowed errors at debug level; unit test `tests/lib/logger.test.ts`. The one client-side site in `EventPage.tsx` is left for the L-3 split — the server logger doesn't belong in the client bundle)_.
- ~~**[L-5]** Verify the masked Twilio token is never returned decrypted to the admin client; keep the field write-only~~ _(verified — `getSystemConfig` masks `twilio_auth_token` (DB **and** env sourced) and never calls `decryptConfig`; `updateSystemConfig` no-ops when the mask is echoed back; `testSmsConfigAction` decrypts server-side only and returns just `{success, error}`. No code change needed; pinned by new assertions in `tests/actions/admin.test.ts`)_.
- **[L-6]** `.env.example` ships `HOST_INVITE_CODE="letmein"` → change to an obvious placeholder.
- ~~**[L-7]** `generateUniqueSlug` unbounded sequential retry loop → add a random suffix after N collisions~~ _(fixed — sequential probe capped at 10, then CSPRNG hex suffixes with growing entropy (4 tries), then a loud failure; regression test `tests/regression/l7-slug-collision-bound.test.ts`)_.
- _(Related, already tracked: SEC-21(c) upload gating, SEC-14 auth error enumeration, SEC-15 unpaginated blasts.)_

### 👥 Guest List & RSVP Enhancements

_(No pending priority 1 guest list enhancements)_

---

## 🟡 Priority 2: Medium Priority (Core UX & Feature Enhancements)

_Functional improvements, layout adjustments, and secondary features that can be batched together for UX consistency._

### 🎨 Layout & Page Hierarchy

_(No pending priority 2 layout enhancements)_

### 🔒 Privacy & Sharing Controls

_(No pending priority 2 privacy controls)_

### 👥 Guest List & RSVP Enhancements

- **Guest Check-In flow**: The `CheckIn` model exists and the admin Overview counts check-ins, but there is **no host-facing check-in feature** — no server action to mark a guest checked-in and no guest-list UI/button. Documented as a feature previously; the host feature docs were corrected to match reality (no check-in section in `docs/host/`). Build the missing flow: a check-in toggle/action gated to host/cohost, real-time counts on the guest list, and an "undo" — then re-document it. _(Discovered during the 2026-06 docs accuracy pass.)_
- **Richer CSV export**: `app/e/[slug]/guests.csv/route.ts` currently exports only Name, Email, Status, Plus Ones, Approved, RSVP Date. Earlier docs promised phone numbers, check-in times, and questionnaire answers (now corrected in `docs/host/guest-list.md`). Extend the export to include guest phone, questionnaire answers (one column per question), and check-in time once check-in exists. _(Discovered during the 2026-06 docs accuracy pass.)_

### ⚙️ Administration & Settings

- ~~**Configurable Email / SMS Channels**~~ _(implemented — see Completed Milestones)_
- ~~**Admin: Create User**~~ _(implemented — see Completed Milestones)_
- **Post-Event Photo Sharing**: Build a dedicated post-event photo section to link to shared albums (Google Photos, Apple Photos, Immich, etc.).

### 📖 Interactive Documentation Dashboard

- ~~**Interactive Documentation Dashboard (admin)**~~ _(implemented — see Completed Milestones)_
- ~~**Host-facing documentation portal**~~ _(implemented — see Completed Milestones)_

---

## 🟢 Priority 3: Low Priority & DevOps (Automation, Branding & Integrations)

_Aesthetic branding, advanced webhooks, automation, and long-term ideas (Icebox)._

### 📸 Post-Event & Follow-Up

- **Post-Event Photo Upload Prompt (low priority)**: After an event ends, prompt guests to upload or share their photos. Removed from Auto-Reminders settings as an unimplemented stub; the full feature would integrate with a dedicated photo-sharing section and optionally link to external album services (see Priority 2).

### 🏷️ Branding & Customization

- **White-Label Options**: Add system settings allowing hosts/admins to white-label the application (custom logo, website name, custom branding colors).
- **One-Click Bookmark for Magic Links**: Provide hosts with a quick button/shortcut to bookmark their magic link RSVP sessions, keeping them logged in across devices.
- **Rich Theme Presets**: Expand the theme builder with custom typography (from Google Fonts), vibrant gradients, and dynamic layout choices.
- **Custom Cover Images**: Enable host upload cropping and stock image selection templates.
- **Seasonal Themes**: Support seasonal themes featuring animated backgrounds (e.g., falling leaves for autumn, turkeys for Thanksgiving).

### 💬 Advanced Messaging Integrations

- **Inbound Email Reply Logging**: Log guest email replies to sending addresses directly into a dedicated "Host Section" of the event dashboard (exploring unique routing addresses per event).
- ~~**Notification Preferences**~~ _(implemented — see Completed Milestones)_
- **Unified Guest Updates**: Modify the update notification checkbox to "Notify guests" (sending via email or SMS, depending on which contact method the guest signed up with).

### 🧹 Code Quality & Best Practices Scrub

- **Site-Wide Best Practices Scrub**: Audit the entire codebase against current Next.js 16 App Router, React, and TypeScript best practices. Key areas:
  - ✅ **(1) Shared App Router layout**: Dashboard, admin, and profile pages migrated to a single route-group `layout.tsx` — per-page nav boilerplate eliminated. [PR #176](https://github.com/joe-cole1/rsvp-to-me/pull/176)
  - ✅ **(2) Global nav unified**: `AppNavLogo` / `ProfileDropdown` consistent across event page, RSVP flow, guests page, and settings page — all `AppShell` outliers resolved. [PR #175](https://github.com/joe-cole1/rsvp-to-me/pull/175)
  - ✅ **(3) `getSessionUser()` deduplication audit**: All per-page `getSession` + `db.user.findUnique` duplicates replaced with `getSessionUser()` across 6 files.

### ⚙️ DevOps & Security (Deferred)

- **[SEC-8] Hardcoded scrypt salt in `lib/crypto.ts:11`** _(deferred)_: `scryptSync(secret, "rsvp-to-me-salt", 32)` uses a static salt. Deferred: the salt is a KDF stretcher for a high-entropy `SESSION_SECRET`; AES-GCM semantic security is maintained by the per-ciphertext random IV. Changing the salt without a re-encryption migration script would silently break all existing encrypted admin configs on deploy.
- **[SEC-9] CSP allows `'unsafe-eval'` + `'unsafe-inline'` in `script-src` — `next.config.ts`** _(partial fix [ed8436])_: `'unsafe-eval'` removed from production CSP; retained only in `NODE_ENV=development` for HMR. `'unsafe-inline'` remains — full removal requires nonce-based middleware injection (deferred).
- **ESLint 10 Upgrade (blocked)**: `eslint` is held at `^9` because `eslint-plugin-react` v7 (bundled in `eslint-config-next@16.2.9`) calls `context.getFilename()` which was removed in ESLint 10. Unblock by upgrading to a `next` / `eslint-config-next` version whose bundled plugins declare ESLint ≥10 peer deps. Tracked as of 2026-06-23.
- **Phone Number Encryption at Rest (M-2)**: Encrypt phone numbers deterministically at-rest using HMAC hashes for index lookups and AES-256-GCM for display.
- **HTTP Request Logging & Distributed Tracing (G-1)**: Track request duration, method, and statuses using request IDs mapped to Pino structured logs.
- ~~**Graceful Shutdown Signal Handling (G-2)**~~ _(implemented — see Completed Milestones)_
- **Separate Database Migration Stage (G-3)**: Extract Prisma migrations (`prisma migrate deploy`) out of application container startup to a separate init container or CI/CD deployment pipeline step. This is the long-term fix for CRIT-1 — a migration failure fails the _deployment_ rather than crash-looping the running app container.
- ~~**React Error Boundaries (G-4)**~~ _(implemented — see Completed Milestones)_
- **Automated Database Backups (G-5)**: Implement cron backup service in `docker-compose.yml` to dump `prod.db` to S3 or secure local backups daily.
- **Bot Protection / CAPTCHA (G-6)**: Add Cloudflare Turnstile bot checks to authentication magic link requests and guest registration forms.
- **GDPR Compliance APIs (G-7)**: Implement export-data and account-deletion API actions for hosts and guests.
- **Admin Diagnostic Log Viewer**: Expose recent email dispatch diagnostic logs directly in the `/admin` settings dashboard.
- **SMTP Handshake Sandbox**: Allow interactive port and SSL handshake verification inside the dashboard.
- **Custom Domain Workers**: Enhance `isSafeWorkerUrl()` to support verified custom domains mapped to workers without triggering SSRF warnings.
- **[SEC-14] Information disclosure in auth/admin error responses** _(deferred — low risk for personal-event scale)_: (a) `sendMagicLinkAction` in `app/actions/auth.ts` returns distinct error codes `"email_not_found"` vs. `"delivery_failed"`, allowing an attacker to enumerate which email addresses are registered. Fix: return a single generic error for both cases. (b) `testEmailConfigAction` / `testSmsConfigAction` in `app/actions/admin.ts` surface raw provider error messages; these are admin-only so blast radius is minimal, but verbose errors could leak infrastructure details.
- **[SEC-15] Unpaginated blast queries — `app/actions/event.ts` ~lines 607–720** _(deferred — low risk at current scale)_: `sendBlast()` and `sendSmsBlast()` fetch all matching RSVPs with `db.rSVP.findMany` and no `take` limit. An event with a very large guest list could cause high memory pressure and slow database queries. Fix: paginate in chunks (e.g., `take: 500, skip: offset`) or add a reasonable hard cap.
- **[SEC-21] Defense-in-depth hardening (minor, low risk)** _(deferred)_:
  - (a) **Magic-token scope not enforced** — `verifyMagicToken` in `lib/auth.ts` ~line 116 never checks `record.type === "LOGIN"`, so an `EMAIL_CHANGE`/`PHONE_CHANGE` token can be redeemed at `/auth/verify`. Same-user only, so impact is low, but tokens should be scope-locked to their purpose.
  - ~~(b) **`updateRSVP` skips deadline/capacity re-check**~~ _(fixed — see Completed Milestones, with SEC-12)_
  - (c) **Uploads open to any session incl. auto-created `GUEST` accounts** — `app/api/upload/route.ts` ~line 62 checks only `getSession()`, with no role check and no per-user/rate cap, allowing storage abuse. Magic-byte sniffing and SVG exclusion are already correct. Fix: gate to HOST/ADMIN (or rate-limit + per-user quota).
- ~~**Auth Fallback Alerts**~~ _(implemented — see Completed Milestones)_

---

## ✅ Completed Milestones

_A log of completed capabilities._

### Interactive Documentation Dashboard

- [x] **Admin Documentation tab**: The operator guides are readable inside the app as the last tab of the **Admin Panel** (`/admin?tab=docs`), gated to ADMIN only (the panel itself is admin-gated). Rendered by `components/admin/DocsPanel.tsx` with `react-markdown` + `remark-gfm` (tables), `rehype-slug` (anchors), and `rehype-highlight` (syntax-highlighted code); category sidebar + full-text search; relative cross-links resolve within the panel.
- [x] **Frontmatter-driven, folder-based structure**: Guides live under `docs/<audience>/` (`docs/admin/` for operator guides, `docs/host/` for host guides). Each `.md` carries YAML frontmatter (`title`, `description`, `category`, `audience`, `order`); `lib/docs.ts` scans the folder and reads frontmatter — there is **no central registry** to maintain. Adding a guide = drop a `.md` with frontmatter. The Dockerfile copies the whole `docs/` tree so guides ship in the image. Covered by `tests/lib/docs.test.ts`; convention documented in AGENTS.md "In-App Documentation Sync Rule".
- [x] **Host-facing Help & Guides portal**: A reader at `/help` (linked from the profile dropdown, shown to HOST + ADMIN, guests redirected) renders the `docs/host/` guide set via `loadDocs("host")` and the shared `components/docs/DocsPanel.tsx`. The 11 host guides cover getting started, creating/customizing events, visibility, invitations, RSVPs, the guest list, messaging/reminders, polls/potluck/comments, co-hosting, and an FAQ.

### Security Hardening — Atomic RSVP Capacity Enforcement (SEC-12, SEC-21b)

- [x] **[SEC-12] Race condition in RSVP capacity check**: `addRSVP` (`app/actions/event.ts`) previously ran `rSVP.count()` (check) and `rSVP.create()` (act) as separate queries with nothing between them, so two simultaneous GOING submissions could both pass a stale count and overbook the event. The re-count and the RSVP write now run inside a per-event Redis lock (`withEventCapacityLock` in `lib/capacityLock.ts`, mirroring the cron sync-lock pattern), so the count immediately precedes the write within one critical section. Lock acquisition retries with a short backoff so concurrent legitimate RSVPs serialize rather than being rejected; if Redis is unavailable it falls back to running without the lock. Regression test: `tests/regression/sec-12-rsvp-capacity-race.test.ts`.
- [x] **[SEC-21b] `updateRSVP` skipped deadline/capacity re-check**: a token-holding guest could flip their status to `GOING` after `rsvpDeadline` had passed or past `capacity` (a capacity-bypass cousin of SEC-12). `updateRSVP` now re-validates the deadline (declining to `NO` is still always allowed so guests can cancel late) and enforces capacity under the same per-event lock — but only when the RSVP is actually transitioning _into_ a GOING seat, so note edits and downgrades on an already-GOING RSVP are never blocked. Regression test: `tests/regression/sec-21b-updaterspv-capacity-deadline.test.ts`.

### Security Hardening — Comment AuthZ & Cross-Event Threading (SEC-17, SEC-13)

- [x] **[SEC-17] Comment authZ bypass + identity spoofing**: `addComment` (`app/actions/event.ts`) now authorizes the author and derives the stored display name server-side. Host/co-host/admin may comment freely; a guest with a **pending** (unapproved) RSVP is blocked; a logged-in user with no RSVP may comment on **PUBLIC/UNLISTED** events (they are publicly viewable) but is blocked on **PRIVATE** events — closing the PRIVATE-event authZ bypass. The stored name comes from the user record or the matched approved RSVP row — never the client `guestName` — closing the impersonation vector. Regression test: `tests/regression/sec-17-comment-authz-spoofing.test.ts`.
- [x] **[SEC-13] Cross-event parent comment**: replies now resolve the parent with `where: { id: parentId, eventId: data.eventId }` and reject if it isn't found, so a reply can't thread under a comment from a different event. Regression test: `tests/regression/sec-13-cross-event-parent-comment.test.ts`.
- [x] **Approved-guest participation UI**: the event page now reflects the server rule across comments, polls, and potluck — pending (unapproved) guests see an "awaiting host approval" notice instead of dead controls, and an admin commenting on an event they aren't RSVP'd to sees a notice. `approved` is threaded from `app/e/[slug]/page.tsx` through to `EventPage`.

### Security Hardening — Injection Escaping (SEC-11, SEC-16)

- [x] **[SEC-11] XML injection in Twilio webhook**: Added an `escapeXml()` helper in `app/api/webhooks/twilio/route.ts` and applied it inside `twiml()`, so user-controlled strings (event titles, guest names) can no longer break out of the `<Message>` element to inject arbitrary TwiML. Regression test: `tests/regression/sec-11-twilio-xml-injection.test.ts`.
- [x] **[SEC-16] CSV formula injection in guest export**: Hardened the `esc()` helper in `app/e/[slug]/guests.csv/route.ts` to prefix any cell beginning with `= + - @`, tab, or CR with a single quote before quoting, neutralizing spreadsheet formula evaluation of attacker-controlled `guestName`/`guestEmail`. Regression test: `tests/regression/sec-16-csv-formula-injection.test.ts`.
- [x] **[SEC-19] Rate limiting on event-password verification**: `verifyEventPassword` in `app/actions/event.ts` is now gated by `rateLimit("event-pw:<slug>:<ip>", 10, 600)`, short-circuiting brute-force attempts before any DB lookup or bcrypt compare. The private `getClientIp()` helper was extracted from `app/actions/auth.ts` into the shared `lib/clientIp.ts` and reused by both call sites. Regression test: `tests/regression/sec-19-event-password-rate-limit.test.ts`.
- [x] **[SEC-20] Mass assignment in `saveEventSettings`**: Added `SaveEventSettingsSchema` (explicit Zod allow-list) in `lib/schemas.ts`; `saveEventSettings` now parses `settings` through it before the `db.event.update`, stripping non-allow-listed columns (`status`, `slug`, `hostId`, …) so they can't be smuggled into the write. Regression test: `tests/regression/sec-20-save-event-settings-mass-assignment.test.ts`.
- [x] **[SEC-18] Uncapped outbound email/SMS via guest invite**: `inviteFriendAsGuest` (`app/actions/event.ts`) was authorized solely by a guest `editToken` and fanned out to SMTP/Twilio with no throttling, so a single token could drive unlimited email/SMS to arbitrary recipients (spam/phishing + Twilio cost). Now gated by the shared `rateLimit()`/`getClientIp()` helpers (same pattern as SEC-19/auth) with three layers: per-IP burst (`guest-invite:ip:<ip>`, 30/hr — checked before any DB lookup so it also throttles invalid-token enumeration), per-token burst (`guest-invite:token:<editToken>`, 10/10min), and a per-RSVP daily cap (`guest-invite:rsvp:<rsvpId>`, 20/24h). The token/RSVP limits are consumed only after the token is validated, authorized, and the target address is well-formed, so legitimate rejections don't burn the cap. Regression test: `tests/regression/sec-18-guest-invite-rate-limit.test.ts`.

### Notification Preferences (`notificationChannel`)

- [x] **`prisma/schema.prisma`**: Added `NotificationChannel` enum (`EMAIL | SMS | BOTH`, default `BOTH`) and `notificationChannel` field on `User`.
- [x] **Migration** (`20260626000000_add_notification_channel`): `CREATE TYPE "NotificationChannel"` and `ALTER TABLE "User" ADD COLUMN "notificationChannel"`.
- [x] **`app/actions/profile.ts`**: Extended `updateNotificationSettings()` to accept and persist optional `notificationChannel`. Added `notificationChannel` to `getUserProfile()` select.
- [x] **`app/actions/event.ts`**: `addEventUpdate()` now queries guest `notificationChannel` and routes each notification — `SMS` → phone/SMS, `EMAIL`/`BOTH`/anonymous → email.
- [x] **`app/(app)/profile/ProfileClient.tsx`**: Renamed "Notification Opt-Outs" → "Notification Preferences". Added pill-button channel selector (Email / SMS / Both) shown only when both `channelConfig.email` and `channelConfig.sms` are enabled. Saves immediately on click via `handleChannelChange`.

### Guest Messaging Channel Toggles (`email_enabled` / `sms_enabled`)

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

### Defensive Infra — Graceful Shutdown, Error Boundaries & Auth Fallback Alerts

- [x] **[G-2] Graceful Shutdown Signal Handling**: `lib/cron-scheduler.ts` now captures all `cron.schedule()` task references and exports `stopInProcessCron()`. `instrumentation.ts` registers `SIGTERM`/`SIGINT` handlers that call `stopInProcessCron()` and exit cleanly. Dockerfile CMD updated to `exec ./node_modules/.bin/next start` so SIGTERM lands on Node.js (not the shell). `docker-compose.yml` adds `stop_grace_period: 30s` to allow in-flight requests to drain before SIGKILL.
- [x] **[G-4] React Error Boundaries**: Added `app/global-error.tsx` (catches root layout failures — renders own `<html>/<body>`), `app/error.tsx` (root-level route catch-all), and `app/(app)/error.tsx` (scoped boundary for authenticated app routes). All styled to match the dark APP_SHELL theme with a retry button and a home/dashboard link.
- [x] **Auth Fallback Alerts**: `sendMagicLinkAction` in `app/actions/auth.ts` now wraps email/SMS delivery in try/catch and returns `{ error: "delivery_failed" }` on failure. `SignInForm.tsx` handles this with a dedicated UI state pointing self-hosters to `[auth:magic-link-fallback]` in the container logs.

### Admin: Create User

- [x] **Create User modal**: Added a "Create User" button to the Admin → Users tab that opens a modal form (name, email, phone, role). Validates email format and uniqueness, checks phone uniqueness if provided. After creation, generates a 48-hour magic token and sends a welcome email (`sendWelcomeEmail` in `lib/email.ts`) so the new user can sign in immediately. Email failure is non-blocking — user creation succeeds regardless. Server action `createAdminUser` in `app/actions/admin.ts` is admin-gated via `assertAdmin()`.

### Code Quality Sweep — Prettier, Session Dedup & Profile Nav

- [x] **Prettier Formatting**: Added Prettier v3 as a devDependency with `.prettierrc` (double quotes, semis, 100-char printWidth) and `.prettierignore`. Ran `prettier --write` across the full codebase as a one-time prep commit. `npx prettier --check .` added to `ci.yml` to enforce formatting on every PR.
- [x] **`getSessionUser()` deduplication**: Replaced all remaining `getSession()` + `db.user.findUnique(session.userId)` duplicates with the existing `React.cache`-wrapped `getSessionUser()` helper across 6 files: `app/e/[slug]/page.tsx`, `app/e/[slug]/rsvp/page.tsx`, `app/e/[slug]/settings/page.tsx`, `app/e/[slug]/guests/page.tsx`, `app/actions/createEvent.ts`, and `app/actions/profile.ts`.
- [x] **Profile Nav Reactive Update**: Added `router.refresh()` call in `ProfileClient.tsx` after a successful profile save, so the layout re-runs `getSessionUser()` and the `ProfileDropdown` name/avatar updates immediately without a full page reload.

### Database Migration Hardening [PR #169](https://github.com/joe-cole1/rsvp-to-me/pull/169)

- [x] **[CRIT-1] `migrate-db.js` crash loop**: 3-attempt retry with backoff; P3009 detected and logs actionable `prisma migrate resolve` command; `docker-compose.yml` app service changed to `restart: on-failure:3`.
- [x] **[CRIT-2] Pre-migration database snapshot**: `pg_dump` via `execFileSync` (no shell) to `data/backups/pre-migration/` with timestamp before every migration run. Failure warns but never blocks the deploy.
- [x] **[CRIT-3] Health endpoint migration state check**: Queries `_prisma_migrations` for pending/stuck rows; returns 503 + `{ status: "degraded", migrations: "pending" }` if any found. 7 new tests added to `tests/api/health.test.ts`.
- [x] **Failing Test Suite**: Unit tests in `tests/actions/event.test.ts` (potluck item claims) and `tests/actions/rsvpfields.test.ts` (`reorderRsvpFields`) confirmed resolved with [PR #161](https://github.com/joe-cole1/rsvp-to-me/pull/161). Full suite: 535 tests passing across 31 files.

### Security Hardening — Passwords, Backup & CSV [PR #164](https://github.com/joe-cole1/rsvp-to-me/pull/164) · [PR #163](https://github.com/joe-cole1/rsvp-to-me/pull/163)

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
- [x] **Host Account Deletion Flow**: Hosts can delete their account from Profile settings. Upcoming published events must be explicitly deleted first (each shows a "Delete event" button; deleted events show a tombstone page at their original URL). After clearing events, the host types "DELETE" to confirm. Account is signed out immediately and anonymized within 24 hours. Admins see a "Deletion Pending" badge in the Users tab and can cancel within the window. Past events are reassigned to a SYSTEM tombstone user; guest RSVP/comment data for past events is preserved (GDPR-defensible: it is the guests' data). Added `DELETED` EventStatus; `deleteHostEvent()` server action; `requestAccountDeletion()` and `cancelAccountDeletion()` actions; hourly cron processing in `lib/cron-scheduler.ts`; Prisma migration `add_deletion_fields`.

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

### Event & Guest Engagement [PR #56](https://github.com/joe-cole1/rsvp-to-me/pull/56) · [PR #55](https://github.com/joe-cole1/rsvp-to-me/pull/55)

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

### PostgreSQL 18 Hard Requirement & SQLite Removal [PR #143](https://github.com/joe-cole1/rsvp-to-me/pull/143) · [PR #142](https://github.com/joe-cole1/rsvp-to-me/pull/142) · [PR #139](https://github.com/joe-cole1/rsvp-to-me/pull/139)

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
