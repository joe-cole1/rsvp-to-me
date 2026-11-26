---
title: Visibility & Privacy
description: Public, unlisted, and private events, plus password protection.
category: Your Event
audience: host
order: 40
---

# Visibility & Privacy

Control who can find and view your event from **Settings → Display options**.
Event visibility appears first, with its password and private-event options directly below it,
followed by the guest controls.

Guests you invited who haven't replied yet stay off every guest-facing list unless
you turn on the **Invited** row under **Guest RSVP display**. See
[Guest list](guest-list.md#showing-invited-guests) for what that shows.

## Browser Page Protection

Event pages receive a fresh security token each time they are opened. It lets
the page's own scripts run while blocking unexpected inline scripts. This
protection does not change who can find or view your event; the visibility and
guest settings below remain the controls for that choice.

---

## Visibility Modes

- **Public** — anyone can view the event unless a password is set, and it may appear on the site's public event feed when it has no password.
- **Unlisted** — people with the direct link can view it unless a password is set. It won't show up in any public listing.
- **Private** — only hosts and invited guests can view it. Private events also unlock two extra options below. On info-only events (where **Collect RSVPs** is off and no guest invitations are sent), set an **Event password** so visitors you share the link with can unlock the page.

## Event URLs

New **Public** events start with a readable address based on their title, such as
`/e/thanksgiving`. New **Unlisted** and **Private** events start with a random
six-character address, such as `/e/K7m2Qa`. Codes use uppercase and lowercase
letters and numbers; addresses are case-sensitive. Generated links retry
collisions and grow to eight, ten or twelve characters if necessary.

In **Settings → Display options → Event URL**, edit the part after `/e/`, review
the preview, and choose **Save URL**. Use letters, numbers and single hyphens,
starting and ending with a letter or number (80 characters maximum). Changing the
event title does not change its URL. A custom address already in use is rejected
without changing your current link.

- Keep the random code and add a readable name, such as
  `/e/thanksgiving-K7m2Qa`, or choose **Add random code** to generate one.
- Choose **Generate new link** to preview a replacement random address. It does
  not take effect until you save and confirm. Readable prefixes are limited to
  50 characters when adding a code; longer prefixes are shortened in the preview.
- For an **Unlisted** custom address without a generated code, a warning explains
  that someone could guess it. Choose **Use this URL**, **Add random code**, or
  **Cancel**. The same choice appears before changing a readable Public or Private
  link to Unlisted. The current visibility stays active until the save succeeds.
- Public custom addresses do not need this warning. Private custom addresses
  keep their invitation/password access rules even if someone guesses the URL.

Changing an existing URL requires a separate confirmation: previously shared
event, invitation, RSVP and calendar links stop working, and the old address does
not forward to the new one. Share the updated links with guests. Password-unlocked
visitors may need to enter the password again at the new address. A failed save
keeps the confirmed URL and visibility; your draft remains available to retry.

Existing events keep their addresses until a host changes them. Older Unlisted
links may be guessable: generate a new link or use Private visibility/password
protection when needed. Six-character codes make casual guessing harder but do
not authenticate visitors. Anyone who obtains an Unlisted link can share it.
Changing a formerly Public event to Unlisted cannot retract information already
seen or copied.

---

## Password Protection

For a **Private** event, you can set a password that guests must enter before they can see the page.

Changing visibility to **Public** or **Unlisted** keeps an existing password active.
The password field and **SET** badge remain visible in Display options while a
password is set, whichever visibility you choose.

To change it, enter a new password and choose **Save new password**. To remove it,
choose **Remove password** and confirm. You don't need to type or clear anything
first. The password status changes after a successful save; if saving fails, the
current password remains active and you can retry. Removing a password from a
Private event still leaves it invite-only.

- Once a guest enters the correct password, the event stays unlocked in their browser for a while.
- The password never appears in the web address, so it's safe to share the link separately from the password.

---

## Let Guests Invite Friends _(Private events)_

On a **Private** event, you can allow your invited guests to bring others by sending their own invitations. Turn this on in Settings when you want word-of-mouth invites; leave it off to keep the guest list strictly to people you invite.

---

## What the Gate Protects

Privacy and password protection cover the **whole event**, not just the main page. The same check guards every part of a Private or password-protected event:

- The **event page** itself.
- The **guest list** page.
- The **RSVP form** (nobody can respond without being let in).
- The **Add to Calendar** (`.ics`) download link used in your invite emails.

Link previews follow the same privacy boundary. Published Public and Unlisted events can show their title, description, date, cover, and theme when their link is shared to social or messaging apps. Private, password-protected, draft, cancelled, or deleted events expose only a generic event-invitation preview. Unlisted previews work for people who receive the direct link, but remain excluded from search indexing.

The signed-out home page lists the next 20 published **Public** events whose
start time is still in the future and which have no password. It respects your
Going count setting, including **Hidden** and **3+**; events with restricted
guest lists or info-only events (**Collect RSVPs** off) show no attendance count there. Only approved Going RSVPs count.

A visitor gets through only if they are a host or co-host, an invited guest opening their personal link, or someone who has already entered the password. Everyone else is turned away consistently across all of these — so a Private event's details, guest list, and calendar file can't be pulled up by guessing the address.

---

## Choosing the Right Mode

- Hosting something open to the community? **Public.**
- Sharing with a specific group but don't need it hidden behind a login? **Unlisted.**
- Sensitive or invite-only gathering? **Private**, optionally with a password.

## Password changes and participation

Changing an event password requires visitors with an old unlock to enter the new
password. RSVP and comment submissions enforce the event's access rules on the
server, and new submissions are accepted only for published events. Host-only
check-in activity stays private, including in guests' dashboard activity feeds.
