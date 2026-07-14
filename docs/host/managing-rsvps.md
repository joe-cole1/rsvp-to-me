---
title: Managing RSVPs
description: Statuses, approval, capacity, plus-ones, questionnaires, and edit links.
category: Guests & RSVPs
audience: host
order: 60
---

# Managing RSVPs

Everything about how guests respond — and how you control it — lives in your event's **Settings** and on the [guest list](guest-list.md).

---

## RSVP Statuses

Guests respond **Going**, **Maybe**, or **No**. You can turn off the **Maybe** option per event if you only want a yes/no.

---

## Approval

Turn on **Approval Required** when you want to vet responses. New RSVPs then wait in a **pending** state until you **Approve** or **Decline** them from the guest list, and the guest is notified of your decision. (A pending guest's response is still recorded — they're just not approved yet.)

---

## Capacity Limits

Set a maximum number of **Going** guests. Once that limit is reached:

- Additional guests can no longer mark themselves **Going** — they'll see the event is at capacity.
- Guests can still respond **Maybe** or **No**.
- To make room, raise the capacity in Settings.

---

## Plus-Ones

- Allow or disallow plus-ones.
- Set a maximum plus-one count per guest.
- Optionally require names for plus-ones.

Plus-ones are counted on the main guest's RSVP and share that guest's status. They aren't separate accounts and don't have their own contact details.

---

## RSVP Deadlines & Editing Gates

You can set an optional **RSVP deadline** on your event under Settings → RSVP.

- **Before the deadline:** Guests can RSVP and edit their RSVP at any time.
- **After the deadline:**
  - New guests are prevented from RSVPing, and they will see a "RSVPs Closed" notice.
  - Existing guests cannot edit their RSVP from their unique edit link unless the **Allow guests to edit RSVPs after deadline** option is enabled in settings. If disabled, their edit links will be hidden/gated.
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

Guests don't need an account to change their RSVP. Every confirmation email includes a private link
unique to that guest; clicking it lets them update their status or answers until the event starts. If
a guest loses their link, see the [FAQ](faq.md).

---

## Anti-Abuse

To prevent spam and runaway messaging costs, RSVP submissions are rate-limited per client IP (both overall and per event). Real guests won't notice — the limits are far above normal use — but automated bursts of fake RSVPs are throttled before any confirmation email or text is sent.
