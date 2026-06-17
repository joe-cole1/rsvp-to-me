@AGENTS.md

# rsvp-to-me

A fun, social-first event and RSVP platform for personal events (house parties, wine nights, dinners). Inspired by Partiful's expressive aesthetic. No payments or ticketing — just invites, RSVPs, and connection.

## What it is / isn't

**Is:** Invite friends, customize a beautiful event page, manage RSVPs, send text blasts and email blasts, see who's coming, let guests comment.

**Isn't:** Ticketing, payments, seating charts, enterprise features.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + Radix Themes |
| Icons | Lucide React |
| Database | SQLite via Prisma 7 |
| Auth | Custom magic-link (iron-session cookies) |
| Email | nodemailer (SMTP); console fallback in dev |
| SMS | Twilio (optional) |
| File Storage | Local filesystem (`data/uploads/`) |
| Testing | Vitest (141 unit tests) |

## Commands

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

## Important: Next.js 16 + Prisma 7 patterns

**Params are Promises in Next.js 16:**
```tsx
export default async function Page(props: PageProps<'/e/[slug]'>) {
  const { slug } = await props.params
}
```

**Prisma client import path (generated, not @prisma/client directly):**
```ts
import { PrismaClient } from '@/app/generated/prisma'
```

**Use the singleton in `lib/db.ts`:**
```ts
import { db } from '@/lib/db'
```

## Directory structure

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
  schema.prisma     # Source of truth for DB schema
  migrations/       # Auto-managed by Prisma
.github/
  workflows/
    ci.yml          # Lint + test + build on every PR and push to main
```

## Key patterns

### DB access
Always import from `@/lib/db`, never instantiate PrismaClient directly.

### Auth
- Hosts sign in via magic link sent to their email
- Session is stored as an encrypted cookie via iron-session
- `getSession()` in `lib/session.ts` returns `{ userId, email }` or null
- Magic link verify is a **Route Handler** at `app/auth/verify/route.ts` — sets cookie directly on `NextResponse.redirect()` using `response.cookies.set()`; never use `cookies().set()` in a Server Component
- Guests don't log in — they get a unique `editToken` per RSVP for updates
- RSVP edit URL: `/e/[slug]/rsvp?token=<editToken>` — served by `app/e/[slug]/rsvp/page.tsx`

### Host access control
- Hosts must have a valid invite code to register (gated for now; see Open Registration note below)
- Invite codes live in `HostInviteCode` table
- Seed script (`prisma/seed.ts`) upserts `HOST_INVITE_CODE` on container startup
- `User.role` defaults to `HOST` for everyone — there is no second-class "guest" user type
- `assertHost(eventId)` — checks session + event.hostId
- `assertHostOrCohost(eventId)` — checks session + event.hostId OR EventCoHost row

### Open registration
Controlled by `OPEN_REGISTRATION` env var (default `"false"`). Set to `"true"` in docker-compose
to allow anyone to register — invite code field is hidden on the register page and `registerHost`
in `lib/auth.ts` skips the code check. No schema changes needed: `User.role` already defaults to
`HOST`, so everyone who signs up can create events immediately.

One nuance: guest RSVPs (name/email on RSVP rows) are not linked to User accounts. If you
want guests to later claim their RSVPs after creating an account, add an optional `userId`
field to the `RSVP` model and link it during sign-up by matching `guestEmail === user.email`.
This is a schema migration + one `db.rSVP.updateMany()` call — no architectural overhaul.

### Event page UX
- Public event page at `/e/[slug]` — no auth required
- When a host is authenticated and views their own event, they see inline edit controls overlaid on the same page (WYSIWYG, Partiful-style)
- `?preview=1` query param lets hosts see the guest view without losing host session
- Edit controls appear as floating overlays / hover states on each editable section

### File uploads
Local filesystem storage — no external service needed.
- `POST /api/upload` — validates session + image type + 8MB limit, saves to `data/uploads/<uuid>.ext`, returns `{ url: "/api/uploads/<filename>" }`
- Images are compressed client-side (Canvas API, max 1600×900, JPEG 0.85) before upload to prevent server hangs
- `GET /api/uploads/[filename]` — serves the file; uses `path.basename()` to prevent path traversal
- `data/` is a Docker volume mount — persists across container restarts

### Email
`lib/email.ts` uses nodemailer. When `SMTP_HOST` is set, sends via SMTP. When unset, logs the payload to console (dev mode). No external API key required.

### SMS
`lib/sms.ts` uses Twilio. When `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` are set, sends real SMS. When unset, logs to console. `sendSmsBlast` uses `Promise.allSettled` so partial failures don't throw.

## Environment variables

```bash
# Required
DATABASE_URL="file:./dev.db"
SESSION_SECRET=""             # 32+ random chars for iron-session encryption
OPEN_REGISTRATION="false"    # set "true" to allow anyone to register (no invite code)
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

