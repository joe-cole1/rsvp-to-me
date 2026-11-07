# Regression Tests

Tests that reproduce specific bugs found in production or staging. Each file corresponds to a specific bug fix.

## Convention

For every bug fix merged to main:

1. Create a test file named after the bug: `tests/regression/issue-123-slug-collision.test.ts`
2. The test must **fail** before the fix is applied and **pass** after
3. Add a comment at the top explaining the original bug, when it was found, and what caused it
4. Update the index table below
5. These run as part of `npm test` — use the standard Vitest unit test setup (mocking, factories)

October 2026 (`8a8fb7bf`) extends `dependency-security-baseline.test.ts` with updated security floors and package-group synchronization checks. PR #775 (`01a19bc3`) adds stable minimum floors for the Cloudflare worker toolchain so compatible lockfile upgrades do not fail exact-version assertions. #779/#603 (`01a19ceb`) extend this policy to runtime `tsx`, reject reintroduced deepmerge-ts overrides, and require Joi 18.3.1 for GHSA-4528-x5fx-h6hg.

PR #818 (`01a1b35c`) adds fixtures to `dependency-security-baseline.test.ts` that
accept coordinated Vitest upgrades and reject partial manifest or resolved-version
updates. The original failure resolved both packages to 5.1.0 while leaving the
runner declared at `^5.0.5` and coverage at `^5.1.0`.

## Index

Task `01a1b4d4` addresses #825 (batch 11 of #814) in
`issue-825-amount-size-independence.test.tsx`: #811's Amount choice wrote both the
stored density and the stored size, so picking an Amount overwrote a host's size and
size couldn't be set on its own. Amount now changes particle count only, Size is its
own control again (Small 3×, Medium 5×, Large 7× and a 1–10× slider that saves from
the keyboard), and older events keep their stored size. Library search, mixtures,
movement and the migration are covered in `tests/lib/effect-*.test.ts`,
`tests/api/effects-search.test.ts`, `tests/actions/theme-effects.test.ts`,
`tests/components/EffectsPanel.test.tsx` and
`tests/integration/lib/effect-library-migration.test.ts`.

Task `8bb37ef2` addresses #810 (and #795) in `issue-810-accessibility-blockers.test.tsx`:
`app/` and `components/` never call the browser's `confirm()`, `alert()` or `prompt()`; a
guest-list removal is confirmed in the shared `useConfirm()` dialog; and the event hero's
host controls (Edit title, Edit description, Edit date and time, Edit location, the
"N others" co-host trigger) are named
buttons that work by keyboard. `orphaned-invitation-removal.test.tsx` now confirms through
the dialog.

Task `01a1ab65` addresses #793 in `issue-793-dutch-notification-feedback.test.ts`:
all four event-update feedback messages must exist in the Dutch catalog, and the
localized summary must interpolate every delivery count without English fallback.

Task `01a1a08c` addresses #335 in `issue-335-update-routing.test.ts`: phone-only
default routing, opt-outs, explicit SMS selection, awaited delivery, safe aggregate
feedback, posted-update preservation, and authorization/CAPTCHA ordering.
`tests/lib/notifications.test.ts` and `tests/lib/notification-adapters.test.ts`
cover generic adapters, fallback, uncertain acceptance, partial provider results,
concurrency, and cancellation; component tests cover the host posting experience.
`tests/integration/lib/notification-smtp.test.ts` uses a real loopback SMTP fixture
to verify partial acceptance and destruction of a stalled socket at the deadline.

Task `01a19e4a` addresses #328 / SEC-8 and #339 / SEC-44 in
`issue-328-339-config-secrets.test.ts`: per-value salts, authenticated format
validation, plaintext rejection, migration checks, backup failure, repeated
startup, completion guards, and selective rollback. Real PostgreSQL concurrency,
mid-write rollback, and redacted CLI failures are covered in
`tests/integration/lib/config-secrets.test.ts`.

