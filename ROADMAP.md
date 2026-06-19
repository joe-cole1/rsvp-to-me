# RSVP to Me — Product Roadmap

This document outlines the short-term backlog, long-term ideas, and historical milestones of the **RSVP to Me** platform. It serves as our long-term reference for future features, unresolved issues, and product ideas.

---

## 📅 Short-term Backlog
*Tasks queued for upcoming sessions.*

### 1. User Dashboard Enhancement (`/dashboard`)
*   [ ] Add at-a-glance host and co-host event listings.
*   [ ] Show active guest counts, pending RSVPs, and comment activity.
*   [ ] Build navigation tabs for "My Invites" and "Events I'm Hosting".

### 2. Guest List Exporters
*   [ ] Implement a robust CSV export action for guest details (names, statuses, responses).
*   [ ] Create a print-friendly view of the guest list optimized for physical check-ins.

### 3. Check-in Flow
*   [ ] Add QR code generation for guest tickets/invitations.
*   [ ] Design a mobile-friendly host scanner view to scan QR codes and check guests in.
*   [ ] Provide a manual toggle check-in flow on the guest list.

### 4. SMS Integration & Testing (Twilio)
*   [ ] Build configuration panel in `/admin` for Twilio settings (Account SID, Auth Token, Sender Phone Number).
*   [ ] Add connection diagnostics testing for Twilio SMS in `/admin` (similar to email testing).
*   [ ] Implement outbound SMS blast mechanisms using Twilio's client.
*   [ ] Write automated unit tests for `lib/sms.ts` to mock and verify Twilio service connectivity.

### 5. Database Migration (SQLite to PostgreSQL)
*   [ ] Transition the Prisma schema and database provider from SQLite to PostgreSQL for production scalability.
*   [ ] Update singletons, docker-compose configurations, and deployment guidelines.
*   [ ] Define database migration paths for existing production data.

---

## 💡 Future Work & Ideas (Icebox)
*Product ideas and long-term improvements to track but not work on immediately.*

### 🛠️ Administration & Email Settings
*   **Admin Diagnostic Log Viewer**: Expose recent email dispatch diagnostic logs directly in the `/admin` settings dashboard instead of requiring console log checks.
*   **SMTP Handshake Sandbox**: Allow interactive port and SSL handshake verification inside the dashboard.
*   **Custom Domain Workers**: Enhance `isSafeWorkerUrl()` to support verified custom domains mapped to workers without triggering SSRF warnings.
*   **Auth Fallback Alerts**: Alert users during login errors to reference the container console rescue log fallback.

### 🎨 Themes & Customization
*   **Rich Theme Presets**: Expand the theme builder with custom typography (from Google Fonts), vibrant gradients, and dynamic layout choices.
*   **Custom Cover Images**: Enable host upload cropping and stock image selection templates.

### 💬 Messaging & Notifications
*   **SMS Blasts (Twilio)**: Integrate Twilio out-of-the-box for hosts to text blast guests.
*   **Email RSVP Updates**: Send automatic emails to hosts when someone RSVPs, and alerts to guests when event details change.

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