## Self-hosting with Docker

```bash
docker compose up --build                            # Local dev — build from working tree
docker compose -f docker-compose.dev.yml up --build  # Build from GitHub main (no clone needed)
```

| File | Purpose |
|---|---|
| `docker-compose.yml` | Local dev (`build: .`) / future production releases |
| `docker-compose.dev.yml` | Builds from GitHub `main` — share with testers |

The `data/` directory holds both the SQLite `.db` file and uploaded images. Back it up regularly.
Container runs as root so it can write to the host-mounted `data/` volume.
On startup: `npx prisma migrate deploy && npm run db:seed && npm start`.

### Email in development
Leave `SMTP_HOST` unset — emails log to the server console instead. Useful for testing the full magic link flow without any mail credentials.

---

## What's left to build

### 1. User dashboard — next up
`app/dashboard/` exists but is minimal. Enhance it to show all events the logged-in user
has created, with at-a-glance stats (going count, pending approvals, date). Key query:
```ts
db.event.findMany({ where: { hostId: session.userId }, include: { _count: { select: { rsvps: true } } }, orderBy: { startAt: 'desc' } })
```
Also consider including events where the user is a co-host (`EventCoHost`).

### 2. Check-in flow
Schema has `CheckIn` (rsvpId, checkedInAt, checkedInBy), no UI yet. Options:
- Simple: host sees guest list with a ✓ button per guest; `checkInGuest(rsvpId)` action
- Advanced: QR code per RSVP scanned at the door (editToken can double as check-in code)

### 3. Open registration
✅ Done — set `OPEN_REGISTRATION=true` in docker-compose (or `.env`) to enable. No code changes needed.

---

## Completed
- ✅ Magic link auth, host dashboard, event creation
- ✅ Event page at `/e/[slug]` — WYSIWYG inline editing (title, description, date/time, location), RSVP form, info section chips, guest list, comments, Add to Calendar
- ✅ Info section inline editing — existing parking/dress code/etc. rows editable in place (pencil icon)
- ✅ Cover image upload — local filesystem (`POST /api/upload`, `GET /api/uploads/[filename]`); client-side Canvas compression (max 1600×900 JPEG) before upload; `saveCoverImage` action
- ✅ RSVP approval flow — `approveRsvp` / `declineRsvp` actions; Pending Approval card in host view
- ✅ QR code — generated client-side via `qrcode` in the Invite panel of HostBar
- ✅ CSV export — `GET /e/[slug]/guests.csv` (host-only)
- ✅ Floating host bar — Invite (link + QR), Message (email + SMS blast), Visibility quick-toggle, Settings, Preview
- ✅ Reminder scheduling — `lib/reminders.ts` + `scripts/cron.ts` (node-cron every 15 min); 8 reminder types (email/SMS × week/day/hours + nudge_email + nudge_sms); `SentReminder` table deduplicates sends
- ✅ Invitation tracking — `Invitation` rows written on every email/SMS blast; nudge logic targets invited-but-unresponded guests
- ✅ Settings page — restructured into Partiful-style sections: Theme / Hosts / RSVP Options / Questionnaire / Display & Privacy / Auto-Reminders
- ✅ Co-host management — `addCoHost(eventId, email)` / `removeCoHost(id)` actions; Hosts section in settings; cohosts get full host-bar/edit access via `assertHostOrCohost()`
- ✅ Questionnaire / RSVPField — field builder in settings (TEXT/TEXTAREA/SELECT/CHECKBOX, required toggle, options); fields rendered on RSVP form; answers saved to `RSVPAnswer`; `getRsvpFieldAnswers()` for host review
- ✅ Display & Privacy — `maybeEnabled` (hide Maybe button), `showTimestamps` (hide comment timestamps), `password` (PasswordGate component), guest list visibility, event visibility
- ✅ RSVP edit page — `/e/[slug]/rsvp?token=` + `updateRSVP` server action
- ✅ Email sending (`lib/email.ts`) — nodemailer SMTP; dev-mode console fallback when `SMTP_HOST` unset
- ✅ SMS integration (`lib/sms.ts`) — Twilio; phone collected on RSVP form; confirmation SMS on RSVP; SMS blast in host bar; dev-mode console fallback when `TWILIO_*` unset
- ✅ Docker Compose — `docker-compose.yml` (local), `docker-compose.dev.yml` (builds from GitHub main; runs as root to allow volume writes); Dockerfile runner stage includes `lib/`, `scripts/`, starts cron alongside app
- ✅ GitHub Actions CI — lint + **test** + build on every PR (`npm test` runs 141 Vitest unit tests)
- ✅ Partiful-style UI — date/time as large clean text; address click → "Open in Maps / Copy" popover; info sections as compact icon+text rows; bold/soft/dark theme variants