Task `01a197b1` (PR #777 report) adds `download-cache-policy.test.ts` for exact dynamic-download cache rules, security-header preservation, and current RSVP rows on repeated CSV requests.

#749 (`01a15e47`) adds `issue-749-invitation-names.test.ts` for event-scoped invitation names, reviewed send validation, private preview boundaries, safe resends, and token/organizer RSVP name corrections.

#754 (`cb58e723`) adds `issue-754-invited-edit-link.test.tsx`, plus the `invited-first-response-*` and `invitation-composer-qa` cases found while browser-testing #749.

| File                                                 | Bug description                                                                                                                                                                                                                                     | Fixed in                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `language-selector-focus.test.tsx`                   | Closed language menus stole focus on Escape, including from the other selector on profile pages                                                                                                                                                     | 01a150ee                       |
| `issue-712-invite-details-token.test.ts`             | Invitation details links dropped recipient RSVP tokens in rendered HTML and plain text                                                                                                                                                              | #712                           |
| `issue-606-docs-images.test.tsx`                     | Repository-relative screenshot URLs did not resolve to local assets in the in-app guides                                                                                                                                                            | #606                           |
| `sec-11-twilio-xml-injection.test.ts`                | XML injection via unescaped event title/guest name in Twilio TwiML response                                                                                                                                                                         | SEC-11                         |
| `sec-16-csv-formula-injection.test.ts`               | CSV formula injection via attacker-controlled guest name/email in export                                                                                                                                                                            | SEC-16                         |
| `sec-19-event-password-rate-limit.test.ts`           | Unbounded brute-force of password-gated events (no attempt cap)                                                                                                                                                                                     | SEC-19                         |
| `sec-20-save-event-settings-mass-assignment.test.ts` | Mass assignment of arbitrary Event columns via `saveEventSettings`                                                                                                                                                                                  | SEC-20                         |
| `sec-13-cross-event-parent-comment.test.ts`          | Reply threaded under a parent comment from a different event                                                                                                                                                                                        | SEC-13                         |
| `sec-17-comment-authz-spoofing.test.ts`              | Authenticated comment authZ bypass + free-form `guestName` impersonation                                                                                                                                                                            | SEC-17                         |
| `sec-12-rsvp-capacity-race.test.ts`                  | Non-atomic count-then-create capacity check lets concurrent RSVPs overbook                                                                                                                                                                          | SEC-12                         |
| `sec-21b-updaterspv-capacity-deadline.test.ts`       | `updateRSVP` skipped deadline/capacity re-check (capacity-bypass via token)                                                                                                                                                                         | SEC-21b                        |
| `sec-18-guest-invite-rate-limit.test.ts`             | Uncapped outbound email/SMS via guest invite (no rate limit / per-RSVP cap)                                                                                                                                                                         | SEC-18                         |
| `sec-22-client-ip-spoofing.test.ts`                  | Spoofable `X-Forwarded-For` defeated every IP-keyed rate limiter                                                                                                                                                                                    | SEC-22                         |
| `sec-23-addrsvp-rate-limit.test.ts`                  | Unauthenticated `addRSVP` fan-out to arbitrary email/SMS with no rate limit                                                                                                                                                                         | SEC-23                         |
| `sec-24-guest-identity-token.test.ts`                | Guest comment/vote/potluck identity spoofable via public `rsvpId` + name                                                                                                                                                                            | SEC-24                         |
| `sec-29-invite-guest-rate-limit.test.ts`             | Host `inviteGuest` fan-out had no batch cap or rate limit                                                                                                                                                                                           | SEC-29                         |
| `sec-26-sms-token-decrypt.test.ts`                   | DB-configured Twilio auth token never decrypted (broken `enc:` check)                                                                                                                                                                               | SEC-26                         |
| `sec-27-twilio-webhook-db-token.test.ts`             | Twilio inbound webhook validated only against the env token, not DB config                                                                                                                                                                          | SEC-27                         |
| `sec-25-docker-default-creds.test.ts`                | Compose files shipped weak default DB/Redis passwords + host-exposed 5432                                                                                                                                                                           | SEC-25                         |
| `sec-31-health-info-leak.test.ts`                    | `/api/health` leaked migration/DB state + timestamp to anonymous callers                                                                                                                                                                            | SEC-31                         |
| `sec-30-cohost-authz.test.ts`                        | Inconsistent host/co-host authz: co-hosts blocked from documented actions                                                                                                                                                                           | SEC-30                         |
| `l7-slug-collision-bound.test.ts`                    | `generateUniqueSlug` scanned sequential suffixes in an unbounded query loop                                                                                                                                                                         | L-7                            |
| `bug-03-admin-mobile-drawer-trigger.test.ts`         | Admin mobile drawer had no trigger — nothing called `setIsDrawerOpen(true)`                                                                                                                                                                         | BUG-03                         |
| `l4b-invite-friend-swallowed-error.test.ts`          | `inviteFriendAsGuest` activity-log failure swallowed by bare `.catch()`                                                                                                                                                                             | L-4b                           |
| `sec-34-event-access-gates.test.ts`                  | PRIVATE/password gate bypass on calendar.ics / guests / rsvp routes + guest RSVP editToken/PII leak in RSC payload                                                                                                                                  | SEC-34                         |
| `cohost-invite-reorder.test.ts`                      | Test co-host invitation flow and event info section widget reordering actions                                                                                                                                                                       | CH-REORD                       |
| `sec-14-admin-error-sanitization.test.ts`            | Surfacing raw SMTP/Twilio configuration errors to the admin UI (information disclosure)                                                                                                                                                             | SEC-14                         |
| `sec-7-ssrf-ip-hardening.test.ts`                    | SSRF URL validation bypasses via loopback and private subnets                                                                                                                                                                                       | SEC-7                          |
| `sec-32-33-host-only-event-data-leak.test.ts`        | Host/co-host emails + hidden guest list shipped in event-page RSC payload; GUESTS_ONLY guest list reachable by anyone                                                                                                                               | SEC-32/33                      |
| `sec-35-email-console-fallback-prod-leak.test.ts`    | Email console fallback logged magic-link/edit tokens + recipient in production                                                                                                                                                                      | SEC-35                         |
| `sec-40-45-signin-enumeration-shared-ip.test.ts`     | Sign-in leaked account existence (success vs. auth_failed) + shared loopback IP bucket locked out all sign-ins                                                                                                                                      | SEC-40/45                      |
| `sec-46-invite-guest-activity-log.test.ts`           | Host/co-host `inviteGuest` issuance wrote no ActivityEvent — invite blasts were unattributable                                                                                                                                                      | SEC-46                         |
| `sec-36-url-protocol-validation.test.ts`             | Host-supplied virtual link / info-section URLs stored a `javascript:`/`data:` URI rendered into guest `<a href>`                                                                                                                                    | SEC-36                         |
| `sec-37-rsvp-contact-format.test.ts`                 | `guestEmail`/`guestPhone` accepted as any string — junk User upserts + skewed `linkRsvpsToUser` matching                                                                                                                                            | SEC-37                         |
| `sec-38-answers-validation.test.ts`                  | RSVP questionnaire answers had no length cap and keys weren't verified against the event's own questions                                                                                                                                            | SEC-38                         |
| `zod-string-length-compat.test.ts`                   | Zod's Unicode length change widened text caps and tightened the sign-in minimum                                                                                                                                                                     | bab32486                       |
| `release-prerelease-tags.test.ts`                    | Prerelease publication could overwrite stable image aliases through explicit or implicit latest tags                                                                                                                                                | f073ceaa                       |
| `sec-41-verify-host-header-origin.test.ts`           | Magic-link verify built redirect origin from the request Host header (redirect/link-poisoning behind proxies)                                                                                                                                       | SEC-41                         |
| `sec-42-rsvp-existence-oracle.test.ts`               | Host RSVP actions threw "Not found" before authz, letting any caller probe which RSVP ids exist                                                                                                                                                     | SEC-42                         |
| `ghsa-g7r4-m6w7-qqqr-esbuild-traversal.test.ts`      | GHSA-g7r4-m6w7-qqqr: vulnerable esbuild dev servers allowed arbitrary reads through Windows backslash traversal                                                                                                                                     | GHSA                           |
| `ghsa-mh99-v99m-4gvg-brace-expansion.test.ts`        | GHSA-mh99-v99m-4gvg: patched brace expansion broke the callable API required by ESLint's legacy minimatch tree                                                                                                                                      | GHSA                           |
| `sec-39-activity-feed-guest-privacy.test.ts`         | Hidden guest names and RSVP note/detail text leaked through activity rows in the event-page RSC payload                                                                                                                                             | SEC-39                         |
| `sec-48-initial-admin-login-only.test.ts`            | INITIAL_ADMIN_EMAIL promotion ran from ordinary sessions and non-LOGIN authentication paths                                                                                                                                                         | SEC-48                         |
| `../components/RsvpFlow.test.tsx` (race describe)    | New-RSVP success screen transiently swapped to "RSVP updated!" after the Server Action RSC refresh                                                                                                                                                  | RSVP race                      |
| `host-rsvp-alert-wiring.test.ts`                     | `sendHostRsvpAlertEmail`/`sendHostRsvpAlertSms` had no call site — hosts never got "New RSVP" alerts despite the docs                                                                                                                               | [de9262]                       |
| `guest-list-host-empty-visibility.test.tsx`          | Empty events hid the main-page Guests card and its management shortcuts from hosts                                                                                                                                                                  | 113b4f76                       |
| `preflight-e2e-process-group-cleanup.test.ts`        | Full preflight killed only npm, leaving an orphaned Next.js server listening on port 3001                                                                                                                                                           | 019f61f9                       |
| `guest-list-all-includes-invited.test.tsx`           | Guest-list All filter counted invited guests but rendered only guests who had responded                                                                                                                                                             | 019f6231                       |
| `guest-check-in-all-statuses.test.tsx`               | Invited/declined guests had no check-in control, and existing-RSVP walk-ins were not checked in                                                                                                                                                     | 033460e0                       |
| `orphaned-invitation-removal.test.tsx`               | An unlinked invitation could outlive a manual RSVP as an undeletable unanswered guest-list card                                                                                                                                                     | 019f62a4                       |
| `docker-runtime-hardening.test.ts`                   | Production image ran as root, used floating bases, included curl, and deployed migrations twice                                                                                                                                                     | 019f869e                       |
| `docker-bind-mount-bootstrap.test.ts`                | Bind-mount repair traversed sibling PostgreSQL and Redis data instead of only app-owned storage                                                                                                                                                     | 019f869e                       |
| `docker-vendored-dependency-context.test.ts`         | Docker dependency stage omitted `.npmrc` and the vendored package required by a file-based npm override                                                                                                                                             | 3eb8bbf7                       |
| `ghsa-f88m-g3jw-g9cj-sharp-libvips.test.ts`          | Next.js, React Email UI, and Miniflare constrained Sharp to vulnerable 0.34.x after the patched 0.35 release                                                                                                                                        | 019f869e                       |
| `issue-549-550-turnstile-concurrency.test.ts`        | Shared Turnstile cookie let overlapping protected actions overwrite or consume each other's single-use token                                                                                                                                        | #549/550                       |
| `npm-deprecation-warnings.test.ts`                   | Redundant bcryptjs type stubs and the Twilio SDK's transitive scmp dependency emitted clean-install warnings                                                                                                                                        | c4ca3272                       |
| `dependency-security-baseline.test.ts`               | Enforce patched dependency floors, including stable Cloudflare worker toolchain minimums, and synchronized Next.js, React, Prisma, and Vitest manifest/lockfile groups                                                                              | 3c3227b5 / 027a7053 / d5b679c7 |
| `roboto-font-build.test.ts`                          | Extensionless Google Roboto URLs broke Turbopack query parsing in the AMD64 production image                                                                                                                                                        | d5b679c7                       |
| `issue-327-script-csp.test.ts`                       | Inline scripts were permitted by `script-src 'unsafe-inline'`; request nonces were not coupled to rendered HTML                                                                                                                                     | SEC-9 / #327                   |
| `notification-locales.test.tsx`                      | Notification copy and address-only batches lost recipient locale; preserve authored text, status IDs, and localized defaults                                                                                                                        | 01a150ee                       |
| `event-locales.test.ts`                              | Event/RSVP validation, throttling, deadline, and capacity errors ignored the selected request language                                                                                                                                              | 01a150ee                       |
| `auth-localization-spacing.test.tsx`                 | Extracted sign-in footer prompts lost the space before the account-creation link in English and Dutch                                                                                                                                               | 01a150ee                       |
| `admin-email-localization-spacing.test.tsx`          | Extracted email setup fragments lost spaces before inline provider labels in English and Dutch                                                                                                                                                      | 01a150ee                       |
| `playwright-docker-parity.test.ts`                   | CI-only Docker browser validation let the pinned image drift from Playwright and pass local preflight                                                                                                                                               | #733 / 01a150ee                |
| `issue-749-invitation-names.test.ts`                 | Invitations used contact-derived placeholder names, and RSVP edits through a token or by the organizer could not correct the name                                                                                                                   | #749 / 01a15e47                |
| `issue-754-invited-edit-link.test.tsx`               | Invited guests (and hosts editing them) saw "you didn't add an email or phone" although the RSVP had a contact on file                                                                                                                              | #754 / cb58e723                |
| `invited-first-response-wording.test.tsx`            | An invited guest's first answer through their link was framed as "Update RSVP" / "RSVP updated!"                                                                                                                                                    | cb58e723                       |
| `invited-first-response-notifications.test.ts`       | An invited guest's first answer sent no host "New RSVP" alert or guest confirmation and was logged as an update; then a failed save left the answer claimed, so the retry sent nothing                                                              | cb58e723 / de78391d            |
| `vitest-excludes-agent-worktrees.test.ts`            | Unit preflight also ran tests from agent worktrees nested under `.claude/worktrees/`, failing on another checkout's suite                                                                                                                           | cb58e723                       |
| `invitation-composer-qa.test.tsx`                    | Invite composer dropped focus on Tab after a name edit, discarded the draft on close, and hid why disabled-channel rows failed; typing bypassed the 200-recipient cap; imports dropped an invalid first guest or moved names onto the wrong contact | cb58e723 / de78391d            |
| `guest-list-stale-resend.test.tsx`                   | Guest-list Resend used unreviewed `inviteGuest`, so a stale card resent silently after a reply, rename, or conflict; then a "responded" refusal advised a refresh that could not clear it                                                           | 8be23944 / de78391d            |
| `preflight-worker-typecheck.test.ts`                 | Local preflight skipped CI's standalone email-worker type-check, so worker type errors passed the local CI-parity gate                                                                                                                              | de78391d                       |
| `floating-rsvp-docking-loop.test.tsx`                | The floating RSVP card placed its docking line from whichever card was on screen, so heights that straddled the line flipped it on every pass and logged "Maximum update depth exceeded" (design review B-1)                                        | d1a4521f                       |
| `issue-808-email-contrast.test.tsx`                  | Emails used web colors on email surfaces: raw-accent links on the white body (Winter 1.33:1), white BOLD hero text where the web needs a scrim (Sunset 2.8:1), faded small hero text, and a 3.1:1 muted gray                                        | #808 / 46ded135                |
| `host-bar-active-tint.test.ts`                       | The host bar built its active-tab tint as `rgba(${accent},0.2)` from a hex accent, which is invalid CSS the browser drops; the branch was also unreachable. The guard rejects any hex color interpolated into `rgb()`/`rgba()` (design review B-2)  | #806 / 4f84f787                |

### Recipient notification preferences (`01a1a105`)

- `notification-event-authority.test.ts`: claimed account links and unrelated
  profile destinations cannot authorize event routes; event-level opt-outs survive
  profile changes; separate copies need proof of each destination; revoked or stale
  bindings, binding generations and submission rechecks.
- `profile-notification-contact-change.test.ts`: profile verification changes
  account identity without silently rewriting event RSVP contacts; matching
  notification proof is retired separately.
- `notification-management-surface.test.tsx`: the real guest editor keeps readable
  contrast against every ancestor surface of the private page.
- `notification-preferences-load.test.tsx`: the guest editor is seeded by its
  authorizing server read, so no later client read can overwrite a new choice.
- `notification-contact-collision.test.ts`: normalized same-channel contact
  collisions are rejected before event destination changes, without cross-service inference.

QC follow-up within `01a1a105` (2026-11-05). The retired legacy writers were removed
outright, so `notification-legacy-writer.test.ts` was deleted with them.

- `notification-organizer-alerts.test.ts`: a first organizer save stored no eligibility
  and stopped alerts to the account email while the page claimed email; migrated rows for
  events with both alert switches off suppressed alerts forever; a revoked connection
  dropped the account contact. (Migration SQL cases: `tests/integration/lib/notification-migration.test.ts`.)
- `notification-legacy-optout-scope.test.ts`: the upgrade widened "Blasts & Reminders"
  opt-outs and the update-channel choice into hard blocks, losing confirmations,
  decisions and host alerts that were always sent before.
- `notification-consent-and-proof.test.ts`: re-enabling a category demanded a code;
  disconnecting or a sign-in change hard-blocked the channel everywhere; a paused
  contact was still shown as delivering.
- `invited-rsvp-public-token.test.ts` and the D3 case in `issue-754-invited-edit-link.test.tsx`:
  the public form returned an invited guest's private link to whoever typed their email.
- `notification-settings-surface.test.tsx`: a failed load stayed on "Loading" forever;
  organizers saw guest copy and indistinguishable masked addresses; the shared switch had
  no accessible name or state.
- `notification-reminder-schedule.test.ts`: reminders read "starts in 168 hours";
  sent or passed times looked pending; a load failure said "Could not save".
- `notification-challenge-retention.test.ts`: used and expired verification challenges
  kept private destinations forever.
- `notification-stale-client.test.tsx`: a page loaded before a deployment said "Could not
  save" when its server actions no longer existed; it now says the page is out of date and
  offers a reload.
- `notification-unexpected-error-logging.test.ts`: unexpected notification action failures
  left no trace in the server log; they now log the error's kind and code, never its message.
