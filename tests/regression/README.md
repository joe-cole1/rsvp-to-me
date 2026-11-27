# Regression Tests

Issue #850 adds regressions for:

- `issue-850-public-feed.test.tsx`: publication/count query and rendered ICU labels.
- `issue-850-uploads.test.ts`: quota, filesystem reclamation, shared/legacy/pending files and failures.
- `issue-850-admin-search.test.ts`: server-side pagination/search/filter bounds.
- `issue-850-admin-ui.test.tsx`: page/filter resets, stale reads and retry.
- `issue-850-comment-ui.test.tsx`: moderation confirmation, replies, themes and errors.
- `issue-850-upload-ui.test.tsx`: visible quota failures and preserving the confirmed avatar after failed assignment.
- `issue-850-moderation-payload.test.ts`: exclusion of retained activity previews.
- `issue-850-qc.integration.ts`: actual PostgreSQL feed/search gates, concurrent
  quota/assignment behavior, image/account lifecycle, comment authority and subtree
  deletion, and complete event tombstoning. Runs through
  `tests/integration/qc/issue-850.test.ts`.

Task: `01a1df16`.

Tests that reproduce specific bugs found in production or staging. Each file corresponds to a specific bug fix.

Issue #848 adds `issue-848-rsvp-rules.test.ts` (server settings, deadlines, companion
clearing, shared phone matching and lock failure), `issue-848-sms-rules.test.ts`
(signed routing and current-contact authority), and
`issue-848-rsvp-concurrency.integration.ts` (real PostgreSQL contention, web/SMS
competition and exactly-once first-response dispatch). The integration regression
runs through `tests/integration/actions/rsvp-concurrency.test.ts` in full preflight.

## Convention

For every bug fix merged to main:

1. Create a test file named after the bug: `tests/regression/issue-123-slug-collision.test.ts`
2. The test must **fail** before the fix is applied and **pass** after
3. Add a comment at the top explaining the original bug, when it was found, and what caused it
4. Update the index table below
5. These run as part of `npm test` — use the standard Vitest unit test setup (mocking, factories)

October 2026 (`8a8fb7bf`) extends `dependency-security-baseline.test.ts` with updated security floors and package-group synchronization checks. PR #775 (`01a19bc3`) adds stable minimum floors for the Cloudflare worker toolchain so compatible lockfile upgrades do not fail exact-version assertions. #779/#603 (`01a19ceb`) extend this policy to runtime `tsx`, reject reintroduced deepmerge-ts overrides, and require Joi 18.3.1 for GHSA-4528-x5fx-h6hg.

PR #818 (`01a1b35c`) originally required identical Vitest manifest ranges. Task
`d4ae35f3` replaces that administrative constraint with compatible resolved
versions: overlapping ranges that resolve together pass, while mismatched root
packages still fail. Nested independent toolchains may select their own versions.

Task `d4ae35f3` audits all dependency and test infrastructure after #831/#832.
`dependency-update-contracts.test.ts` covers newer patched versions, removal of
transitive dependencies, missing required packages, vulnerable nested versions,
and equivalent CSS ratios. `playwright-docker-parity.test.ts` exercises both
Docker entry points against installed-package fixtures across releases and keeps
browser failures blocking. `docker-runtime-hardening.test.ts` accepts supported
Node/Alpine image updates while requiring an exact tag and digest. The esbuild
and Sharp regressions enforce patched resolutions in both projects without
requiring an old override or identical independent toolchains. EventHero's
component tests cover landscape, portrait and square images; DOM/style tests
check semantics and the font-build test checks emitted assets.

The same task validates Prisma configuration and builds the font fixture through
the installed public CLIs. `notification-stale-client.test.tsx` stubs the public
Next.js classifier for UI tests, verifies generic errors stay generic, and no
longer imports a private framework constructor or depends on its message.

`generated-test-workspaces.test.ts` checks effective ESLint and TypeScript
discovery: `.vitest/` build fixtures and `.claude/` worktrees stay outside
application checks while real source remains checked. The unit discovery guard
also excludes generated fixture tests.

## Index

Task `42bb7798`, follow-up to #938:

- `dependabot-auto-merge.test.ts`: genuine signed bot commits, per-dependency
  patch/minor eligibility, exact project file bounds, native merge protections,
  stale-head and API failures, owned enrollment revocation, and the trusted-base
  workflow boundary. Majors, Actions, forks, and edited PRs remain manual.
- `dependabot-update-groups.test.ts`: parses the actual Dependabot configuration
  and requires complementary update types for routine and package-family groups.
  All six family cases fail without explicit major-only scopes, reproducing the
  overlap found in live updater logs. Also checks that each job retains a
  patch/minor batch and security coverage for all version levels.

Issue #340 (task `01a1e91b`):

