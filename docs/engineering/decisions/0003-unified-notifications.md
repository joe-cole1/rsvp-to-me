# 0003: Unified notification routing and delivery outcomes

Status: Accepted

Related issues: #335, #767. Task: `01a1a08c`.

## Context

Notification call sites chose email or SMS themselves. Event updates skipped
phone-only guests using the default Both preference, ignored channel opt-outs,
and detached delivery from the result of posting an update. Legacy SMS blast
counts describe requested recipients, not confirmed provider acceptance.

We want application features to describe messages and audiences independently
of delivery services. Site administrators own sender configuration; recipients
choose delivery. Future channels may need their own connection, consent,
template, and inbound-message handling.

## Decision

`lib/notifications/` owns typed message intent, recipient policy, an adapter
registry, bounded transport requests, and structured outcomes. Event-domain
resolution owns audience selection and supplies current RSVP contacts and
linked-user preferences. Adapters do not discover identities or borrow profile
contacts. Authentication and account verification remain separate.

A channel is a recipient-facing service, such as email or SMS. Providers are
the implementations behind it, such as SMTP, Cloudflare, and Twilio. The generic
dispatcher knows registered channel identifiers, not address formats or provider
credentials. Native adapters validate destinations, render service-specific
content, and acknowledge individual outcomes. Email retains locale grouping,
BCC privacy, existing templates, reply-to, and `resolveEmailTheme()`.

The first adopter is event updates only. Current Email and SMS preferences
permit only that channel. Both maps to preferred email followed by SMS; it does
not opt existing users into duplicate notifications. Unlinked RSVPs use their
available event contacts in the same order. Channel opt-outs, availability,
configuration, and destination validity constrain every route. Audience
membership is unchanged.

The internal policy also supports explicit multi-channel delivery. Each selected
channel is a separate intended delivery, with duplicate selections removed.
Exposing this policy requires a later, explicit preference migration.

Fallback is allowed after unavailable routes or definitive rejection. Provider
acceptance ends fallback; uncertain acceptance also ends it. HTTP timeouts,
network exceptions, server errors, missing acknowledgements, and unclassified
SMTP errors are conservatively uncertain. Explicit SMTP rejection and HTTP
client rejections other than request timeout permit fallback. Configured SMTP
fallback follows the same rule after a Cloudflare request.

The shared request gate permits ten concurrent provider requests per dispatch
and a thirty-second deadline per request. HTTP receives an abort signal; timed-out
SMTP transports are closed. There are no automatic retries or durable jobs.

Results distinguish accepted, skipped, failed, and uncertain. Accepted means
acknowledged for processing, not inbox/device delivery. A preferred route's
failed primary followed by accepted fallback counts as one accepted delivery;
internal attempts retain both outcomes. SMTP partial acceptance is resolved by
recipient. Console-only handling never counts as acceptance.

An event update is saved before delivery starts. Its action awaits processing
and returns an additive, contact-free summary or a generic preparation failure.
Notification failure never reverses a posted update. The host sees transient
feedback, not a persisted delivery history. Diagnostics exclude raw provider
payloads, destinations, authored content, credentials, and private links.

## Compatibility and next steps

No dependency, schema, environment variable, or credential-setting change is
required. Legacy send helpers retain their interfaces and behavior for other
notification producers. Their historical count/return semantics must not be
used as acceptance evidence by new adopters. Other flows have not yet adopted
this policy, and the application is not yet a fully unified messaging system.

The next milestone is explicit delivery modes, profile connections/defaults,
notification categories, and event overrides. Include an event-scoped route for
guests without a signed-in account. Require account or RSVP authority plus
service-specific destination proof; never silently enable new channels or
infer cross-service identity from a shared phone number.

Then migrate notification producers and add reviewed native adapters or
administrator-configured bridges. Keep #767 open until actual integrations
ship. Bridges require separate credential, network, and webhook safeguards;
the registry is not an arbitrary URL or executable-plugin facility.

Durable jobs, safe retries, attempt history, and normalized inbound RSVP commands
are later milestones. Inbound provider verification must precede existing event
authorization and RSVP domain rules. General conversations and authentication
are not part of this foundation.

