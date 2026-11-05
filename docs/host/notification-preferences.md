---
title: Notification Preferences
description: Choose what you get and where, add contact addresses, and change one event's notifications.
category: Messaging
audience: host
order: 65
---

# Your Notification Preferences

Open **Profile** to manage notifications. These controls cover event updates,
reminders and nudges, RSVP confirmations and decisions, and host alerts.
Invitations, manual message blasts and sign-in links are separate. The manual-blast
opt-out gap is tracked in #789; these settings do not control that composer yet.

Every change saves as soon as you make it. A short message confirms each change;
if a save fails, the box returns to its saved state and the message explains why.
If the page says it is out of date, reload it: the site was updated since you
opened it.

## Notifications

The **Notifications** card is a table. Each row is a kind of message: **Event
updates**, **Reminders and nudges**, **RSVP confirmations and decisions** and
**Host alerts**. Each column is a channel: **Email** and **Text**.

Check a box to get that message on that channel. Each message goes to every channel
you check. Uncheck every box in a row to stop that message.

How many messages arrive depends on whether the address is verified:

- Every checked channel whose address is **verified** gets its own copy.
- Checked channels whose address is **not verified** share one message. We try email
  first; if it can't be used, or the service definitively rejects it, we try text. If
  a service may already have accepted the message, we stop, so an unverified address
  never gets a surprise duplicate.

So if you check both and verify both, you get both. If you verify neither, you get
one message, as before.

Only the channels this site offers appear. For example, if the site does not send
text messages, there is no **Text** column. If the administrator adds a service
later, its column returns with the choices you had.

On a phone, each row shows its description with one checkbox per channel
underneath.

## Contact info

**Contact info** lists your verified addresses under **Email** and **Text**.

To add one, select **+ Add** at the top of the card. Choose **Email** or **Text** if
both are available, enter the address and select **Send code**. Enter the
eight-digit code within 15 minutes; five attempts are allowed. Wait at least one
minute between requests. **+ Add** offers only channels that don't have an address
yet: you can have one verified address per channel. To replace one, remove it and
add the new one.

Verifying lets you reuse the address for events. It does not turn notifications on,
change how you sign in, or replace contacts on existing events.

The **−** button next to an address withdraws that verification. Any event using
the address shows it as **Paused** until you verify again. Removing an address never
unchecks anything in the table. Changing your sign-in email or phone also withdraws
a matching verification, and leaves your event contacts as they were.

## Settings for one event

To change notifications for one event, open that event:

- **Guests** choose **Manage notifications for this event** on their RSVP.
- **Hosts and co-hosts** change their alerts in the event's settings.

An event page has the same table. If you're signed in, **Use my profile settings for
this event** is on at first and the table shows your profile's choices, grayed out.
Turn it off to change the boxes for this event only; it starts from your profile's
choices. Turn it back on to follow your profile again.

If a checked channel can't be used for the event (for example, there is no phone
number, or a contact is paused), the page says so under the table. **Contact info**
below it shows each contact for the event and whether it is **Verified**, **On
file**, **Paused** or **Not verified**.

Hosts and co-hosts change only their own alerts. In event settings, **Notify
organizers of new RSVPs** decides whether alerts exist for the event; **Your RSVP
alerts** below it decides how you receive them. Alerts use your account email or
phone, or an address you verified in your profile and chose with **Use … for this
event**.

## Guests without an account

Use **Manage notifications for this event** from your private RSVP screen or
confirmation. No account is required. Keep that link private: it carries your RSVP
edit authority. Preferences remain manageable after the RSVP deadline.

The page shows masked contacts for this RSVP only. **Change** verifies a new
address and replaces that contact for this event only. A signed-in guest can
instead choose a verified address from their profile. Profile changes never
silently redirect existing event messages. If you RSVP on the public page using
an email or phone number that was already invited, the private link goes to that
invited contact, not to the page.

If you turn confirmations off, keep the private edit link shown after your RSVP; an
email or text is not guaranteed.

## Reminder schedules

Hosts choose when reminders go out; each guest's own settings choose how. Switches
save immediately. A time that has already been sent shows **already sent or
skipped**, and a time that is already over shows **time has passed**; neither will
send. Turning a time off and back on never repeats it.

Schedules from before this upgrade keep their old channel limits, shown in a notice,
until a host chooses **Let each guest's settings decide**. Equal old email/SMS times
merge; different custom-hour times remain separate. Past-due occurrences are not
replayed during upgrade.

The scheduler attempts each occurrence once. A crash or preparation failure after
its claim can lose that occurrence. There is no delivery history or automatic
retry. **Accepted** means accepted for processing, not confirmed inbox/device
delivery. Event updates and saved RSVP answers remain saved when messaging fails.
