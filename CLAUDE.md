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
| Testing | Vitest (25 unit tests) |

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
- Hosts must have a valid invite code to register
- Invite codes live in `HostInviteCode` table
- Seed script (`prisma/seed.ts`) upserts `HOST_INVITE_CODE` on container startup

### Event page UX
- Public event page at `/e/[slug]` — no auth required
- When a host is authenticated and views their own event, they see inline edit controls overlaid on the same page (WYSIWYG, Partiful-style)
- `?preview=1` query param lets hosts see the guest view without losing host session
- Edit controls appear as floating overlays / hover states on each editable section

### File uploads
Local filesystem storage — no external service needed.
- `POST /api/upload` — validates session + image type + 4MB limit, saves to `data/uploads/<uuid>.ext`, returns `{ url: "/api/uploads/<filename>" }`
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
HOST_INVITE_CODE=""           # Default invite code for host registration
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

### 1. Co-host management UI
Schema has `EventCoHost` (eventId + userId), no UI yet. Need:
- Host can invite another registered user by email as co-host
- Co-hosts see the same WYSIWYG host bar and can edit the event
- `addCoHost(eventId, email)` / `removeCoHost(id)` server actions
- UI in settings page or host bar panel

### 2. Check-in flow
Schema has `CheckIn` (rsvpId, checkedInAt, checkedInBy), no UI yet. Options:
- Simple: host sees guest list with a ✓ button per guest; `checkInGuest(rsvpId)` action
- Advanced: QR code per RSVP scanned at the door (editToken can double as check-in code)

### 3. Event visibility quick-toggle from host bar
Settings page has `visibility: PUBLIC | UNLISTED | PRIVATE` but no way to flip it without leaving the page. A toggle button in the host bar (or 5th pill) would let hosts publish/unpublish instantly.

### 4. Reminder scheduling — send logic
Settings UI for reminders exists (`EventReminderSettings` with email + SMS fields). The actual cron/scheduler that fires reminders is not wired. Options:
- A lightweight `node-cron` job inside the Docker container (simplest for self-hosting)
- External service (Upstash, etc.)

### 5. Invitation tracking UI
`Invitation` model exists (sentTo, channel EMAIL/SMS, sentAt, rsvpId). Currently nothing writes to it or reads from it. Could show hosts who was explicitly invited vs who found the link organically.

---

## Completed
- ✅ Magic link auth, host dashboard, event creation
- ✅ Event page at `/e/[slug]` — WYSIWYG inline editing (title, description, date/time, location), RSVP form, info section chips, guest list, comments, Add to Calendar
- ✅ Cover image upload — local filesystem (`POST /api/upload`, `GET /api/uploads/[filename]`); `saveCoverImage` action; 📷 Cover button on event page
- ✅ RSVP approval flow — `approveRsvp` / `declineRsvp` actions; Pending Approval card in host view
- ✅ QR code — generated client-side via `qrcode` in the Invite panel of HostBar
- ✅ CSV export — `GET /e/[slug]/guests.csv` (host-only)
- ✅ Floating host bar — Invite (link + QR), Message (email + SMS blast), Settings, Preview
- ✅ Theme picker, settings page (RSVP options, reminders config, visibility)
- ✅ RSVP edit page — `/e/[slug]/rsvp?token=` + `updateRSVP` server action
- ✅ Email sending (`lib/email.ts`) — nodemailer SMTP; dev-mode console fallback when `SMTP_HOST` unset
- ✅ SMS integration (`lib/sms.ts`) — Twilio; phone collected on RSVP form; confirmation SMS on RSVP; SMS blast in host bar; dev-mode console fallback when `TWILIO_*` unset
- ✅ Docker Compose — `docker-compose.yml` (local), `docker-compose.dev.yml` (builds from GitHub main; runs as root to allow volume writes)
- ✅ GitHub Actions CI — lint + **test** + build on every PR (`npm test` runs 25 Vitest unit tests)
- ✅ Partiful-style UI — date/time as large clean text; address click → "Open in Maps / Copy" popover; info sections (parking, dress code, etc.) as compact icon+text rows
