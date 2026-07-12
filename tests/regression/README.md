# Regression Tests

Tests that reproduce specific bugs found in production or staging. Each file corresponds to a specific bug fix.

## Convention

For every bug fix merged to main:

1. Create a test file named after the bug: `tests/regression/issue-123-slug-collision.test.ts`
2. The test must **fail** before the fix is applied and **pass** after
3. Add a comment at the top explaining the original bug, when it was found, and what caused it
4. Update the index table below
5. These run as part of `npm test` — use the standard Vitest unit test setup (mocking, factories)

## Index

| File                                                 | Bug description                                                                                                    | Fixed in |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| `sec-11-twilio-xml-injection.test.ts`                | XML injection via unescaped event title/guest name in Twilio TwiML response                                        | SEC-11   |
| `sec-16-csv-formula-injection.test.ts`               | CSV formula injection via attacker-controlled guest name/email in export                                           | SEC-16   |
| `sec-19-event-password-rate-limit.test.ts`           | Unbounded brute-force of password-gated events (no attempt cap)                                                    | SEC-19   |
| `sec-20-save-event-settings-mass-assignment.test.ts` | Mass assignment of arbitrary Event columns via `saveEventSettings`                                                 | SEC-20   |
| `sec-13-cross-event-parent-comment.test.ts`          | Reply threaded under a parent comment from a different event                                                       | SEC-13   |
| `sec-17-comment-authz-spoofing.test.ts`              | Authenticated comment authZ bypass + free-form `guestName` impersonation                                           | SEC-17   |
| `sec-12-rsvp-capacity-race.test.ts`                  | Non-atomic count-then-create capacity check lets concurrent RSVPs overbook                                         | SEC-12   |
| `sec-21b-updaterspv-capacity-deadline.test.ts`       | `updateRSVP` skipped deadline/capacity re-check (capacity-bypass via token)                                        | SEC-21b  |
| `sec-18-guest-invite-rate-limit.test.ts`             | Uncapped outbound email/SMS via guest invite (no rate limit / per-RSVP cap)                                        | SEC-18   |
| `sec-22-client-ip-spoofing.test.ts`                  | Spoofable `X-Forwarded-For` defeated every IP-keyed rate limiter                                                   | SEC-22   |
| `sec-23-addrsvp-rate-limit.test.ts`                  | Unauthenticated `addRSVP` fan-out to arbitrary email/SMS with no rate limit                                        | SEC-23   |
| `sec-24-guest-identity-token.test.ts`                | Guest comment/vote/potluck identity spoofable via public `rsvpId` + name                                           | SEC-24   |
| `sec-29-invite-guest-rate-limit.test.ts`             | Host `inviteGuest` fan-out had no batch cap or rate limit                                                          | SEC-29   |
| `sec-26-sms-token-decrypt.test.ts`                   | DB-configured Twilio auth token never decrypted (broken `enc:` check)                                              | SEC-26   |
| `sec-27-twilio-webhook-db-token.test.ts`             | Twilio inbound webhook validated only against the env token, not DB config                                         | SEC-27   |
| `sec-25-docker-default-creds.test.ts`                | Compose files shipped weak default DB/Redis passwords + host-exposed 5432                                          | SEC-25   |
| `sec-31-health-info-leak.test.ts`                    | `/api/health` leaked migration/DB state + timestamp to anonymous callers                                           | SEC-31   |
| `sec-30-cohost-authz.test.ts`                        | Inconsistent host/co-host authz: co-hosts blocked from documented actions                                          | SEC-30   |
| `l7-slug-collision-bound.test.ts`                    | `generateUniqueSlug` scanned sequential suffixes in an unbounded query loop                                        | L-7      |
| `bug-03-admin-mobile-drawer-trigger.test.ts`         | Admin mobile drawer had no trigger — nothing called `setIsDrawerOpen(true)`                                        | BUG-03   |
| `l4b-invite-friend-swallowed-error.test.ts`          | `inviteFriendAsGuest` activity-log failure swallowed by bare `.catch()`                                            | L-4b     |
| `sec-34-event-access-gates.test.ts`                  | PRIVATE/password gate bypass on calendar.ics / guests / rsvp routes + guest RSVP editToken/PII leak in RSC payload | SEC-34   |
| `cohost-invite-reorder.test.ts`                      | Test co-host invitation flow and event info section widget reordering actions                                      | CH-REORD |
| `sec-14-admin-error-sanitization.test.ts`            | Surfacing raw SMTP/Twilio configuration errors to the admin UI (information disclosure)                            | SEC-14   |
| `sec-7-ssrf-ip-hardening.test.ts`                    | SSRF URL validation bypasses via loopback and private subnets                                                      | SEC-7    |
| `sec-35-signin-enumeration-shared-ip.test.ts`        | Sign-in leaked account existence (success vs. auth_failed) + shared loopback IP bucket locked out all sign-ins     | SEC-35   |
| `sec-36-invite-guest-activity-log.test.ts`           | Host/co-host `inviteGuest` issuance wrote no ActivityEvent — invite blasts were unattributable                     | SEC-36   |
