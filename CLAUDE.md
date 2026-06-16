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
| Email | Resend |
| SMS | Twilio (optional) |
| File Storage | Uploadthing |

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint
npx prisma migrate dev --name <name>   # Create + apply migration
npx prisma studio    # Browse database
npx prisma generate  # Regenerate client after schema changes
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
  dashboard/        # Host dashboard (protected)
  api/              # API routes
  generated/prisma/ # DO NOT EDIT — Prisma auto-generated client
components/
  event/            # Event page, cover, theme picker
  rsvp/             # RSVP form, guest list
  ui/               # Shared primitives
lib/
  db.ts             # Prisma singleton
  session.ts        # iron-session helpers
  auth.ts           # Magic link generation + verification
  email.ts          # Resend send helpers
  sms.ts            # Twilio helpers
  slug.ts           # Slug generation from event title
prisma/
  schema.prisma     # Source of truth for DB schema
  migrations/       # Auto-managed by Prisma
```

## Key patterns

### DB access
Always import from `@/lib/db`, never instantiate PrismaClient directly.

### Auth
- Hosts sign in via magic link sent to their email
- Session is stored as an encrypted cookie via iron-session
- `getSession()` in `lib/session.ts` returns `{ userId, email }` or null
- Route protection: check session in Server Components or middleware
- Guests don't log in — they get a unique `editToken` per RSVP for updates

### Host access control
- Hosts must have a valid invite code to register
- Invite codes live in `HostInviteCode` table
- Admin can create/revoke codes (via seed script or direct DB edit initially)

### Event page UX
- Public event page at `/e/[slug]` — no auth required
- When a host is authenticated and views their own event, they see inline edit controls overlaid on the same page (WYSIWYG, Partiful-style)
- Edit controls appear as floating overlays / hover states on each editable section

### File uploads
Uploadthing handles cover image uploads. Config in `app/api/uploadthing/`.

## Environment variables

```bash
# Required
DATABASE_URL="file:./dev.db"
SESSION_SECRET=""         # 32+ random chars for iron-session encryption
HOST_INVITE_CODE=""       # Default invite code for host registration
RESEND_API_KEY=""
EMAIL_FROM=""             # e.g. "RSVP to Me <noreply@yourdomain.com>"
NEXT_PUBLIC_APP_URL=""    # e.g. https://rsvp.yourdomain.com

# Optional (SMS features)
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_PHONE_NUMBER=""

# Optional (file uploads)
UPLOADTHING_TOKEN=""
```

## Self-hosting with Docker

```bash
docker compose up   # Starts the app (SQLite db file persisted in ./data volume)
```

The `data/` directory contains the SQLite .db file. Back it up regularly.
