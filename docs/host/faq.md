---
title: Host FAQ & Troubleshooting
description: Common host questions, plus managing your profile and account.
category: Help
audience: host
order: 110
---

# Host FAQ & Troubleshooting

Quick answers to the things hosts run into most.

---

## What changes for hosts in v2.1.0?

- **Info-only events:** turn off **Collect RSVPs** when creating an event or
  under **Settings → RSVP options** to run a flyer-style page with event
  details, info sections, polls, custom questions, and comments without RSVPs,
  guest lists, invitations, potluck, or reminders. Existing RSVPs and
  invitations are kept if you turn RSVPs back on later. See
  [Creating Your Event](creating-an-event.md) and
  [Managing RSVPs](managing-rsvps.md).
- **Questionnaire templates, contact/terms fields, and Going-only filter:** add
  **Phone number**, **Mailing address**, and **Terms / waiver** questions, start
  from six one-click quick-add templates, add optional descriptions, and mark
  individual questions **Going only**. See [Managing RSVPs](managing-rsvps.md).
- **Potluck and open polls:** guests see the potluck list and remaining
  quantities before RSVPing (claiming still requires an approved **Going**
  RSVP), and you can turn off **Require RSVP to respond** on individual polls so
  visitors can vote before RSVPing. See
  [Polls, Potluck & Comments](polls-potluck-comments.md).
- **Event header:** the dark background scrim behind the hero has been removed
  for a cleaner cover presentation. See
  [Customizing Your Page](customizing-your-page.md).

Existing event links, RSVP edit links, and sign-ins keep working across the
upgrade after a brief restart.

## What changes for hosts in v2.0.0?

- **Guests verify their contact details:** a guest who gives an email address
  or phone number on your public RSVP form enters a code sent to it before the
  RSVP is saved. Guests who leave both blank, and guests answering from their
  invitation link, are not asked. See [Managing RSVPs](managing-rsvps.md).
- **Event passwords:** everyone who unlocked a password-protected event enters
  the password once more after the upgrade. You can now remove a password from
  **Display options**.
- **Event URLs:** existing links keep working. New Unlisted and Private events
  get a random six-character URL, and you can edit or regenerate a URL in
  **Display options**. Renaming a URL breaks links you already shared, so send
  the new one. See [Visibility & Privacy](visibility-and-privacy.md).
- **Notification preferences:** under **Profile**, you and your guests choose
  which messages arrive by email or text. Your messages to guests follow their
  choices. See [Notification Preferences](notification-preferences.md).
- **Signing in:** the sign-in email or text also has a 6-digit code you can
  type instead of opening the link. Sign out from the menu under your avatar.
- **Co-hosts** accept an invitation by signing in with the invited email address
  and choosing **Accept invitation**.
- **Polls and potluck:** guests who share a display name now have separate votes
  and claims. Earlier vote counts and claims are kept, but guests choose again
  to mark their own vote.
- **Themes:** background effects can mix up to three icons with their own
  amount, size, speed and movement, and new occasion presets come with default
  effects. See [Customizing Your Page](customizing-your-page.md).
- **Uploads:** each account can store up to 100 MiB of covers and avatars.
  Remove unused images to free space.

Your administrator restarts the site during the upgrade, which may take longer
than usual. If sign-in, an RSVP, a code or an email or text fails afterwards,
share the time and affected event with your administrator.

## What changes for hosts in v1.5.0?

- **Languages:** use the 文A button beside your profile to switch between
  English, Deutsch, Español, and Nederlands. Emails and texts follow each
  person's saved language.
- **Inviting:** **Invite → Invite people** lets you type, paste a list, or
  import a spreadsheet, then review everyone before sending. People who
  already responded are only invited again if you tick them.
- **Guest RSVP display:** under **Settings → Display options** one table sets
  what guests see for Going, Maybe, Can't make it, and Invited. Names can be
  shown, collapsed, or hidden, and the count can be exact, 3+, or hidden, even
  when names are hidden. Existing events look the same; new events start with
  the "Can't make it" list collapsed and its count hidden, and Invited always
  starts hidden.

Event links, RSVP edit links, and sign-ins keep working, and you don't need to
recreate events or resend invitations. Your administrator may briefly restart
the site during the upgrade. If sign-in, an RSVP, an upload, or an email/text
fails afterwards, share the time and affected event with your administrator.

## A guest lost their RSVP edit link

Each guest's edit link is unique and arrives in their confirmation email. If they can't find it, ask them to RSVP again with the same email — RSVP to Me recognizes the existing response and updates it rather than creating a duplicate, and a fresh confirmation (with the link) is sent.

## A guest can't see the event

- **Private event:** only invited guests and hosts can view it. Make sure they were invited.
- **Password-protected:** they need the password you set (shared separately from the link).
- Confirm you've shared the correct event link. A link to an event that doesn't exist, or
  that was cancelled or deleted, shows a "We couldn't find that page" screen with a way home.

## A guest didn't get an email or text

- The channel may be disabled on your site (your admin controls whether email/SMS are enabled).
- The guest may have turned that channel off in their own notification preferences.
- For SMS specifically, trial messaging accounts can only reach pre-verified numbers — check with your administrator.

## "The event is full"

You've hit the **capacity** limit for Going guests. Raise the capacity in the event's Settings to let more people in. See [Managing RSVPs](managing-rsvps.md).

## How do I cancel an event?

Open the event's **Settings** and mark it cancelled. This closes RSVPs and shows guests the event is no longer happening.

## How do I delete an event?

Open the event's **Settings**, scroll to the **Danger Zone** at the bottom of the main settings page, and click **Delete Event**. You will be prompted to type `DELETE` to confirm. Once deleted, the event and all guest data are permanently and irreversibly removed.

Deletion also removes pending co-host invitations, theme settings, custom RSVP
fields and reminder settings. Its cover file is deleted when no other event or
profile uses it. After account deletion, covers of retained past events stay
available, while unused uploads and your former profile image are removed
unless another retained event or profile still uses that image.

## Will guests be notified if I change the event?

Editing details doesn't automatically message guests. To tell them about a change, send an update blast — see [Messaging Guests & Reminders](messaging-and-reminders.md).

---

## Your Profile & Account

Manage your profile at `/profile`:

- **Details:** edit your display name and upload a profile picture.
- **Contact info:** changing your email sends a verification link to the new address; changing your phone sends a verification code to the new number.
- **Notification preferences:** turn email or SMS notifications on or off, and (when both are available) choose whether you'd like to be reached by **Email**, **SMS**, or **Both**.

### Deleting your account

You can request account deletion from your profile settings. You'll be asked to deal with any upcoming published events first. Past events are preserved (your guests' RSVP and comment history stays intact), and your personal details are removed.

Once requested, your account is scheduled for deletion in 30 days and you will be signed out. If you log back in within this 30-day window, you can cancel the deletion request directly from your profile settings page.
