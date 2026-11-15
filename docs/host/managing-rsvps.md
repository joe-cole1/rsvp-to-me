---
title: Managing RSVPs
description: Statuses, approval, capacity, plus-ones, questionnaires, and edit links.
category: Guests & RSVPs
audience: host
order: 60
---

# Managing RSVPs

Everything about how guests respond — and how you control it — lives in your event's **Settings** and on the [guest list](guest-list.md).

On the guest-facing event page, the RSVP card stays at the bottom of the screen while responses are open, then docks into its normal place as the guest reaches it. After responding, the card becomes a small Going, Maybe, Can't make it, or Awaiting approval summary with an edit link when changes are allowed. It stops floating once the response window closes or the event starts.

---

## Completing the RSVP form

Guests see visible labels for their name and optional contact details. If a name,
required companion name or questionnaire answer is missing, or an email address is
invalid, submitting announces the problem and moves focus to the first field that
needs attention. The response is saved only after those fields are complete. Server
errors, such as an event reaching capacity, are also announced.

Keyboard users can use **Skip to content** at the top of each page to bypass navigation.

## RSVP Statuses

Guests respond **Going**, **Maybe**, or **No**. You can turn off the **Maybe** option per event if you only want a yes/no.

The guest's Going confirmation uses a green circled checkmark beside its status label.

---

## Approval

Turn on **Approval Required** when you want to vet responses. New RSVPs then wait in a **pending** state until you **Approve** or **Decline** them from the guest list, and the guest is notified of your decision. (A pending guest's response is still recorded — they're just not approved yet.)

---

## Capacity Limits

Set a maximum number of approved primary **Going** RSVPs. Plus-ones do not consume
additional capacity slots. Guest submissions check and save under a database lock,
including text replies, so simultaneous guests cannot claim the same final slot.
Hosts and co-hosts can still override guest limits when managing the guest list.
Once that limit is reached:

- Additional guests can no longer mark themselves **Going** — they'll see the event is at capacity.
- Guests can still respond **Maybe** or **No**.
- To make room, raise the capacity in Settings.

---

## Plus-Ones

- Allow or disallow plus-ones.
- Set a maximum plus-one count per guest.
- Optionally require names for plus-ones.

Plus-ones are stored on the main guest's Going RSVP. They aren't separate accounts
and don't have their own contact details. The server enforces whether plus-ones
are allowed, the configured maximum, and required names. Choosing Maybe or No
clears the companion count and names.

---

## RSVP Deadlines & Editing Gates

You can set an optional **RSVP deadline** on your event under Settings → RSVP.

- **Before the deadline:** Guests can RSVP and edit their RSVP at any time.
- **After the deadline:**
  - New guests are prevented from RSVPing, and they will see a "RSVPs Closed" notice.
  - Existing guests cannot edit their RSVP from their unique edit link unless the **Allow guests to edit RSVPs after deadline** option is enabled in settings. If disabled, their edit links will be hidden/gated.
  - A direct submission through an existing private edit link can still decline
    before the event starts, even when other post-deadline edits are disabled.
  - Hosts and co-hosts are exempt from these deadline restrictions and can manage RSVPs at any time.

The event's scheduled start is a final guest cutoff. Once `startAt` is reached, guests cannot submit
a new RSVP or change an existing one, even when post-deadline editing is enabled. A guest opening
their private edit link sees a read-only summary and instructions to contact the host. Hosts,
co-hosts, and admins can continue editing responses at any time. If the event is rescheduled into the
future, guest RSVP access automatically reopens under the normal deadline rules.

---

## Custom Questionnaires

Add your own questions to the RSVP form (dietary needs, song requests, t-shirt size — whatever you need):

- **Field types:** single-line text, multi-line text, dropdown, and checkbox.
- **Required or optional:** mark each question as needed.
- **Reordering:** drag questions to set their order on the form.

Answers appear with each guest and are included in the [CSV export](guest-list.md).

---

## Guest Edit Links

Guests don't need an account to change their RSVP. Every invitation and confirmation includes a
private link unique to that guest; clicking it lets them update their status or answers until the
event starts. If a guest loses their link, see the [FAQ](faq.md).

An invited guest's first answer through their invitation link or a signed SMS reply counts as their RSVP: they see the
usual "You're in!" confirmation, get a confirmation email or text at the contact you invited, and
you get a **New RSVP** alert (see [Messaging Guests & Reminders](messaging-and-reminders.md)).

After responding, a guest whose RSVP has an email or phone is told they can change it from the
link in their invitation or confirmation. Only a guest who RSVPs without any contact is asked to
copy and save their edit link. When you edit such a guest's RSVP from the guest list, the
confirmation shows **This guest's edit link** so you can copy it and send it to them yourself.

Guests can also correct their name through their private edit link while editing is allowed.
Hosts and co-hosts can correct the name when editing the RSVP from the guest list. These changes
update the guest's name for this event only; they do not rename an account or affect other events.

---

## Anti-Abuse

When the site administrator enables bot protection, every new or edited RSVP must pass an
interaction-only security check before it is saved. The same protection applies when a host or
co-host edits an RSVP or records a walk-in, because organizer accounts can also be abused. Most
legitimate users see no prompt. Separate protected tasks can remain in progress at the same time;
for example, an image upload does not block an RSVP or comment from passing its own check.

New RSVP submissions are rate-limited for each supplied email address and phone number,
both overall and per event, before any confirmation email or text is sent. When the site
administrator configures a trusted proxy IP header, additional per-IP limits help stop
abuse across different contacts. Without that configuration, unrelated guests do not share
one site-wide IP quota. Contactless RSVPs depend on the IP tier or enabled bot protection.

Password-protected events also limit password attempts. Without trusted proxy configuration,
guests share a cap of 10 attempts per event per 10 minutes. If guests on different networks
are unexpectedly sharing a limit, ask your site administrator to review
[`TRUSTED_IP_HEADER`](../admin/configuration.md#trusted_ip_header). Blocked retries do not
extend the rate-limit window; wait for it to expire before trying again.
