# RSVP to Me — Product Roadmap

This document outlines the short-term backlog, long-term ideas, and historical milestones of the **RSVP to Me** platform. It serves as our long-term reference for future features, unresolved issues, and product ideas.

---

## 📅 Short-term Backlog
*Tasks queued for upcoming sessions.*

### 1. Guest List Exporters
*   [ ] Implement a robust CSV export action for guest details (names, statuses, responses).
*   [ ] Create a print-friendly view of the guest list optimized for physical check-ins.

### 2. Check-in Flow
*   [ ] Add QR code generation for guest tickets/invitations.
*   [ ] Design a mobile-friendly host scanner view to scan QR codes and check guests in.
*   [ ] Provide a manual toggle check-in flow on the guest list.

### 3. SMS Integration & Testing (Twilio)
*   [ ] Build configuration panel in `/admin` for Twilio settings (Account SID, Auth Token, Sender Phone Number).
*   [ ] Add connection diagnostics testing for Twilio SMS in `/admin` (similar to email testing).
*   [ ] Implement outbound SMS blast mechanisms using Twilio's client.
*   [ ] Write automated unit tests for `lib/sms.ts` to mock and verify Twilio service connectivity.

### 4. Database Migration (SQLite to PostgreSQL)
*   [ ] Transition the Prisma schema and database provider from SQLite to PostgreSQL for production scalability.
*   [ ] Update singletons, docker-compose configurations, and deployment guidelines.
*   [ ] Define database migration paths for existing production data.

### 5. Interactive Documentation Dashboard
*   [ ] Build an in-app documentation portal accessible via the host dashboard.
*   *   [ ] Render local markdown files (e.g., GitHub README, setup guides, and `docs/cloudflare_workers.md`) dynamically.
*   *   [ ] Implement search, category navigation, and responsive layout styling.

### 6. UI/UX Polish & Immediate Fixes
*   [ ] **Fix Invite Guests Copy Link**: The copy link button is currently broken. Make it copy the event URL to the clipboard and update the button style to green with a checkbox upon success.
*   [ ] **Toast & Success Message UX**: Adjust styling for confirmation, "Saved", and success messages across the entire site to render at the top of the viewport (fixed position) rather than the absolute top of the page, so they are visible without scrolling up.
*   [ ] **Eliminate All-Caps Overuse**: Audit and remove unnecessary all-caps text throughout the website to improve readability.
*   [ ] **RSVP Settings Grouping**: In Event Settings, group "Require host approval for each RSVP" and "Guests can RSVP 'Maybe'" under a new subtitle: "RSVP & Approval Options".
*   [x] **Clean up Event Settings Navigation**: Restructure the Event Settings page so each setting section is linked from a menu and opens in a sub-view/page, with clear links back to settings or the event.

---

## 💡 Future Work & Ideas (Icebox)
*Product ideas and long-term improvements to track but not work on immediately.*

### 🔒 Security & Best Practices (Deferred)
*   **Phone Number Encryption at Rest (M-2)**: Encrypt phone numbers deterministically at-rest using HMAC hashes for index lookups and AES-256-GCM for display.
*   **HTTP Request Logging & Distributed Tracing (G-1)**: Track request duration, method, and statuses using request IDs mapped to Pino structured logs.
*   **Graceful Shutdown Signal Handling (G-2)**: Handle SIGTERM signals in Next.js/Docker setup to allow in-flight requests to complete before exiting.
*   **Separate Database Migration Stage (G-3)**: Extract Prisma migrations (`prisma migrate deploy`) out of application container startup to a separate init container or CI/CD deployment pipeline step.
*   **React Error Boundaries (G-4)**: Wrap core page components in error boundaries to prevent rendering crashes from taking down entire routes.
*   **Automated Database Backups (G-5)**: Implement cron backup service in `docker-compose.yml` to dump `prod.db` to S3 or secure local backups daily.
*   **Bot Protection / CAPTCHA (G-6)**: Add Cloudflare Turnstile bot checks to authentication magic link requests and guest registration forms.
*   **GDPR Compliance APIs (G-7)**: Implement export-data and account-deletion API actions for hosts and guests.

### 🛠️ Administration & Settings
*   **Admin Diagnostic Log Viewer**: Expose recent email dispatch diagnostic logs directly in the `/admin` settings dashboard instead of requiring console log checks.
*   **SMTP Handshake Sandbox**: Allow interactive port and SSL handshake verification inside the dashboard.
*   **Custom Domain Workers**: Enhance `isSafeWorkerUrl()` to support verified custom domains mapped to workers without triggering SSRF warnings.
*   **Auth Fallback Alerts**: Alert users during login errors to reference the container console rescue log fallback.
*   **Draft & Visibility Controls**: Add the ability to save events as drafts (unpublished). This should live in "Display & Privacy" under Event Visibility settings.
*   **Event Settings Navigation & Photo Sharing**: Move the post-event photo sharing option to its own dedicated section in settings, eventually building it out to link to shared albums (Google Photos, Apple, Immich, etc.).

### 🎨 Themes & Customization
*   **Rich Theme Presets**: Expand the theme builder with custom typography (from Google Fonts), vibrant gradients, and dynamic layout choices.
*   **Custom Cover Images**: Enable host upload cropping and stock image selection templates.
*   **Seasonal Themes**: Support seasonal themes featuring animated backgrounds (e.g., falling leaves for autumn, turkeys for Thanksgiving).

### 💬 Messaging & Notifications
*   **SMS Blasts (Twilio)**: Integrate Twilio out-of-the-box for hosts to text blast guests.
*   **Email RSVP Updates**: Send automatic emails to hosts when someone RSVPs, and alerts to guests when event details change.
*   **Inbound Reply Logging (Emails & SMS)**: 
    *   Log guest email/SMS replies to sending addresses directly into a dedicated "Host Section" of the event dashboard (exploring unique routing addresses per event).
    *   Add SMS response triggers (e.g., if a guest replies "YES" to an invitation SMS, it automatically records their RSVP).
*   **Unified Guest Updates**: Modify the update notification checkbox to "Notify guests" (sending via email or SMS, depending on which contact method the guest signed up with).
*   **Notification Preferences**: Rename "Notification Opt-Outs" to "Notification Preferences", allowing guests to prioritize either Email or SMS notifications.

---

## ✅ Completed Milestones
*A log of completed capabilities.*

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

