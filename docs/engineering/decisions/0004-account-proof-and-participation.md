# 0004: Account proof, revocation, and participation identity

Status: Accepted

Task: `01a1dc08`.

## Decision

PostgreSQL session rows and the current user role are authoritative on every
session read. Redis snapshots never establish validity or privileges. Account
deletion revokes database sessions and removes their known Redis keys through
`revokeUserSessions`; a failed cache eviction or late cache fill cannot restore
access. Scheduling deletion signs out existing sessions, but a new verified
sign-in during the grace period can still cancel deletion. Tombstoned accounts
with neither sign-in contact cannot authenticate.

Registration stores proposed names and host-invite references only in the
short-lived paired LOGIN challenge. Successful link or code consumption applies
the registration intent. Invite usage is checked and incremented under a row
lock at proof time. Existing host/admin profiles are not overwritten by another
registration request. Resending an unexpired challenge preserves its intent.

Co-host invitation links are navigation only. The recipient signs in using the
normal short-lived proof and explicitly accepts using the invited account.
Acceptance consumes the invitation and assigns membership in one transaction.
It never creates a session or performs initial-administrator promotion.
Sign-out is a same-origin POST.

Votes and potluck claims use a server-resolved RSVP id for guests, or account id
for organizers. Display names remain presentation. Per-poll/item row locks
serialize vote replacement and capacity checks. A claim is removed by its exact
id after checking guest ownership or organizer authority.

Historical participation remains visible without inferred ownership. The
migration clears old vote account links because those were recorded alongside
arbitrary guest-token authority. Existing names, quantities and vote counts are
preserved; hosts can remove historical claims. No backfill guesses an RSVP from
a matching name.

## Consequences

Session reads require PostgreSQL availability and fail closed on errors. They
incur a database read even when Redis has a snapshot. Password unlock signatures
include the current password hash, invalidating old cookies on password change
and at this upgrade. Stored images use only validated upload paths; malformed
legacy image URLs render without an image and are never fetched for social
artwork. Downgrading participation identity requires restoring a compatible
backup; the old display-name uniqueness constraint cannot represent new
same-name votes.
