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
