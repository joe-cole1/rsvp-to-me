---
title: Features
description: Themes, RSVP, polls, potlucks, and co-hosting for hosts.
category: Usage
audience: host
order: 10
---

# Feature Reference

This guide walks through every feature of **RSVP to Me** from a host's point of view — in plain language, no technical background needed.

---

## Table of Contents

1. [New Host Quickstart](#new-host-quickstart)
2. [Authentication and Accounts](#authentication-and-accounts)
3. [Dashboard](#dashboard)
4. [Creating an Event](#creating-an-event)
5. [Event Page & Inline Editing](#event-page--inline-editing)
6. [Themes and Cover Images](#themes-and-cover-images)
7. [Event Info Sections](#event-info-sections)
8. [RSVP Management](#rsvp-management)
9. [Custom Questionnaires](#custom-questionnaires)
10. [Guest List](#guest-list)
11. [Invitations](#invitations)
12. [Event Updates & Guest Blasts](#event-updates--guest-blasts)
13. [Automated Reminders](#automated-reminders)
14. [Comments Board](#comments-board)
15. [Polls](#polls)
16. [Potluck Coordination](#potluck-coordination)
17. [Co-Hosting](#co-hosting)
18. [Event Settings and Visibility](#event-settings-and-visibility)
19. [Activity Log](#activity-log)
20. [User Profiles](#user-profiles)

---

## New Host Quickstart

Here's the typical flow from start to finish:

1. **Sign in.** Enter your email on the Sign In page and click the magic link that arrives in your inbox — no password needed.
2. **Create your event.** From the Dashboard, click **New Event** and fill in the title, date, time, and location. Your event goes live immediately at its own web address.
3. **Make it yours.** Open the event page, click directly on the title, description, or location to edit them in place, pick a theme, and upload a cover photo.
4. **Invite guests.** From the guest management area, send email or text invitations, or just share the event link.
5. **Manage RSVPs.** Watch responses roll in on the guest list. Approve guests if you've turned on approval, and answer comments or polls.
6. **Send reminders and updates.** RSVP to Me can automatically remind guests as the date approaches, and you can send your own update blasts any time.

The rest of this guide explains each of these in detail.

---

## Authentication and Accounts

### Magic Link Login

RSVP to Me uses passwordless **magic links** to sign in.

1. Enter your email address (or phone number, if SMS is enabled) on the Sign In page.
2. The server generates a unique one-time link and emails or texts it to you.
3. Click the link to sign in.

Magic links expire after **15 minutes**, and each one can only be used once.

### Session Length

Once you're signed in, your session lasts **7 days**. After that, you'll request a new magic link to sign in again.

### Signing Out

Click your profile avatar in the navigation bar and choose **Sign Out**. This clears your browser cookie and ends the session immediately.

### User Roles

- **Guest**: a standard account, created automatically the first time someone RSVPs. Guests can RSVP, comment, claim potluck items, and vote in polls, but can't host events.
- **Host**: an event organizer. Hosts create and manage events, see guest activity, and invite co-hosts.
- **Admin**: a system administrator. Admins can open the Admin Panel, manage all users, and change system settings. See the [Admin Panel Guide](../admin/admin.md).

---

## Dashboard

After signing in, your Dashboard (`/dashboard`) shows:

- **Upcoming events you're hosting** — events that haven't happened yet.
- **Past events you hosted** — for reference.
- **Events you're attending** — events where you've RSVP'd "Going" or "Maybe".
- **Pending approvals** — alerts when guests are waiting for you to approve their RSVP.

---

## Creating an Event

Click **New Event** on the Dashboard, then fill in:

- **Event Title** (required)
- **Description** — freeform details about your event.
- **Start Date & Time** (required)
- **End Date & Time** (optional)
- **Timezone** — defaults to `America/New_York`; guests see times in this timezone.
- **Location Type**:
  - **Physical** — a street address.
  - **Virtual** — a link to Google Meet, Zoom, etc.
  - **TBD** — displays "Location TBD".

When you create an event, it is **published right away** and open for RSVPs at its own web address. You can later cancel an event from its settings, which closes RSVPs and marks it cancelled.

---

## Event Page & Inline Editing

Your event lives at `/e/[slug]` (for example, `/e/housewarming-party`).

### Inline Editor

When you view your own event while signed in, you can click directly on certain details to edit them in place — changes save automatically. The fields you can edit inline are:

- **Title**
- **Description**
- **Location name** and **address**
- **Virtual event link**

Everything else (date and time, theme, RSVP rules, visibility, polls, potluck, and so on) is changed from the event's **Settings** page.

To preview the page exactly as a guest sees it, add `?preview=1` to the end of the URL.

---

## Themes and Cover Images

### Base Themes

Choose a base look for your page:

- **Dark & Moody** — deep background with high-contrast text.
- **Soft & Dreamy** — pastel tones and gentle contrast.
- **Bold & Colorful** — vivid, high-contrast layouts.

Your admin can also publish additional **theme presets** that appear in the theme picker.

### Accent Color

A color picker sets the color of buttons, links, and highlighted elements.

### Cover Image

Upload a cover photo:

- Supported formats: JPEG, PNG, GIF, WebP.
- Maximum file size: 8 MB.
- To keep uploads fast, your browser automatically resizes large images (to a maximum of 1600×900) before sending them.

---

## Event Info Sections

Info sections show short details (parking, dress code, links) as chips on the event page.

- **Icons:** pick from a set (shirt, utensils, parking, link, phone, and more).
- **Ordering:** drag and drop chips to reorder them.

---

## RSVP Management

### RSVP Statuses

Guests can respond **Going**, **Maybe**, or **No**. The "Maybe" option can be turned off per event in settings.

### RSVP Approval

When **Approval Required** is on, new guest RSVPs wait in a pending state until you **Approve** or **Decline** them from the guest list. (Internally, a pending guest simply hasn't been approved yet — their response is still recorded.) The guest is notified of your decision.

### Capacity Limits

Set a maximum number of "Going" guests. Once that limit is reached, additional guests can no longer mark themselves "Going" — they'll see the event is at capacity. (Guests can still respond "Maybe" or "No".) To make room, raise the capacity in settings.

### Plus-Ones

- Allow or disallow plus-ones.
- Set a maximum plus-one count per guest.
- Optionally require names for plus-ones.

Plus-ones are recorded as a count attached to the main guest's RSVP (and share that guest's status) — they aren't separate accounts and don't have their own contact details.

### Guest Edit Links

Guests don't need to sign in to change their RSVP. Every confirmation email includes a private link unique to that guest; clicking it lets them update their status or answers at any time.

### Password Protection (Private events)

For a **Private** event, you can set a password that guests must enter to view the page. Once a guest enters the correct password, the event stays unlocked in their browser for a while, and the password never appears in the web address.

---

## Custom Questionnaires

Add your own questions to the RSVP form.

- **Field types:** single-line text, multi-line text, dropdown, and checkbox.
- **Required or optional:** mark each question as needed.
- **Reordering:** drag questions to change their order on the form.

---

## Guest List

The Guest List page (`/e/[slug]/guests`) is where you manage attendees.

### Filters

Filter guests by status: Going, Maybe, No, Invited, or Awaiting Approval.

### Who Can See the Guest List

Control guest-list visibility in settings:

- **Everyone can see** — any visitor can view the list.
- **Going guests only** — only guests marked "Going" see the list.
- **Host only** — hidden from guests; visible to you and your co-hosts.

### Showing Guest Names

A separate toggle controls whether guests' names appear on the event page itself. When off, each guest only sees their own RSVP.

### CSV Export

Download a guest spreadsheet. The export includes these columns: **Name, Email, RSVP Status, Plus-Ones, Approved, and RSVP Date**.

---

## Invitations

Invite guests directly from the guest management area:

- **Email invites:** enter guest emails to send invitation links (shown when email is enabled).
- **SMS invites:** enter guest phone numbers to send text invitations (shown when SMS is enabled).
- **History:** the table tracks when invites were sent and whether the guest has responded.

> **Let guests invite friends:** For **Private** events, you can turn on an option that lets your invited guests bring others by sending their own invitations. This option is only available on private events.

---

## Event Updates & Guest Blasts

Send messages to your guests:

- **Recipients:** filter by Going, Maybe, or both.
- **Delivery channels:** send via Email, SMS, or both (only the channels enabled on this server are shown).
- **Log:** every blast is recorded in the event's activity log.

> If both email and SMS are turned off server-wide, the blast panel is hidden and the app runs in pure RSVP-collection mode — guests fill out forms and hosts see a guest list, but no messages are sent.

---

## Automated Reminders

RSVP to Me automatically sends reminders as your event approaches.

- **Email reminders:** one week before, one day before, and a number of hours before that you choose.
- **SMS reminders:** one week before, one day before, and your chosen hours before (requires Twilio).
- **Unresponded nudge:** a few days before the event, a gentle nudge to guests who were invited but haven't responded yet.

Each reminder type can be toggled on or off in the event's settings. A guest's own notification preferences (for example, turning off SMS) take precedence over event reminders.

---

## Comments Board

A threaded comment section sits at the bottom of the event page.

- Guests and hosts can post and reply.
- Hosts can delete any comment or reply.
- A setting lets you show or hide comment timestamps.

---

## Polls

Gather input from guests (for example, voting on a date or the menu):

- **Types:** single-choice or multi-choice.
- **Write-ins:** optionally let guests add their own options.
- **Anonymity:** show or hide voter names.
- **Locking:** lock a poll to freeze voting.

---

## Potluck Coordination

Coordinate what guests bring:

- **Quantity:** set a required amount (e.g., 3 bottles of wine).
- **Multi-claim:** several guests can each claim part of an item until the total is met.
- **Claims:** guests claim or release items right on the event page.

---

## Co-Hosting

Share the work of running an event:

- **Adding co-hosts:** search for any registered user by name or email to add them.
- **Permissions:** co-hosts can manage guests, approve RSVPs, send blasts, and edit settings.
- **Restrictions:** co-hosts cannot delete the event or remove other co-hosts.

---

## Event Settings and Visibility

Choose who can find your event:

- **Public** — anyone can view it, and it can appear on the public event feed.
- **Unlisted** — viewable only by people with the direct link.
- **Private** — viewable only by hosts and invited guests; supports an optional password and the "let guests invite friends" option.

---

## Activity Log

The Activity Log is a host-only timeline on the event management page. It records things like:

- New RSVPs and status changes.
- New comments and replies.
- Poll activity (votes, new options, locking).
- Potluck claims and releases.
- Invitations and update blasts you've sent.

---

## User Profiles

Manage your profile at `/profile`:

- **Details:** edit your display name and upload a profile picture.
- **Contact info:** changing your email sends a verification link to the new address; changing your phone sends a verification code to the new number.
- **Notification preferences:** turn email or SMS notifications on or off, and (when both channels are available) choose whether you'd like to be reached by **Email**, **SMS**, or **Both**.
