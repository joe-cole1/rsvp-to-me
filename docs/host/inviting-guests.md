---
title: Inviting Guests
description: Share a link or send email and text invitations.
category: Guests & RSVPs
audience: host
order: 50
---

# Inviting Guests

There are two ways to get guests to your event: share the link, or send invitations by email or
text. Both live behind the **Invite** button in the host bar on your event page, on the
**Share link** and **Invite people** tabs.

---

## Share the Link

Every event has its own web address. Open **Invite → Share link** to copy it or download a QR
code, then share it however you like — group chat, social media, email signature. Anyone who can
[see the event](visibility-and-privacy.md) can RSVP from the link. On a private event this tab
explains that guests must be invited directly.

---

## Send Invitations

**Invite → Invite people** sends invitations directly:

- **Email invites** go to email addresses (available when email is enabled on your site).
- **Text invites** go to mobile numbers (available when texting is enabled).

Invited guests appear on your guest list with an **Invited** status until they respond.

Their invitation's private link lets them respond directly. If they instead use
the public form and enter their invited contact, they must first verify it by
code, review their response and confirm. Entering an invitee's email or phone
alone neither answers the invitation nor reveals its private link.

### 1. Add recipients

Each row is one person: an optional **name** and an **email or phone number**. Type a name,
press **Enter** to move to the contact, and press **Enter** again to start the next person. A
new empty row always waits at the bottom.

To add many people at once, paste a list into any row or use **Paste a list**. One person per
line works best; commas and semicolons also separate people. These all work:

```text
Alex Rivera <alex@example.com>
"Rivera, Alex" <alex.work@example.com>
Sam Lee sam@example.com
Jordan Park, jordan@example.com
Taylor Kim taylor@example.com; Casey Ng <casey@example.com>; +1 555 123 4567
```

A list can also put the contact first, as in `alex@example.com, Alex, sam@example.com, Sam`. If a
name sits between two contacts and could belong to either, it gets a row of its own; add its
contact there, or remove it.

Each person becomes a row you can edit. Anything that needs attention is flagged on its own row:
a missing or mistyped contact, a contact already in the list under another name, or a phone
number when text invitations are turned off on your site. Fix or remove those rows before
reviewing. Pasting someone who is already in the list with the same (or no) name is skipped
automatically. **Undo** reverses the last paste, import, removal, or **Clear list**.

Names are optional: a new recipient without a name is greeted as "Guest". An existing event guest
keeps their current RSVP name, even if you type a different one. Invitation names belong to this
event and do not change account profiles.

Each contact identifies one primary RSVP; use [plus-ones](managing-rsvps.md#plus-ones) for a
family or party sharing a contact rather than adding the same address or number twice.

### Import a spreadsheet or contacts export

Choose **Import spreadsheet**, then pick a CSV file (for example a Google or Outlook contacts
export) or paste cells copied from a spreadsheet. Pasting cells into any row opens the import
automatically.

RSVP to Me suggests which columns to use — first, middle, and last name columns are combined,
and if a row's email is empty its mobile number can be used instead — and shows the first people
it will add. **First row has column names** is ticked only when the first row has recognizable
labels such as Name, Email, or Phone (or Vorname, Correo, Telefoon); otherwise that row is
imported as a person, so tick it yourself if it holds your own column names. Check the
suggestion, change any column, then choose **Add**. Imported rows join your
list; rows with a missing or invalid contact are added and flagged so you can fix them. Up to 200
people can be invited at a time, and files must be under 2 MB.

### 2. Review and send

**Review** checks each person against this event:

- **Ready to invite** — new guests. They start selected.
- **Already invited** or **Already responded** — they keep their existing RSVP name. Tick anyone
  you deliberately want to send the invitation to again.
- **Can't send** — the contact conflicts with existing guest records; check your guest list.

Use **Preview** on any guest to see their personalized invitation email. Choose **Edit
recipients** to go back and change the list; any change means reviewing again before sending.

After sending, RSVP to Me reports how many invitations went out. Sent guests leave your list;
any that failed stay in it, with the reason, so you can review and retry them without resending
to the guests who already received theirs.

Your list is kept while the event page stays open, so you can close the Invite window and come
back to it. Reloading the page or leaving the event clears it.

> **Anti-abuse:** You can invite up to **200 recipients per request** (paste more than that and it'll ask you to split into batches; once your list has 200 people, typing another is refused until you send or remove some), and there's an hourly cap on how many invite batches you can send per event. When your administrator enables bot protection, each host, co-host, or guest invitation submission also receives an interaction-only security check. These controls prevent spam and runaway texting costs if an account is misused.

### Invitation History

The invitations table tracks when each invite was sent and whether the guest has responded yet, so you can follow up with anyone who hasn't.

Each batch of invites you send also shows up in the event's **activity feed**, attributed to whoever sent it. On a shared event this gives you and your co-hosts a clear record of who invited how many people and when.

---

## Let Guests Invite Friends

On a **Private** event, you can turn on an option that lets your invited guests send their own invitations — handy for word-of-mouth gatherings. See [Visibility & Privacy](visibility-and-privacy.md). This option is only available on private events.

Guests can optionally provide a friend's name with the invitation. The name is saved for this
event only; if the contact already has an RSVP here, its established name is retained.

---

## Reminders for Non-Responders

You don't have to chase people manually — RSVP to Me can automatically nudge guests who haven't responded. See [Messaging Guests & Reminders](messaging-and-reminders.md).
