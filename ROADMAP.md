# RSVP to Me — Product Roadmap

This document outlines the short-term backlog, long-term ideas, and historical milestones of the **RSVP to Me** platform. It serves as our long-term reference for future features, unresolved issues, and product ideas.

---

## 🔴 Priority 1: High Priority (Bugs, UX Blockers & Core Fixes)
*Immediate attention items. High impact bugs, UX papercuts, and essential routing/data integrity fixes.*

### 🛠️ Bugs & Blockers
*   *(No pending priority 1 bugs)*

### 🔒 Routing & System Safety
*   **Host Account Deletion Flow**: Allow hosts to delete their own account from the dashboard, with safeguards for active event ownership.

    **Recommended approach:**
    - **Block deletion if upcoming published events exist.** Prompt the host to either cancel or transfer ownership of each event before proceeding. This prevents guests from losing access to events they're attending.
    - **For past/cancelled events**, reassign `hostId` to a designated system/tombstone user (e.g. a `SYSTEM` role user seeded at startup), so event history is preserved for guests who had RSVPs.
    - **Anonymize the deleted user's PII** (nullify email, phone, name → `"Deleted User"`, clear avatarUrl) rather than hard-deleting the row. This avoids FK constraint violations on `Event.hostId` (which currently has no cascade or setNull behavior) and preserves audit history.
    - **RSVPs** already survive gracefully — `RSVP.userId` uses `onDelete: SetNull`, so guest RSVPs remain intact as anonymous records with the guest's name still attached.
    - **Comments** are already decoupled — `Comment` stores `guestName` as a plain string with no user FK, so they are unaffected.
    - **Sessions and magic tokens** cascade-delete automatically via existing `onDelete: Cascade`.
    - **Co-host records** also cascade-delete automatically via `EventCoHost.onDelete: Cascade`.
    - Add a **confirmation step** with high friction (e.g. type "DELETE" to confirm) and a short **soft-delete grace period** (e.g. 30 days) before the anonymization is finalized, allowing accidental deletions to be reversed by an admin.
    - Supersedes and replaces the lower-priority **G-7 (GDPR Compliance APIs)** item for the host-side deletion flow; guest-side deletion can remain a separate effort.

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
*   **Draft & Visibility Controls**: Add the ability to save events as drafts (unpublished) in "Display & Privacy" under Event Visibility settings.
*   **Event Settings Navigation & Photo Sharing**: Move the post-event photo sharing option to its own dedicated section in settings, eventually building it out to link to shared albums (Google Photos, Apple, Immich, etc.).
*   **Admin Theme Manager**: Add an admin settings page that allows dynamic theme creation. Admins can create new themes, modify settings for each theme (base style, accents, gradients, decorations), delete themes, set visibility, and customize titles and descriptions.
*   **Backup Schedule Picker**: Replace the raw cron text input for the database backup schedule (Admin → Backups) with a dropdown of common presets: Disabled, Every hour, Every 6 hours, Daily at midnight, Every 3 days, Weekly (Sundays at midnight). The underlying `backup_schedule` SystemConfig value stays as a cron string; the dropdown maps human labels to cron expressions. Include a "Custom" option that reveals the raw input field for advanced users.
*   **Admin Settings History & Refresh**: Sync the active admin tab to the URL as a query parameter (e.g. `/admin?tab=backups`) so that browser back/forward navigation and page refresh work correctly. Use Next.js `useSearchParams` to read the initial tab on mount and `useRouter.replace` (not `push`) to update the URL on tab change without polluting history. The 8 current tab IDs (overview, users, events, invites, settings, email, sms, backups) map directly to param values; default to `overview` when no param is present.
*   **Favicon & Page Titles**: Fix the placeholder root metadata and add proper per-page titles. Update `app/layout.tsx` with a title template (`"%s | RSVP to Me"`), real description, and Open Graph defaults. Add `generateMetadata` to the event page (`app/e/[slug]/page.tsx`) for dynamic titles like `"Summer BBQ | RSVP to Me"`. Replace `app/favicon.ico` with a custom branded icon and add apple-touch-icon, `site.webmanifest`, and a 512×512 PNG for PWA/bookmark support. Audit remaining pages (home, sign-in, dashboard) to ensure each has a meaningful title.

### 📊 Guest List Exporters
*   [ ] Implement a robust CSV export action for guest details (names, statuses, responses).
*   [ ] Create a print-friendly view of the guest list optimized for physical check-ins.

### 🎟️ Check-in Flow
*   [ ] Add QR code generation for guest tickets/invitations.
*   [ ] Design a mobile-friendly host scanner view to scan QR codes and check guests in.
*   [ ] Provide a manual toggle check-in flow on the guest list.

### 📖 Interactive Documentation Dashboard
*   [ ] Build an in-app documentation portal accessible via the host dashboard.
*   *   [ ] Render local markdown files (e.g., GitHub README, setup guides, and `docs/cloudflare_workers.md`) dynamically.
*   *   [ ] Implement search, category navigation, and responsive layout styling.