- `issue-340-eslint-10.test.ts`: supported ESLint major and real React version
  detection, JSX keys, Hooks, accessibility, import, Next.js, TypeScript and
  JavaScript-global diagnostics using the repository presets. Email document
  markup keeps its intentional Next.js exceptions, and workflow tests declare
  their YAML parser independently of ESLint's transitive dependencies.

Issue #792 (task `01a1e8a5`):

- `issue-792-contact-proof.test.ts`: generic pre-proof request contract, contact
  normalization, CAPTCHA, quotas, event access/rules, code expiry/attempts, and
  receipt binding to each event/contact.
- `issue-792-verification-messages.test.ts`: real adapter rendering of code-only
  email/SMS instructions, without private invitation links or RSVP confirmation.
- `issue-792-verification-flow.test.tsx`: both-contact verification, resend and
  error feedback, retained form review, separate final confirmation, and proof
  invalidation after contact changes or expiry.
- `issue-792-invitation-proof.integration.ts` (loaded by
  `tests/integration/actions/rsvp-contact-proof.test.ts`): real database invitation
  preservation without proof, proved replies, account/contact separation,
  cross-event and mixed-contact attacks, concurrent single-use consumption,
  private-link compatibility, and final rule rechecks.
- `invited-rsvp-public-token.test.ts` and the #754/#853 form cases now assert the
  proof requirement; `notification-challenge-retention.test.ts` also covers RSVP
  proof retention.

Issue #566 follow-up (task `01a1e406`):

- `issue-566-lint.test.ts`: effective repository lint rules remain warning-free
  for the already-fixed font import and the three approved follow-up components.
- `issue-566-delete-navigation.test.tsx`: confirmed deletion uses the App Router
  after success; failed or rejected deletion keeps the dialog open without navigation.
- `tests/components/LanguageSelector.test.tsx`: existing local SVG flag dimensions,
  menu appearance and selection behavior remain covered after using Next Image.

Issue #880 (task `01a1e3a7`):

- `issue-880-event-links.test.ts`: opaque defaults, bounded code growth, preview
  provenance/expiry, authorization/CAPTCHA, explicit URL decisions, collisions and
  stale writes.
- `issue-880-event-url-settings.test.tsx`: rendered URL previews, warning choices,
  cancellation, pending/failure behavior and confirmed visibility. Task `73300ac2`
  fixed preflight/CI flakes: alerts and the generated-code change dialog render
  before the async transition re-enables their controls, and dialog focus lands
  in a later effect, so retries and "Change URL" now wait for enabled controls
  and the focus check waits for focus instead of acting one render early.
- `tests/e2e/event-links.e2e.ts`: real creation/edit/privacy flows, retired event
  and invitation routes, Private access, collision errors and phone dialogs.

Issue #853 (audit #852, task `01a1e09e`):

- `issue-853-dashboard-zone.test.ts`: hosted/co-hosted and invitation query projections retain the event zone.
- `issue-853-event-times.test.tsx`: home/dashboard/hero agreement, event calendar day,
  localized times and daylight-saving range labels.
- `issue-853-rsvp-feedback.test.tsx`: visible contact labels, autocomplete, required
  fields, linked invalid state, announcements/focus, companions, questionnaires and action failures.
- `issue-853-page-structure.test.tsx`: shared landmark and keyboard bypass, error-page
  nesting, settings heading levels and guest disclosure target size.
- `issue-853-settings-patch.test.tsx`: stale tabs preserve unrelated stored fields.
- `issue-853-page-titles.test.ts`: RSVP/guest-list page titles and protected-title privacy.
- `tests/e2e/issue-853.e2e.ts` and `tests/e2e/rsvp.e2e.ts`: real keyboard bypass,
  route landmarks, phone target sizes and RSVP validation focus. Existing
  `admin-moderate-settings.test.tsx` covers the already-fixed administrator access finding.

Task `01a1dc08` bundles GHSA-wx7r-qqc6-2v5v, GHSA-mrf6-4xh5-7p47,
GHSA-wch3-85cq-qp5f and GHSA-8r3w-c2hj-fv38.
`private-advisory-boundaries.test.tsx` covers runtime input/image validation,
RSVP/comment access, password-cookie revocation, dashboard privacy, contact-mail
throttling and canonical/non-mutating link behavior.
`private-advisory-social-image.test.tsx` keeps arbitrary stored URLs out of
server-rendered social artwork.
`private-advisory-security.integration.ts` runs through
`tests/integration/lib/advisory-security.test.ts` under the integration config:
real PostgreSQL/Redis session revocation, proof-gated registration, concurrent
single-use tokens/acceptance, cross-parent ownership, same-name participation,
capacity races and historical-row migration preservation.