Manual email/SMS blast actions also omit guest opt-out fields. Their follow-on
tracker is [#789](https://github.com/joe-cole1/rsvp-to-me/issues/789); this PR does
not change their recipient policy.

## Recipient preferences milestone (`01a1a105`)

The next milestone extends the accepted foundation to updates, reminders
(including unanswered-invitation nudges), RSVP confirmations/approval decisions,
and host alerts. Authentication, initial invitations, co-host invitations,
manual blasts (#789), integrations (#767), inbound RSVP, and durable delivery
remain separate. Earlier statements above describing event updates as the only
adopter describe the foundation release.

Preferences use registry channel identifiers, profile defaults, profile category
rows, RSVP event rows, and personal organizer rows. A category row is an explicit
list of the channels that message type may use; an empty list turns it off. A
message type resolves event row → profile row → profile default. Hard channel
blocks (kept only from the old opt-out switches) apply last. An event row can
turn on a channel the profile row left off; it cannot override a hard block or
revoked destination proof. There is no delivery mode and no channel order.
(Superseded 2026-11-05, before release: the first draft had ordered `preferred`
fallback, an explicit `all` mode and per-scope event defaults. Manual QC found
them too complex for recipients.)

Recipients edit preferences as a table: one row per message type, one checkbox per
channel, and every checked channel is used (see proof below). The profile always
writes every row. An event scope either follows the profile (no rows) or writes
every row it controls; signed-in guests and organizers switch between the two,
and guests without an account edit their rows directly. New adapters (#767) add a
column, not combinations. Channels the site does not offer (not enabled by an
administrator, or not configured) are hidden everywhere; their stored state is
kept and returns if the administrator enables them. Saving the table lifts old
hard blocks on the channels it shows. Changes save immediately.

`NotificationSettings` and its category rows are the preference source of truth.
The scope is an account profile, an RSVP, or an event/account organizer pair.
Revision checks and transaction advisory locks reject stale writes. Legacy flags
are conservative projections, not the permanent model. The retired unversioned
writers were removed; stale clients fail as unknown server actions. Old workers
must be stopped at upgrade.

Verification and consent are separate. Proof is required where a destination is
added or replaced, and decides separate copies at send time: every checked channel
whose exact destination is proved gets its own copy, and the unproved checked
channels share one message, tried email first, then text. A contact nobody
verified therefore never gets more than the single message the old preferred
order would have sent. Changing consent (checking or unchecking a box, following
the profile, lifting one's own block) needs no proof because it adds no destination.
Connections are separate from login identity. Enrollment uses a hashed,
15-minute, single-use eight-digit destination challenge with five attempts,
resend cooldown, account/destination/IP limits, and the existing CAPTCHA boundary.
Completion requires the originating account or event RSVP authority. Existing
User rows may originate from unverified RSVP/invitation claims; migration does
not fabricate proof. Public RSVP IDs and claimed contacts confer no authority.
Used or expired challenges are purged a day later by the existing cleanup job.

Event RSVP contacts are eligible because the event holds them; opt-outs are
preferences, never an eligibility snapshot. A profile connection never
substitutes its destination into an existing event. Guests explicitly verify a
destination for one RSVP, or explicitly bind a proved profile connection with
event authority. Organizer account contacts can come from unverified claims, so
only the event's old alert switches vouch for them: an organizer row records that
eligibility (at migration, or on the organizer's first write), and without a row
the current switches apply. Organizers inherit their profile route and may bind
their own connections per event. The event's alert switch decides whether alerts
exist; each organizer decides how to receive them. RSVP contact changes share
invitation contact locks, check collisions, and never rewrite another account or
invitation history. Account contact verification no longer rewrites linked RSVP
contacts.

Removing a verified address, or changing the sign-in contact it matched, revokes
that proof and its bindings; it never blocks the channel. A contact whose proof
was revoked or superseded is paused until verified again: binding generations and
persistent revocation keep fallback from resurrecting it. The management view is
built from the same resolvers producers use, so it reports paused, missing and
unverified contacts and never claims a route that would not send. A provider
submission rechecks current policy/contact authority; submissions already in
flight cannot be recalled. Account tombstoning explicitly removes
notification-owned records, and event and organizer removal clean up their
settings. Only masked DTOs are serialized. Private guest management is
non-indexable, non-cacheable and uses no-referrer.

A public RSVP that merges into an existing INVITED RSVP returns no edit token:
the private link reaches the invited contact only, through its confirmation.
Whether such a merge should happen at all is a separate follow-on.

Migration keeps the old scope of every legacy choice. The old Email/SMS switches
covered reminders and host blasts, the channel choice covered event updates, and
transactional messages were always sent. Profiles therefore check every channel
with no hard blocks, and category rows carry the old update/reminder restrictions.
No proof is migrated, so Both still means one message, email then SMS.
Organizer rows record the event switches, ignoring blast opt-outs that old host
alerts ignored; events whose alerts were off get no row. Explicit `all` delivery
requires proof for each actual destination. Future channels require explicit
enrollment and selection; registry availability alone never opts recipients in.

Equal reminder timings merge; distinct hour offsets survive. Either old sent
marker consumes a merged occurrence. Already-due occurrences are consumed at
upgrade to avoid catch-up bursts. Migrated schedules keep their channel limits
until a host explicitly lets each guest's settings decide; changing times does
not lift them. Disabling/re-enabling an occurrence retains its consumed marker,
and the schedule shows consumed or passed times as such. Week and day reminders
keep their natural wording; other offsets use pluralized hours. The cron lock and
atomic occurrence claim avoid duplicate scheduler claims. Claims happen before
submission, including partial/uncertain outcomes. A crash after claiming can lose
that occurrence; no queue, automatic retry, attempt history, or exactly-once
guarantee is introduced.

Downgrading to a legacy binary after preference changes would bypass category,
event and revocation controls. Disable notification production or restore a
consistent pre-upgrade backup before downgrading; retaining legacy columns alone
does not make that downgrade behaviorally compatible.
