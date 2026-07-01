# STATE_BLOCK — Architecture & Audit Context

One fact per line so findings can reference them in later phases.

## Application overview

- App: "RSVP to Me" — social event/RSVP platform (invites, RSVPs, comments, polls, potluck, blasts). No payments.
- Framework: Next.js 16 (App Router) + React 19, TypeScript strict.
- Data: PostgreSQL 18 via Prisma 7 (generated client in `app/generated/prisma`).
- Cache/locks/rate-limit: Redis (required in prod; graceful DB fallback for rate limit + capacity lock).
- Auth: custom magic-link (email/SMS) → iron-session encrypted cookie + DB `Session` row + Redis session cache.
- Email: nodemailer SMTP, Cloudflare Worker, or Cloudflare REST API; console fallback in dev.
- SMS: Twilio; console fallback when unset.
- File storage: local filesystem `data/uploads/`; backups in `data/backups/`.
- Background jobs: in-process `node-cron` started from `instrumentation.ts` (reminders, account deletion, DB backups).
- Cloudflare Worker (`worker/worker.ts`) handles outbound email + inbound reply forwarding.

## Entry points

- Server Actions: `app/actions/{auth,event,createEvent,admin,profile}.ts` — primary mutation surface.
- Route handlers: `app/auth/{verify,verify-change,sign-out}/route.ts`, `app/api/{upload,uploads/[filename],admin/backups/[filename],health,webhooks/twilio}/route.ts`, `app/e/[slug]/guests.csv/route.ts`.
- Public event page: `app/e/[slug]/page.tsx` (visibility gate + password gate + token/logged-in-guest bypass).
- Admin panel: `app/(app)/admin/page.tsx` → `AdminClient.tsx` (role gate: ADMIN only).

## Auth / access-control model

- `getSession()` (`lib/session.ts`) validates sealed cookie → Redis/DB session → returns `{userId, email, role, sessionId}`.
- `assertHost(eventId)` / `assertHostOrCohost(eventId)` in `app/actions/event.ts` are the guards; many actions re-implement the cohost check inline instead of using the helper.
- Guests are not authenticated; guest write authority = per-RSVP `editToken` (a Prisma `cuid()`), passed in URLs and SMS.
- Guest actions (comment/vote/potluck/claim) authorize unauthenticated users by matching a supplied `rsvpId` + `guestName` against an approved RSVP.
- Admin bootstrap: `INITIAL_ADMIN_EMAIL` auto-promoted to ADMIN when zero admins exist (checked in session/profile/verify/admin page).

## Secret / credential management

- `SESSION_SECRET` (>=32 chars) required; `ENCRYPTION_KEY` optional, falls back to `SESSION_SECRET`.
- At-rest encryption `lib/crypto.ts` AES-256-GCM, static salt "rsvp-to-me-salt", format `iv:tag:cipher` (NO "enc:" prefix).
- Provider secrets (SMTP pass, Twilio token, Cloudflare secrets) stored encrypted in `SystemConfig`, masked as •••••••• to the UI.
- `HOST_INVITE_CODE` strength validated at startup in production non-localhost only.

## Infra / CI

- Dockerfile: multi-stage node:22-alpine; runner runs `migrate-db.js` → `db:seed` → `prisma migrate deploy` → `next start`.
- `docker-compose.yml` exposes Postgres 5432 and Redis 6379 to host; passwords default to weak literals if env unset.
- CI (`.github/workflows/ci.yml`): npm audit (high), lint, prettier, unit+integration+component+e2e, build. Actions pinned by SHA.
- Release (`release.yml`): builds/pushes multi-arch image to ghcr on GitHub release; tags via docker/metadata semver + `latest`.
- Dependabot: github-actions daily, npm weekly grouped.
- Security headers in `next.config.ts` (HSTS, X-Frame-Options, Referrer-Policy, CSP). CSP `script-src` includes `'unsafe-inline'`.

## Key data-flow observations (audit-relevant)

- IP for rate limiting from `lib/clientIp.ts` — trusts `x-forwarded-for`/`x-real-ip`/`cf-connecting-ip` even with no `TRUSTED_IP_HEADER` set (spoofable).
- `lib/sms.ts` line 17 gates decryption on `startsWith("enc:")` but ciphertext never carries that prefix → DB Twilio token used raw (broken + inconsistent with email.ts).
- `app/api/webhooks/twilio/route.ts` validates signature with `process.env.TWILIO_AUTH_TOKEN` only — ignores DB-configured token.
- `addRSVP` (`app/actions/event.ts`) has no rate limit and emails/SMS an attacker-supplied address on public events.
- Guest edit auth relies on `cuid()` `editToken`; guest name-match authz uses publicly-visible rsvpId + guestName.
- God-files: `app/actions/event.ts` (2349 lines), `components/event/EventPage.tsx` (~4747), `app/(app)/admin/AdminClient.tsx` (~5136).
- Prior fixes tracked as SEC-1..SEC-21 with regression tests in `tests/regression/`.