#851 follow-up (`01a1d9ed`) adds `issue-851-turnstile-gate.test.ts` for both
blocking CSP modes, `issue-851-migration-backups.test.ts` for private atomic dumps,
retention after success, legacy recovery and path safeguards,
`issue-851-backup-visibility.test.tsx` for read-only metadata, and
`issue-851-release-gate.test.ts` for reusable validation prerequisites, event-SHA
checks, owner guards and both architectures. The enabled browser behavior is
exercised by `tests/e2e/csp-turnstile.e2e.ts` in CI and full preflight.

Task `01a1d8f5` covers the CI/sample-data portion of #851 in
`issue-851-ci-parity.test.ts` and `issue-851-seed-defaults.test.ts`: CI checks the
submitted tree with read-only permissions, both gates share format checks and
resolve Redis from deployment configuration, E2E fixtures and retry policy match,
Compose respects sample-data configuration, and seed rejects missing invite
codes before writes. `dev-restart-empty-port.test.ts` covers empty-port startup,
stop-only behavior, safe replacement, foreign listeners and socket errors.
The CodeQL follow-up in `issue-851-ci-parity.test.ts` requires event-default
checkout while retaining manual dispatch, PR/main-push validation, and npm,
Playwright and Next.js caches.

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

Task `9faf9220` addresses #914 in `issue-914-dutch-catalog-completeness.test.ts`:
the Dutch catalog was missing 46 keys, so the required RSVP verification email reached
Dutch guests in English. `tests/lib/i18n-catalogs.test.ts` now derives its completeness
list from `messages/locales.json` instead of naming German and Spanish.

Task `01a1a08c` addresses #335 in `issue-335-update-routing.test.ts`: phone-only
default routing, opt-outs, explicit SMS selection, awaited delivery, safe aggregate
feedback, posted-update preservation, and authorization/CAPTCHA ordering.
`tests/lib/notifications.test.ts` and `tests/lib/notification-adapters.test.ts`
cover generic adapters, fallback, uncertain acceptance, partial provider results,
concurrency, and cancellation; component tests cover the host posting experience.
`tests/integration/lib/notification-smtp.test.ts` uses a real loopback SMTP fixture
to verify partial acceptance and destruction of a stalled socket at the deadline.

Task `01a1e8f7` addresses #789:

- `issue-789-blast-preferences.test.ts` exercises the manual actions with the real
  preference resolver, dispatcher and adapters, stubbing DB and provider boundaries:
  legacy/profile/event opt-outs, hard blocks, paused contacts, consent rechecks,
  event contact authority, channel limits, provider outcomes, locale/BCC/theme,
  authorization/CAPTCHA and completed-page counts after a preparation failure.
- `issue-789-blast-feedback.test.tsx` covers combined channel counts, skipped contacts,
  uncertain acceptance, safe partial-failure feedback and localized copy.

Task `01a19e4a` addresses #328 / SEC-8 and #339 / SEC-44 in
`issue-328-339-config-secrets.test.ts`: per-value salts, authenticated format
validation, plaintext rejection, migration checks, backup failure, repeated
startup, completion guards, and selective rollback. Real PostgreSQL concurrency,
mid-write rollback, and redacted CLI failures are covered in
`tests/integration/lib/config-secrets.test.ts`.

