---
title: Messaging Guests & Reminders
description: Update blasts, automated reminders, and how notifications work.
category: Communication & Engagement
audience: host
order: 80
---

# Messaging Guests & Reminders

Keep guests informed without leaving the app — send your own updates and let RSVP to Me handle the reminders.

---

## Invitation Links

The **View event details** link in a personalized invitation keeps the guest’s RSVP context, so they can open the event and respond using their invitation. Newly sent and resent invitations include this context; previously delivered emails are unchanged.

---

## Update Blasts

Send a message to your guests at any time from the event's host controls:

- **Recipients:** filter by **Going**, **Maybe**, or both.
- **Delivery channels:** send by **Email**, **SMS**, or both (only the channels enabled on your site appear).
- **Log:** every blast is recorded in the event's [activity log](#activity-log).

When the site administrator enables bot protection, sending a blast, publishing an event update, or
sending a test email requires an interaction-only security check. This also applies to hosts and
co-hosts so a compromised or abusive organizer account cannot be used to spam guests.

---

## Event Updates

Use **Post an Update** in the event's activity section to publish news. Leave
**Notify guests of update** checked to attempt notification of the event's
RSVP contacts. This uses the existing update audience; it does not apply the
recipient filters from the separate message-blast composer.

Each guest's current event contact, notification preferences, and the services
available on your site determine delivery. See [Notification Preferences](notification-preferences.md) for each guest's table of choices and event exceptions. Each checked channel with a verified address gets its own copy; unverified addresses share one message, email first. Legacy settings migrate as follows:

- For event updates, **Email** permits email only and **SMS** permits text only.
  Confirmations and decisions may use either channel.
- **Both** checks email and text. Until the guest verifies an address, that is one
  notification, email first, rather than a copy on each channel.
- Old **Blasts & Reminders** opt-outs keep applying to updates and reminders only;
  confirmations, decisions and host alerts still arrive, as before.
- Guests without a linked account use email when available, then their RSVP
  phone number. Phone-only guests can receive texts without changing a profile.
- A channel turned off by the guest or your administrator is skipped. A service
  also needs working configuration before a delivery attempt can start.

After posting, the composer shows accepted, skipped, failed, and uncertain counts.
This feedback uses your selected interface language, including Dutch (**Nederlands**).
**Accepted** means the service acknowledged the message for processing; it does
not confirm inbox or device delivery. A failed primary followed by accepted
fallback counts as one acceptance. A missing acknowledgement or timeout is
**uncertain** and does not trigger another channel, because the first message
may already have been accepted. Retrying can create duplicates.

The update stays posted if some or all notifications fail. These counts are
temporary feedback for the current composer session; there is no delivery-history
screen or automatic retry. Automatic reminders, RSVP confirmations/decisions, and host alerts also enforce recipient preferences. Manual blasts and invitations remain separate; manual-blast opt-outs are tracked in #789.

---

## New-RSVP Alerts

Get notified the moment someone responds. When a guest RSVPs to your event — including an invited guest answering their invitation for the first time — you and any co-hosts receive a **"New RSVP" alert** with the guest's name, their status (Going / Maybe / Can't Go), any plus-ones and note, and your event's running Going / Maybe / Can't-Go totals. Later changes to an existing RSVP don't send another alert. If an invited guest's first answer can't be saved, nothing is sent and the answer stays unanswered, so the alert and their confirmation go out when they try again.

Control whether alerts exist with **Settings → RSVP Options → Notification Settings → Notify organizers of new RSVPs**. Directly below it, **Your RSVP alerts** sets how you personally receive them: follow your profile's settings or check this event's own channels, and optionally choose an address you verified in your profile. Each organizer changes only their own alerts.

Alerts use each organizer's account email by default. An account phone, or any other address, is used only once it is verified; turning **Notify organizers** on never turns on text alerts by itself. Enrolling a verified address alone does not redirect event messages. Events whose alerts were text-only before the upgrade keep texting existing organizers. Host-alert email keeps working when the site guest-email toggle is off; SMS still respects the site SMS toggle.

---

## Automated Reminders

Hosts choose a shared set of reminder times in **Settings → Auto-Reminders**: one week, one day, several hour offsets, custom hours, and a nudge three days before for invitations nobody has answered. New events start with a one-day reminder and the nudge turned on. Each switch saves immediately. Each recipient's channel list, category settings and event exceptions determine delivery.

Times already sent show **already sent or skipped**, and times already over show **time has passed**; neither sends. Old email/SMS timings merge where equal and keep their channel limits, named in a notice, until a host chooses **Let each guest's settings decide**. Already consumed reminders are never replayed when a schedule is saved, disabled or restored. There is no automatic retry; a crash after claiming an occurrence can lose it. Current same-event invitation contacts determine nudge eligibility, so historical addresses cannot bypass opt-outs.

---

## Preview Your Event's Emails

Every email your guests receive — the invite, RSVP confirmation, approval, and update/reminder blasts — is styled to match your event's **theme**. Change your theme's colors, base vibe, or cover image, and your emails automatically follow; there's nothing extra to set up.

To see exactly what guests get, open **Settings → 💌 Emails**:

- Pick an email from the dropdown to see a live preview rendered with **your event's real details and current theme**.
- Click **Send me a test** to receive that email at your own address, so you can check how it looks in your actual inbox before guests do.

The wording of these emails is managed site-wide by your administrator, so the Emails panel is preview-only. If you'd like different copy, ask your admin. (The Emails panel appears only when email is enabled on your site.)

---

## Messaging After a Site Upgrade

Provider credentials saved by your administrator are converted automatically
during site upgrades. Hosts and guests do not need to change notification
settings or re-enter contact details. If an upgrade cannot verify saved
credentials, the site administrator must resolve the startup error before the
site can resume sending messages.

## When Messaging Is Turned Off

If your site administrator has disabled both email and SMS, the messaging panel is hidden and the app runs in **pure RSVP-collection mode**: guests fill out forms and you see the guest list, but no messages are sent.

---

## Activity Log

The **activity feed** is a timeline on your event page. It records:

- New RSVPs and status changes
- New comments and replies
- Poll activity (votes, new options, locking)
- Potluck claims and releases
- Invitations and update blasts you've sent

Guest-facing RSVP identity entries follow **Settings → RSVP Options → guest-list visibility**:
everyone can see them for a public guest list, only authenticated event guests or valid personal
invite-link holders can see them for **Going guests only**, and only hosts/co-hosts/admins can see
them for **Host only**. The server removes restricted entries—including guest names and RSVP note
text—before sending the page. Check-in, check-in undo, and walk-in activity is always organizer-only.
