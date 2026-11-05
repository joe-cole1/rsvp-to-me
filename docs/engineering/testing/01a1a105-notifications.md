# Local notification milestone test plan — `01a1a105`

Run Git, Node, npm, Prisma and tests natively in WSL. Docker Compose supplies
Postgres and Redis. Use synthetic contacts and a loopback SMTP capture service;
do not send test messages through live providers or to real recipients.

## Environment and gates

1. Confirm the task branch and intended diff; preserve other worktrees.
2. Run `scripts/dev-sync.sh` to start Docker Postgres/Redis, generate Prisma,
   apply all three additive migrations and seed baseline data. No dependency
   refresh or manifest/lockfile change is required.
3. Use an isolated local preview database for browser fixtures. Keep sender
   configuration pointed at a local SMTP capture server; use mocked Twilio
   responses for SMS assertions. Do not import live sender credentials.
4. Run targeted preference, authority, adapter, management and scheduler tests.
5. Run `scripts/preflight.sh` in full. Its disposable Postgres/Redis use ports
   55432/56399 and its app uses port 3001, separate from the local dev services.
   It includes migrations, production dependency audits, formatting, lint,
   coverage, integration/component tests, worker bundle/types, app build/types,
   Chromium Docker parity/smoke checks and the complete Playwright E2E suite.
6. Review the final diff and record every gate result. A failed/unavailable gate
   requires correction or an explicit narrow waiver, never a passing claim.

## Browser and delivery matrix

| Area               | Exercise                                                                   | Expected result                                                                                            |
| ------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Profile table      | Check and uncheck boxes; reload                                            | Each box saves at once and survives reload; every row is saved; no order or mode controls                  |
| Saving             | Change any box or switch                                                   | Saves at once with a confirmation; a failed save restores it and explains why; a stale page says to reload |
| Availability       | Disable SMS (or leave it unconfigured) as administrator                    | No Text column anywhere; stored choices return when SMS is enabled again                                   |
| Copies             | Check Email and Text, verify neither, then both                            | Unverified: one message, email first; each verified address gets its own copy                              |
| All off            | Uncheck every box in a row                                                 | Allowed; that message stops                                                                                |
| Enrollment         | Verify an additional address                                               | No sign-in, RSVP contact, category or channel change                                                       |
| Consent            | Uncheck a row, then check it again                                         | No verification code is requested                                                                          |
| Old opt-outs       | A profile with an old opt-out block, then save the table                   | The blocked channel shows unchecked; saving lifts the block for shown channels only                        |
| Event inheritance  | Turn off Use my profile settings, change boxes, turn it back on            | Table copies the profile first; turning it on follows the profile again                                    |
| Guest              | Open private management without a session                                  | Only that RSVP is manageable; no profile or foreign event records appear                                   |
| Authority          | Public RSVP ID, wrong event token, forged connection/account ID            | No read/write authority or destination substitution                                                        |
| Invitation merge   | RSVP on the public page with an invited guest's email                      | No private link is shown; the invited contact receives the confirmation                                    |
| Proof              | Wrong, expired, replayed, five failed attempts, concurrent completion      | No activation; attempts commit; at most one successful consumption                                         |
| Resend             | Concurrent sends, less than 60 seconds, owner/destination/IP hourly caps   | Bounded requests; one current challenge; no real SMS charges                                               |
| Destination change | Change a contact on one RSVP                                               | Only that contact changes; account and invitation history stay unchanged                                   |
| Reuse              | Verify an address, then Use it for a guest/organizer event                 | No redirect on enrollment; explicit authorized event binding works                                         |
| Remove             | Remove a verified address used by an event                                 | Event contact shows Paused and the page says the channel can’t be used; no box is unchecked                |
| Profile contact    | Verify a changed sign-in email/phone                                       | Event contacts remain intact; matching proof retires; no channel is blocked                                |
| Updates            | Post with all recipients opted out or provider unavailable                 | Update remains saved; aggregate skipped/failure feedback has no contacts                                   |
| Confirmations      | Public RSVP, invited first answer, repeat edit, approve/decline            | Preferences enforced; first answer notifies once; later edits stay quiet                                   |
| RSVP failure       | Fail the write after the first-response claim                              | Transaction rolls back; nothing sends; successful retry can notify                                         |
| Organizers         | Turn off Use my profile settings unchanged, then RSVP                      | Alert still reaches the account email                                                                      |
| Organizer switch   | Turn Notify organizers off and on                                          | Personal section hides and returns; text alerts are never turned on by the switch                          |
| Reminders          | Equal and distinct legacy times, sent marker on one side, past-due upgrade | Times/limits preserved and named; merged consumed occurrence and overdue slots do not replay               |
| Schedule edits     | Toggle a consumed and a passed time; convert a legacy schedule             | Labels say already sent or time has passed; consumed state never resets; limits lift only on conversion    |
| Copy               | Week, day, hour and nudge reminders                                        | Natural week/day wording and pluralized hours in all locales                                               |
| Nudge              | Answered, opted-out, stale, dangling and cross-event invitation contacts   | Only current matching unanswered event contacts are eligible                                               |
| Transport          | Definitive rejection, acceptance, uncertainty, partial SMTP acceptance     | Allowed fallback only after rejection/unavailable; no fallback after uncertainty/acceptance                |
| Limits             | Delayed HTTP/SMTP and large eligible audience                              | Ten provider requests at most; 30-second cancellation deadlines preserved                                  |
| Load               | Slow and failed initial loads                                              | Guest page renders from server data; failures show Try again, never endless loading                        |
| Privacy            | Inspect HTML/RSC/actions, headers, console, screenshots                    | Masked DTOs; no credentials/proof/private links in diagnostics; private/no-store and no-referrer           |
| Locale             | English, Dutch, German, Spanish; unknown stored locale                     | UI/default notifications localize; safe English fallback; authored content stays literal                   |
| Responsive         | Desktop and 390px viewport, keyboard-only interaction                      | Table stacks per row on phones; named checkboxes and switches with state; no horizontal overflow           |
| Cleanup            | RSVP/event/account/organizer removal; day-old challenges                   | Scoped records removed or revoked; used/expired challenges purged                                          |
| Exclusions         | Manual blast, invitation, sign-in, existing inbound SMS                    | Scope stated accurately; no new integration, bridge, queue, history or inbound behavior implied            |

## Evidence before shipping

Capture the desktop profile table and contact info, guest event preferences, organizer event
selection and shared reminder schedule, plus a mobile guest view. Use only
synthetic fixture data and crop out browser URLs, cookies, proof codes and private
links. Record the local database migration result, targeted tests, full preflight
result and any remaining manual/live-provider checks separately.

A local SMTP acknowledgement proves submission only. Unit/provider fixtures
cover SMS and rejection/uncertainty; they do not establish real Twilio delivery.
No production mutation or external message is part of this local test plan.
Implementation approval does not authorize shipping. A fresh `ship it` is needed
after review; merging, releases and production deployment remain separate.