Task `01a197b1` (PR #777 report) adds `download-cache-policy.test.ts` for exact dynamic-download cache rules, security-header preservation, and current RSVP rows on repeated CSV requests.

#749 (`01a15e47`) adds `issue-749-invitation-names.test.ts` for event-scoped invitation names, reviewed send validation, private preview boundaries, safe resends, and token/organizer RSVP name corrections.

#754 (`cb58e723`) adds `issue-754-invited-edit-link.test.tsx`, plus the `invited-first-response-*` and `invitation-composer-qa` cases found while browser-testing #749.

| File                                                                   | Bug description                                                                                                                                                                                                                                     | Fixed in                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `issue-878-event-password.test.tsx`                                    | Visibility changes hid active password controls; removal required typing then clearing, and password status changed before failed saves completed. Covers removal, cancellation, setting/replacing passwords and failed/pending saves.              | #878 / `01a1e389`              |
| `issue-847-trusted-ip-limits.test.ts`                                  | Missing trusted IP configuration shared quotas across unrelated visitors; contact/owner/token quotas and an explicit password cap now survive skipping IP tiers                                                                                     | #847 / `01a1dc53`              |
| `issue-847-rate-window.test.ts`, `issue-847-rate-limit.integration.ts` | Redis retries extended lockouts; non-atomic DB fallback admitted concurrent requests beyond quota. Real-store integration covers creation, reset, contention and fixed expiry                                                                       | #847 / `01a1dc53`              |
| `dev-restart-port.test.ts`                                             | Restarting the dev server failed with EADDRINUSE because `lsof` cannot see WSL listeners, so the old server on :3000 was never stopped                                                                                                              | 34eafcdf                       |
| `admin-moderate-settings.test.tsx`                                     | Moderating admins were sent out of event settings and host-only guest lists to the guest view, and RSVP options showed them an organizer-alerts error; `?admin=1` stays inert for non-admins                                                        | 79c90196                       |
| `language-selector-focus.test.tsx`                                     | Closed language menus stole focus on Escape, including from the other selector on profile pages                                                                                                                                                     | 01a150ee                       |
| `ship-pr-title-subject.test.ts`                                        | `scripts/ship.sh` used the whole commit message, including its body and Co-Authored-By trailer, as the PR title                                                                                                                                     | abad2cf6                       |
| `issue-712-invite-details-token.test.ts`                               | Invitation details links dropped recipient RSVP tokens in rendered HTML and plain text                                                                                                                                                              | #712                           |
| `issue-606-docs-images.test.tsx`                                       | Repository-relative screenshot URLs did not resolve to local assets in the in-app guides                                                                                                                                                            | #606                           |
| `sec-11-twilio-xml-injection.test.ts`                                  | XML injection via unescaped event title/guest name in Twilio TwiML response                                                                                                                                                                         | SEC-11                         |
| `sec-16-csv-formula-injection.test.ts`                                 | CSV formula injection via attacker-controlled guest name/email in export                                                                                                                                                                            | SEC-16                         |
| `sec-19-event-password-rate-limit.test.ts`                             | Unbounded brute-force of password-gated events (no attempt cap)                                                                                                                                                                                     | SEC-19                         |
| `sec-20-save-event-settings-mass-assignment.test.ts`                   | Mass assignment of arbitrary Event columns via `saveEventSettings`                                                                                                                                                                                  | SEC-20                         |
| `sec-13-cross-event-parent-comment.test.ts`                            | Reply threaded under a parent comment from a different event                                                                                                                                                                                        | SEC-13                         |
| `sec-17-comment-authz-spoofing.test.ts`                                | Authenticated comment authZ bypass + free-form `guestName` impersonation                                                                                                                                                                            | SEC-17                         |
| `sec-12-rsvp-capacity-race.test.ts`                                    | Non-atomic count-then-create capacity check lets concurrent RSVPs overbook                                                                                                                                                                          | SEC-12                         |
| `sec-21b-updaterspv-capacity-deadline.test.ts`                         | `updateRSVP` skipped deadline/capacity re-check (capacity-bypass via token)                                                                                                                                                                         | SEC-21b                        |
| `sec-18-guest-invite-rate-limit.test.ts`                               | Uncapped outbound email/SMS via guest invite (no rate limit / per-RSVP cap)                                                                                                                                                                         | SEC-18                         |
| `sec-22-client-ip-spoofing.test.ts`                                    | Spoofable `X-Forwarded-For` defeated every IP-keyed rate limiter                                                                                                                                                                                    | SEC-22                         |
| `sec-23-addrsvp-rate-limit.test.ts`                                    | Unauthenticated `addRSVP` fan-out to arbitrary email/SMS with no rate limit                                                                                                                                                                         | SEC-23                         |
| `sec-24-guest-identity-token.test.ts`                                  | Guest comment/vote/potluck identity spoofable via public `rsvpId` + name                                                                                                                                                                            | SEC-24                         |
| `sec-29-invite-guest-rate-limit.test.ts`                               | Host `inviteGuest` fan-out had no batch cap or rate limit                                                                                                                                                                                           | SEC-29                         |
| `sec-26-sms-token-decrypt.test.ts`                                     | DB-configured Twilio auth token never decrypted (broken `enc:` check)                                                                                                                                                                               | SEC-26                         |
| `sec-27-twilio-webhook-db-token.test.ts`                               | Twilio inbound webhook validated only against the env token, not DB config                                                                                                                                                                          | SEC-27                         |
| `sec-25-docker-default-creds.test.ts`                                  | Compose files shipped weak default DB/Redis passwords + host-exposed 5432                                                                                                                                                                           | SEC-25                         |
| `sec-31-health-info-leak.test.ts`                                      | `/api/health` leaked migration/DB state + timestamp to anonymous callers                                                                                                                                                                            | SEC-31                         |
| `sec-30-cohost-authz.test.ts`                                          | Inconsistent host/co-host authz: co-hosts blocked from documented actions                                                                                                                                                                           | SEC-30                         |
| `l7-slug-collision-bound.test.ts`                                      | `generateUniqueSlug` scanned sequential suffixes in an unbounded query loop                                                                                                                                                                         | L-7                            |
| `bug-03-admin-mobile-drawer-trigger.test.ts`                           | Admin mobile drawer had no trigger — nothing called `setIsDrawerOpen(true)`                                                                                                                                                                         | BUG-03                         |
| `l4b-invite-friend-swallowed-error.test.ts`                            | `inviteFriendAsGuest` activity-log failure swallowed by bare `.catch()`                                                                                                                                                                             | L-4b                           |
| `sec-34-event-access-gates.test.ts`                                    | PRIVATE/password gate bypass on calendar.ics / guests / rsvp routes + guest RSVP editToken/PII leak in RSC payload                                                                                                                                  | SEC-34                         |
| `cohost-invite-reorder.test.ts`                                        | Test co-host invitation flow and event info section widget reordering actions                                                                                                                                                                       | CH-REORD                       |
| `sec-14-admin-error-sanitization.test.ts`                              | Surfacing raw SMTP/Twilio configuration errors to the admin UI (information disclosure)                                                                                                                                                             | SEC-14                         |
| `sec-7-ssrf-ip-hardening.test.ts`                                      | SSRF URL validation bypasses via loopback and private subnets                                                                                                                                                                                       | SEC-7                          |
| `sec-32-33-host-only-event-data-leak.test.ts`                          | Host/co-host emails + hidden guest list shipped in event-page RSC payload; GUESTS_ONLY guest list reachable by anyone                                                                                                                               | SEC-32/33                      |
| `sec-35-email-console-fallback-prod-leak.test.ts`                      | Email console fallback logged magic-link/edit tokens + recipient in production                                                                                                                                                                      | SEC-35                         |
| `sec-40-45-signin-enumeration-shared-ip.test.ts`                       | Sign-in leaked account existence (success vs. auth_failed) + shared loopback IP bucket locked out all sign-ins                                                                                                                                      | SEC-40/45                      |
| `sec-46-invite-guest-activity-log.test.ts`                             | Host/co-host `inviteGuest` issuance wrote no ActivityEvent — invite blasts were unattributable                                                                                                                                                      | SEC-46                         |
| `sec-36-url-protocol-validation.test.ts`                               | Host-supplied virtual link / info-section URLs stored a `javascript:`/`data:` URI rendered into guest `<a href>`                                                                                                                                    | SEC-36                         |
| `issue-916-cloudflare-account-id.test.ts`                              | Admin test email built the Cloudflare REST URL from an unvalidated account ID (CodeQL js/request-forgery #10); every REST URL now requires a 32-hex ID                                                                                              | #916 / 1ca273df                |
| `sec-37-rsvp-contact-format.test.ts`                                   | `guestEmail`/`guestPhone` accepted as any string — junk User upserts + skewed `linkRsvpsToUser` matching                                                                                                                                            | SEC-37                         |
| `sec-38-answers-validation.test.ts`                                    | RSVP questionnaire answers had no length cap and keys weren't verified against the event's own questions                                                                                                                                            | SEC-38                         |
| `zod-string-length-compat.test.ts`                                     | Zod's Unicode length change widened text caps and tightened the sign-in minimum                                                                                                                                                                     | bab32486                       |
| `release-prerelease-tags.test.ts`                                      | Prerelease publication could overwrite stable image aliases through explicit or implicit latest tags                                                                                                                                                | f073ceaa                       |
| `sec-41-verify-host-header-origin.test.ts`                             | Magic-link verify built redirect origin from the request Host header (redirect/link-poisoning behind proxies)                                                                                                                                       | SEC-41                         |
| `sec-42-rsvp-existence-oracle.test.ts`                                 | Host RSVP actions threw "Not found" before authz, letting any caller probe which RSVP ids exist                                                                                                                                                     | SEC-42                         |
| `ghsa-g7r4-m6w7-qqqr-esbuild-traversal.test.ts`                        | GHSA-g7r4-m6w7-qqqr: vulnerable esbuild dev servers allowed arbitrary reads through Windows backslash traversal                                                                                                                                     | GHSA                           |
| `ghsa-mh99-v99m-4gvg-brace-expansion.test.ts`                          | GHSA-mh99-v99m-4gvg: verify native brace expansion across both ESLint (`minimatch` 11) and `eslint-config-next` (`minimatch` 3) paths without a shim (#546)                                                                                         | GHSA                           |
| `sec-39-activity-feed-guest-privacy.test.ts`                           | Hidden guest names and RSVP note/detail text leaked through activity rows in the event-page RSC payload                                                                                                                                             | SEC-39                         |
| `sec-48-initial-admin-login-only.test.ts`                              | INITIAL_ADMIN_EMAIL promotion ran from ordinary sessions and non-LOGIN authentication paths                                                                                                                                                         | SEC-48                         |
| `../components/RsvpFlow.test.tsx` (race describe)                      | New-RSVP success screen transiently swapped to "RSVP updated!" after the Server Action RSC refresh                                                                                                                                                  | RSVP race                      |
| `host-rsvp-alert-wiring.test.ts`                                       | `sendHostRsvpAlertEmail`/`sendHostRsvpAlertSms` had no call site — hosts never got "New RSVP" alerts despite the docs                                                                                                                               | [de9262]                       |
| `guest-list-host-empty-visibility.test.tsx`                            | Empty events hid the main-page Guests card and its management shortcuts from hosts                                                                                                                                                                  | 113b4f76                       |
| `preflight-e2e-process-group-cleanup.test.ts`                          | Full preflight killed only npm, leaving an orphaned Next.js server listening on port 3001                                                                                                                                                           | 019f61f9                       |
| `guest-list-all-includes-invited.test.tsx`                             | Guest-list All filter counted invited guests but rendered only guests who had responded                                                                                                                                                             | 019f6231                       |
| `guest-check-in-all-statuses.test.tsx`                                 | Invited/declined guests had no check-in control, and existing-RSVP walk-ins were not checked in                                                                                                                                                     | 033460e0                       |
| `orphaned-invitation-removal.test.tsx`                                 | An unlinked invitation could outlive a manual RSVP as an undeletable unanswered guest-list card                                                                                                                                                     | 019f62a4                       |
| `docker-runtime-hardening.test.ts`                                     | Production image ran as root, used floating bases, included curl, and deployed migrations twice                                                                                                                                                     | 019f869e                       |
| `docker-bind-mount-bootstrap.test.ts`                                  | Bind-mount repair traversed sibling PostgreSQL and Redis data instead of only app-owned storage                                                                                                                                                     | 019f869e                       |
| `docker-vendored-dependency-context.test.ts`                           | Docker dependency stage must match `package.json` `file:` inputs and avoid stale `.npmrc` or deleted `vendor/` COPY entries before `npm ci`                                                                                                         | 3eb8bbf7                       |
| `ghsa-f88m-g3jw-g9cj-sharp-libvips.test.ts`                            | Next.js, React Email UI, and Miniflare constrained Sharp to vulnerable 0.34.x after the patched 0.35 release                                                                                                                                        | 019f869e                       |
| `issue-902-915-dependency-advisories.test.ts`                          | Stale typescript-eslint lock kept minimatch 10.2.6 (GHSA-g3hv-75wg-m249); Prisma 7.10.1 pins effect 3.20.0 (GHSA-7589-6fvf-x4pw) beyond a `prisma`-nested override                                                                                  | #902 / #915 / 26072437         |
| `issue-549-550-turnstile-concurrency.test.ts`                          | Shared Turnstile cookie let overlapping protected actions overwrite or consume each other's single-use token                                                                                                                                        | #549/550                       |
| `npm-deprecation-warnings.test.ts`                                     | Redundant bcryptjs type stubs and the Twilio SDK's transitive scmp dependency emitted clean-install warnings                                                                                                                                        | c4ca3272                       |
| `dependency-security-baseline.test.ts`                                 | Enforce patched dependency floors, including stable Cloudflare worker toolchain minimums, and synchronized Next.js, React, Prisma, and Vitest manifest/lockfile groups                                                                              | 3c3227b5 / 027a7053 / d5b679c7 |
| `roboto-font-build.test.ts`                                            | Extensionless Google Roboto URLs broke Turbopack query parsing in the AMD64 production image                                                                                                                                                        | d5b679c7                       |
| `issue-327-script-csp.test.ts`                                         | Inline scripts were permitted by `script-src 'unsafe-inline'`; request nonces were not coupled to rendered HTML                                                                                                                                     | SEC-9 / #327                   |
| `notification-locales.test.tsx`                                        | Notification copy and address-only batches lost recipient locale; preserve authored text, status IDs, and localized defaults                                                                                                                        | 01a150ee                       |
| `event-locales.test.ts`                                                | Event/RSVP validation, throttling, deadline, and capacity errors ignored the selected request language                                                                                                                                              | 01a150ee                       |
| `auth-localization-spacing.test.tsx`                                   | Extracted sign-in footer prompts lost the space before the account-creation link in English and Dutch                                                                                                                                               | 01a150ee                       |
| `admin-email-localization-spacing.test.tsx`                            | Extracted email setup fragments lost spaces before inline provider labels in English and Dutch                                                                                                                                                      | 01a150ee                       |
| `playwright-docker-parity.test.ts`                                     | CI-only Docker browser validation let the pinned image drift from Playwright and pass local preflight                                                                                                                                               | #733 / 01a150ee                |
| `issue-749-invitation-names.test.ts`                                   | Invitations used contact-derived placeholder names, and RSVP edits through a token or by the organizer could not correct the name                                                                                                                   | #749 / 01a15e47                |
| `issue-754-invited-edit-link.test.tsx`                                 | Invited guests (and hosts editing them) saw "you didn't add an email or phone" although the RSVP had a contact on file                                                                                                                              | #754 / cb58e723                |
| `invited-first-response-wording.test.tsx`                              | An invited guest's first answer through their link was framed as "Update RSVP" / "RSVP updated!"                                                                                                                                                    | cb58e723                       |
| `invited-first-response-notifications.test.ts`                         | An invited guest's first answer sent no host "New RSVP" alert or guest confirmation and was logged as an update; then a failed save left the answer claimed, so the retry sent nothing                                                              | cb58e723 / de78391d            |
| `vitest-excludes-agent-worktrees.test.ts`                              | Unit preflight also ran tests from agent worktrees nested under `.claude/worktrees/`, failing on another checkout's suite                                                                                                                           | cb58e723                       |
| `invitation-composer-qa.test.tsx`                                      | Invite composer dropped focus on Tab after a name edit, discarded the draft on close, and hid why disabled-channel rows failed; typing bypassed the 200-recipient cap; imports dropped an invalid first guest or moved names onto the wrong contact | cb58e723 / de78391d            |
| `guest-list-stale-resend.test.tsx`                                     | Guest-list Resend used unreviewed `inviteGuest`, so a stale card resent silently after a reply, rename, or conflict; then a "responded" refusal advised a refresh that could not clear it                                                           | 8be23944 / de78391d            |
| `preflight-worker-typecheck.test.ts`                                   | Local preflight skipped CI's standalone email-worker type-check, so worker type errors passed the local CI-parity gate                                                                                                                              | de78391d                       |
| `floating-rsvp-docking-loop.test.tsx`                                  | The floating RSVP card placed its docking line from whichever card was on screen, so heights that straddled the line flipped it on every pass and logged "Maximum update depth exceeded" (design review B-1)                                        | d1a4521f                       |
| `issue-808-email-contrast.test.tsx`                                    | Emails used web colors on email surfaces: raw-accent links on the white body (Winter 1.33:1), white BOLD hero text where the web needs a scrim (Sunset 2.8:1), faded small hero text, and a 3.1:1 muted gray                                        | #808 / 46ded135                |
| `host-bar-active-tint.test.ts`                                         | The host bar built its active-tab tint as `rgba(${accent},0.2)` from a hex accent, which is invalid CSS the browser drops; the branch was also unreachable. The guard rejects any hex color interpolated into `rgb()`/`rgba()` (design review B-2)  | #806 / 4f84f787                |

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

Task 01a1baab: theme-preset-defaults.test.tsx covers Noto tile assets, full preset effect application, overwrite cancellation, and broad Soft & Dreamy motion.

Task 01a1baab: theme-autosave-order.test.tsx verifies rapid effect edits queue behind the current CAPTCHA-protected save and preserve the complete latest selection.

Task 01a1baab: dialog-viewport-portal.test.tsx covers viewport placement outside filtered cards; theme-preset-defaults.test.tsx also covers legacy missing fonts without false customization and preserves explicit administrator defaults.

Task 01a1baab (review): theme-preset-defaults.test.tsx also covers the live preset baseline, so an administrator's plain Save no longer makes a freshly applied preset show Restore, and the Restore-specific confirmation and Cancel. theme-autosave-order.test.tsx also covers newest-only failure rollback and a saved None staying None on a preset-linked event (replacing a tautological integration case).

Task 01a1baab (review): settings-icon-summaries-fallback.test.ts covers the settings page surviving an unavailable icon catalog, which had dropped its fallback. preset-admin-category.test.tsx covers legacy seasonal presets keeping their category in the admin editor and presentation comparison that ignores JSONB key order.

Task ed4ddceb (#812, design review batch 9):

- `issue-812-app-shell.test.tsx`: the header over event pages was a hard-coded 45% black
  wash (a gray slab on SOFT, a brown band on BOLD) and the host bar used literal surfaces,
  11px labels and JS hover; both now read the solid chrome surface and shared controls. It
  also covers the app-shell 404 that replaced Next's unstyled default, the dashboard's one
  row of filter chips without zero-result chips, the users table that forced 700px inside a
  phone card, and admin headings whose gradient-clipped text hid their emoji.
- `issue-812-guest-list-title.test.tsx`: the guest list drew its own title in the card's
  text color and the body font; it now shares the event hero's title block (heading font,
  hero ink), and its document title names the event only where the link preview would.

Issue #844 extends `sec-40-45-signin-enumeration-shared-ip.test.ts` to cover uniform code-verification failures and normalized identifier limits without a shared loopback bucket.

`signin-code-session-cookie.test.ts` covers action-created sessions honoring `DISABLE_HSTS` like link verification, allowing code sign-in on HTTP installations (#844).

Issue #844 also extends `sec-48-initial-admin-login-only.test.ts`: a link that loses atomic consumption to its paired code must not promote the initial administrator or create another session.

`sec-49-signin-code-open-redirect.test.tsx` (PR #862): `isSafeRedirect` accepted `/\t/evil.example` because URL parsing strips tab/CR/LF, and code sign-in navigated to that relative path, so a crafted sign-in link redirected off-site after a genuine sign-in. The validator now lives in `lib/safe-redirect.ts`, rejects control characters and backslashes and confirms the path resolves to the same origin; the code action no longer echoes the redirect.

### Issue #849 — reminder and delivery reliability (`01a1ddc4`)

- `issue-849-reminders.test.ts`: ordinary reminder recipients, nudge boundaries,
  due-only recipient loading, stale claims and date changes before submission.
- `issue-849-delivery.test.ts`: positive email acknowledgements, failures,
  production no-transport handling, bounded requests and no uncertain fallback.
- `issue-849-blasts.test.ts`: message limits, event/channel quotas and no invitation
  writes for manual email/SMS blasts.
- `issue-849-worker-replies.test.ts`: automated/list/bulk/null/self mail guards and
  acknowledgement headers in both the deployed worker and copied admin template.
  Loads worker source at test runtime so application container type checking does
  not require the independently deployed, Docker-excluded worker.
- `issue-849-scheduler-safety.test.ts`: lock ownership, deletion-log privacy,
  warning visibility and shutdown without premature exit.
- PostgreSQL companion: `tests/integration/lib/reminder-reliability.test.ts`
  exercises actual reschedule SQL, end-only preservation and due-only consumption.
- Redis companion: `tests/integration/lib/cron-lock-ownership.test.ts` exercises
  actual lease expiry and ownership-checked release against Redis.
- Browser delivery companion: `tests/e2e/email-fixture.ts` provides a local SMTP
  acknowledgement for sign-in and invitation success flows instead of relying on
  production console fallback.
- `issue-849-no-transport-preferences.test.tsx`: preserve guest/profile zero-channel
  rendering and read-only behavior independently of the browser SMTP fixture.

Issue #877 (`23f88724`): `issue-877-setup.test.ts` and
`issue-877-setup.integration.ts` cover SYSTEM exclusion, configured-email setup,
verified-only role changes, stale claims, resend/expiry, concurrent proof and
on-demand SYSTEM creation. `issue-877-presets.integration.ts` covers production
catalog initialization without demo data and preservation of preset edits.
`issue-877-first-run.e2e.ts` runs in a separate migrations-only browser fixture
through `scripts/check-first-run-setup.sh`. The #851 seed guards now assert demo-only
seeding and no writes when disabled.

`ship-example-envs.test.ts` covers the #877 shipping blocker: public
`.env.example` / `.env.<name>.example` templates must ship in normal and committed
modes, while real environment files and trailing backup/local suffixes remain
blocking even when an allowed example is present.

`issue-877-ci-runtime.test.ts` covers the first-run helper exiting 3 when CI's
correct Node was outside nvm's version cache. It drives the real shell entrypoint
with CI-style, missing and mismatched runtimes, checks nvm fallback without
automatic selection, and requires failure before database operations if the
`.nvmrc` version cannot be selected. Fixture versions are derived from `.nvmrc`.

`issue-918-upgrade-rehearsal.test.ts` covers #918: no gate upgraded a real
database from the previous release, so the v2 vote-key change and credential
conversion made an image-only rollback unsafe without any failing check. It
guards the rehearsal's baseline and scenario selection (newer-version and
prerelease fixtures), the Git-derived migration list, the data-preservation
rules (declared rewrites, JSON extensions, legacy-secret scope and exact restore
equality), `--plan-only` on a fixture repository and network isolation. It also
requires the Container QC rehearsal steps to run only for manual runs and the
Release gate. PR and push runs keep their checks, shallow checkout and timeout;
tags are fetched only for the rehearsal, with no registry login.

Issue #879 (`9b502818`): `issue-879-potluck-poll-rsvp.test.ts` and
`tests/components/PotluckAndOpenPolls.test.tsx` cover read-only pre-RSVP
potluck visibility, Going-only potluck claiming (`claimPotluckItem` /
`unclaimPotluckItem`), `stripHostOnlyEventData` RSC redaction of potluck
claimer names and potluck activity per `guestListVis`, `lib/poll-voter-token.ts`
`HttpOnly` browser voter cookies, per-poll `requireRsvp: false` open voting
gated by `resolveEventAccess`, Turnstile CAPTCHA, and rate limiting, `addRSVP`
vote linking, and UI behavior across `PotluckSection`, `PollsSection`,
`PollsPanel`, and `RsvpFlow`.

Issue #843 (`6d5da989`): `issue-843-info-only-events.test.ts`,
`tests/components/InfoOnlyEvent.test.tsx`, and `tests/e2e/info-only-events.e2e.ts`
cover info-only events (`Event.rsvpEnabled = false`): creation and Settings
lifecycle (including schedule seeding on re-enable and confirmation when dormant
RSVPs exist), ignoring RSVP tokens/accounts on `PRIVATE` events without a
password, blocking RSVP/check-in/invite/blast/reminder/potluck/guests.csv paths,
standalone `QuestionnaireSubmission` validation, `HttpOnly` token continuity,
`/e/[slug]/questionnaire.csv` `SEC-16` export & `private, no-store` caching,
open polls and comments across `PUBLIC`, `UNLISTED`, and password-unlocked
`PRIVATE` events, and HostBar/Dashboard/Settings UI behavior.
