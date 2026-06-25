# Feature Reference

This document describes every user-facing feature of **rsvp-to-me** from the perspective of an event host.

---

## Table of Contents

1. [Authentication and Accounts](#authentication-and-accounts)
2. [Dashboard](#dashboard)
3. [Creating an Event](#creating-an-event)
4. [Event Page & Inline Editing](#event-page--inline-editing)
5. [Themes and Cover Images](#themes-and-cover-images)
6. [Event Info Sections](#event-info-sections)
7. [RSVP Management](#rsvp-management)
8. [Custom Questionnaires](#custom-questionnaires)
9. [Guest List Administration](#guest-list-administration)
10. [Invitations](#invitations)
11. [Event Updates & Guest Blasts](#event-updates--guest-blasts)
12. [Automated Reminders](#automated-reminders)
13. [Comments Board](#comments-board)
14. [Polls](#polls)
15. [Potluck Coordination](#potluck-coordination)
16. [Guest Check-In](#guest-check-in)
17. [Co-Hosting](#co-hosting)
18. [Event Settings and Visibility](#event-settings-and-visibility)
19. [Activity Log](#activity-log)
20. [User Profiles](#user-profiles)

---

## Authentication and Accounts

### Magic Link Login

rsvp-to-me uses passwordless **magic links** for logins.

1. Enter your email address or phone number (if SMS is active) on the Sign In page.
2. The server generates a unique one-time token and emails or texts it to you.
3. Click the link to log in.

_Expirations:_ Magic links expire after 15 minutes. Once clicked, they are marked as used and cannot be reused.

### Session Lifespans

Active login sessions last for **7 days**. After 7 days, your session cookie expires and you will need to request a new magic link.

### Signing Out

Click your profile avatar in the navigation bar and select **Sign Out**. This deletes your browser cookie and invalidates the session in the database immediately.

### User Roles

- `GUEST`: Standard account. Created automatically when a guest RSVPs. Can comment, claim potlucks, and vote. Cannot host events.
- `HOST`: Event organizer. Can create and manage events, view visitor activity, and invite co-hosts.
- `ADMIN`: Global moderator. Can access `/admin`, manage all users, and modify system settings.

---

## Dashboard

After signing in, your Dashboard page (`/dashboard`) highlights:

- **Upcoming events you're hosting**: Active events that haven't occurred yet.
- **Past events you hosted**: Archived events for record reference.
- **Events you're attending**: Public or unlisted events where you have submitted a "Going" or "Maybe" RSVP.
- **Pending RSVP Queue**: Highlight alerts showing guests awaiting approval.

---

## Creating an Event

Click **New Event** on the Dashboard.

### Core Fields

- **Event Title**: Required.
- **Description**: Freeform text for your event details.
- **Start Date & Time**: Required.
- **End Date & Time**: Optional.
- **Timezone**: Defaults to `America/New_York`. Guests will see the event times adjusted for this timezone.
- **Location Type**:
  - `PHYSICAL`: Street address.
  - `VIRTUAL`: Link to Google Meet, Zoom, etc.
  - `TBD`: Displays "Location TBD".
- **Status**:
  - `DRAFT`: Visible only to the host and co-hosts.
  - `PUBLISHED`: Open for RSVPs.
  - `CANCELLED`: RSVPs closed; event marked as cancelled.

---

## Event Page & Inline Editing

Once published, your event page is accessible at `/e/[slug]` (e.g. `/e/housewarming-party`).

### Inline Editor (WYSIWYG)

If you view your own event page while logged in, you can click directly on details (title, description, location) to edit them in-place. Changes are auto-saved.

- To view the page exactly as a guest sees it, add `?preview=1` to the end of the URL.

---

## Themes and Cover Images

### Base Themes

- **Dark**: Deep background with high-contrast text.
- **Soft**: Pastel tones and low contrast.
- **Bold**: High contrast, vivid layouts.

### Accent Color

A color picker allows you to set the color of buttons, links, and active elements.

### Cover Image

Upload a cover photo:

- Supported formats: JPEG, PNG, GIF, WebP.
- File size limit: 8MB.
- **Client-Side Compression:** To speed up uploads, your browser automatically compresses and resizes images to a maximum of 1600×900 pixels at JPEG 85% quality before sending them to the server.

---

## Event Info Sections

Info sections display details (parking, dress code, links) as chips or tags on the event page.

- **Icons:** Choose from a set of icons (e.g. shirt, utensils, parking, link, phone).
- **Ordering:** Drag and drop chips to reorder them.

---

## RSVP Management

### RSVP Statuses

Guests can choose **Going**, **Maybe**, or **No**.

- The "Maybe" option can be disabled per-event in settings.

### RSVP Approval Workflow

When **Approval Required** is toggled on, guest RSVPs are placed in a "Pending" queue. Hosts must click **Approve** or **Decline** in the Guest List. The guest is then notified of the decision.

### Capacity Limits & Waitlists

Set a maximum capacity for "Going" guests. Once reached, new guests are placed on a waitlist. If a spot opens up, waitlisted guests can be approved manually.

### Plus-Ones

- Allow or disallow plus-ones.
- Set a maximum plus-one count per guest.
- Optionally require names for all plus-ones.

### Guest Edit Tokens

Guests do not need to log in to change their RSVP. Every RSVP confirmation email contains a unique link containing an `editToken`. Clicking this allows guests to update their status or answers at any time.

### Password Protection

You can assign a password to an event. Guests must enter it to view the page details.

- **How it works:** Once a guest enters the correct password, the application stores a signed cryptographic cookie in their browser (`rsvp-unlocked-[slug]`). The password is not exposed in the URL query string.

---

## Custom Questionnaires

Add custom questions to your RSVP form.

- **Field Types:** Text (single-line), Textarea (multi-line), Select (dropdown list), and Checkbox.
- **Validation:** Mark questions as required or optional.
- **Reordering:** Drag questions to change their order on the RSVP form.

---

## Guest List Administration

The Guest List page (`/e/[slug]/guests`) allows you to manage attendees.

### Filters

Filter guests by status: Going, Maybe, No, Invited, or Awaiting Approval.

### Visibility Settings

Control who can see the Guest List:

- **All guests**: Anyone can see the list.
- **Going guests only**: Only guests marked "Going" see the list.
- **Host only**: Hidden from guests; visible only to the host and co-hosts.

### Guest Sharing

Toggle whether guests' names are shown on the event page. When disabled, guests only see their own RSVP.

### CSV Export

Download a complete guest spreadsheet including names, emails, phone numbers, RSVP status, check-in time, and questionnaire answers (written to separate columns).

---

## Invitations

Send invitations directly from the Guest Management page.

- **Email Invites:** Enter guest emails to send an invitation link.
- **SMS Invites:** Enter guest phone numbers to send a text invitation (Twilio must be active).
- **History:** The table tracks when invites were sent and if the guest has responded.

---

## Event Updates & Guest Blasts

Send messages to your guests:

- **Recipients:** Filter by Going, Maybe, or both.
- **Delivery Channels:** Send via Email, SMS, or both.
- **Log:** All sent blasts are archived in the event's activity log.

---

## Automated Reminders

The in-process cron scheduler automatically triggers reminders.

### Reminder Types

- **Email:** 7 days before, 1 day before, and N hours before (you set N).
- **SMS:** 7 days before, 1 day before, and N hours before (requires Twilio).
- **Unresponded Nudge:** Send an email nudge to guests who have not responded.

_Note:_ User profile settings (e.g. toggling off SMS alerts) will override event-level reminder settings.

---

## Comments Board

A nested, threaded comment section at the bottom of the event page.

- Hosts can delete any comment or reply.
- Toggles let you hide or show comment timestamps.

---

## Polls

Gather feedback from guests (e.g., voting on dates or food).

- **Types:** Single-choice vs Multi-choice.
- **Write-ins:** Allow guests to add their own voting options.
- **Anonymity:** Hide or show voter names.
- **Locking:** Lock the poll to freeze voting.

---

## Potluck Coordination

Coordinate what guests are bringing:

- **Quantity:** Set a required quantity (e.g., 3 bottles of wine).
- **Multi-Claim:** Multiple guests can claim a portion of a required item until the total quantity is met.
- **Claims:** Guests claim or unclaim items directly on the event page.

---

## Guest Check-In

Mark guests as they arrive on event day:

- **Check-in Button:** Click **Check In** next to a guest's name on the mobile-friendly guest list.
- **Stats:** Displays real-time check-in counts (e.g., "12 / 30 checked in").
- **Uncheck:** Click the button again to undo a check-in.

---

## Co-Hosting

Share event management duties:

- **Adding Co-Hosts:** Search for any registered user by name/email to add them.
- **Permissions:** Co-hosts can manage guests, approve RSVPs, send blasts, edit settings, and check in guests.
- **Restrictions:** Co-hosts cannot delete the event or remove other co-hosts.

---

## Event Settings and Visibility

### Visibility Modes

- **Public**: Anyone can view the event.
- **Unlisted**: The event page is accessible only via its direct URL link.
- **Private**: Accessible only to hosts and guests who have been explicitly invited or added.

---

## Activity Log

The Activity Log is a host-only timeline displayed on the event management page. It tracks:

- New RSVPs and status updates.
- Edits made to event details.
- Sent invitations and guest updates.
- Guest check-in times.

---

## User Profiles

Manage your profile at `/profile`:

- **Details:** Edit display name and upload a profile picture.
- **Contact Info Updates:**
  - Changing email sends a verification link to the **new** address.
  - Changing phone number sends a verification code to the **new** number.
- **Notification Toggles:** Globally enable or disable Email or SMS alerts.