---

## 🟢 Priority 3: Low Priority & DevOps (Automation, Branding & Integrations)
*Aesthetic branding, advanced webhooks, automation, and long-term ideas (Icebox).*

### 🏷️ Branding & Customization
*   **White-Label Options**: Add system settings allowing hosts/admins to white-label the application (custom logo, website name, custom branding colors).
*   **One-Click Bookmark for Magic Links**: Provide hosts with a quick button/shortcut to bookmark their magic link RSVP sessions, keeping them logged in across devices.
*   **Rich Theme Presets**: Expand the theme builder with custom typography (from Google Fonts), vibrant gradients, and dynamic layout choices.
*   **Custom Cover Images**: Enable host upload cropping and stock image selection templates.
*   **Seasonal Themes**: Support seasonal themes featuring animated backgrounds (e.g., falling leaves for autumn, turkeys for Thanksgiving).

### 💬 Advanced Messaging Integrations
*   **Email RSVP Buttons + SMS Reply-to-RSVP** *(specced — ready for implementation)*

    Replaces the single "RSVP Now" email button and generic SMS magic-link with a full two-way RSVP experience.

    **Email flow:**
    - Invite emails show YES / NO / MAYBE anchor buttons (MAYBE hidden when `event.maybeEnabled = false`).
    - Each button links to `/e/{slug}/rsvp?token={editToken}&status=GOING` — the guest's pre-created RSVP edit form with their response pre-selected. No new token column needed; the existing `RSVP.editToken` serves as the per-invitation URL token.
    - Guest still completes their name and any questionnaire on the form before submitting. No one-click blind submits.
    - Re-clicking a different button in the same email loads the form with the new status pre-selected, updating the existing RSVP.

    **SMS flow:**
    - Invite SMS reads: `"Reply YES XK72 to RSVP yes, NO XK72 to decline [, MAYBE XK72 to say maybe]. Details: {url}"`
    - Each event gets a unique auto-generated 5-character alphanumeric `smsCode` (e.g. `XK72A`) stored as `Event.smsCode`. Codes use an unambiguous character set (no 0/O/1/I). Generated on event creation; lazily assigned to existing events on first SMS invite.
    - Twilio webhook at `POST /api/webhooks/twilio` receives guest replies, validates the Twilio HMAC signature, parses `"YES XK72A"`, looks up the event by code, looks up the guest's `Invitation` record by phone, updates `RSVP.status` and sets `responded = true`, then replies via TwiML with a confirmation SMS containing their edit link.
    - Edge cases handled: invalid code, invalid format, MAYBE on maybe-disabled events, past `rsvpDeadline`, event at capacity (no silent updates — guest is notified).

    **Schema change:** Add `smsCode String? @unique` to `Event`.

    **New file:** `app/api/webhooks/twilio/route.ts`

    **Modified files:** `lib/email.ts`, `lib/sms.ts`, `app/actions/event.ts`, `app/actions/createEvent.ts`, `app/e/[slug]/settings/page.tsx` (read-only smsCode display for hosts).

*   **Inbound Email Reply Logging**: Log guest email replies to sending addresses directly into a dedicated "Host Section" of the event dashboard (exploring unique routing addresses per event).
*   **Notification Preferences**: Rename "Notification Opt-Outs" to "Notification Preferences", allowing guests to prioritize either Email or SMS notifications.
*   **Unified Guest Updates**: Modify the update notification checkbox to "Notify guests" (sending via email or SMS, depending on which contact method the guest signed up with).
*   **Inbound Email Reply Logging**: Log guest email replies to sending addresses directly into a dedicated "Host Section" of the event dashboard (exploring unique routing addresses per event).
*   **Notification Preferences**: Rename "Notification Opt-Outs" to "Notification Preferences", allowing guests to prioritize either Email or SMS notifications.
*   **Unified Guest Updates**: Modify the update notification checkbox to "Notify guests" (sending via email or SMS, depending on which contact method the guest signed up with).

### ⚙️ DevOps & Security (Deferred)
*   **GitHub Release Workflow**: Setup a GitHub Actions workflow to automate release tagging, version increments, and changelog generation.
*   **Phone Number Encryption at Rest (M-2)**: Encrypt phone numbers deterministically at-rest using HMAC hashes for index lookups and AES-256-GCM for display.
*   **HTTP Request Logging & Distributed Tracing (G-1)**: Track request duration, method, and statuses using request IDs mapped to Pino structured logs.
*   **Graceful Shutdown Signal Handling (G-2)**: Handle SIGTERM signals in Next.js/Docker setup to allow in-flight requests to complete before exiting.
*   **Separate Database Migration Stage (G-3)**: Extract Prisma migrations (`prisma migrate deploy`) out of application container startup to a separate init container or CI/CD deployment pipeline step.
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


