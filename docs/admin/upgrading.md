---
title: Upgrading
description: Safe upgrade procedures, backups, migrations, and rollback.
category: Maintenance
audience: admin
order: 60
---

# Safe Upgrading Guide

This guide explains how to safely pull new versions of **RSVP to Me**, perform database backups, run migrations, and verify your upgrade.

---

## Table of Contents

1. [How Updates Work](#how-updates-work)
2. [v2.1.0 release](#v210-release)
3. [v2.0.0 release](#v200-release)
4. [Before You Upgrade — Back Up Your Data](#before-you-upgrade--back-up-your-data)
5. [Checking the Current Version](#checking-the-current-version)
6. [Performing the Upgrade](#performing-the-upgrade)
7. [Database Migrations](#database-migrations)
8. [Verifying the Upgrade](#verifying-the-upgrade)
9. [Rolling Back](#rolling-back)
10. [Setting Up Automatic Backups](#setting-up-automatic-backups)

---

## How Updates Work

RSVP to Me is distributed as a pre-built Docker image. When a new version is released:

- A new Docker image is pushed to our container registry.
- Stable releases receive an exact version tag, a minor-version alias, and `latest`.
- Prereleases receive only the exact version tag and do not move stable aliases.
- Database migrations (if any) are applied automatically when the new container starts.

The production `docker-compose.release.yml` uses `latest` by default. For a
controlled rollout, pin its app image to a version or digest before pulling.
Container tags omit the leading `v`: Git release `v1.5.0` publishes image `1.5.0`.

Commands below use `-f docker-compose.release.yml` to avoid the repository's
native-development override. Run them in your existing deployment directory,
retaining its project name, mounts, `.env`, and secrets. If your deployment uses
a custom Compose file or additional overrides, use those same files throughout;
do not replace a working configuration or move its data as part of this upgrade.

> **Note:** Docker does not automatically update running containers. You must manually pull and restart services to run the updated code.

### Who can publish container images

The Release workflow's publishing job requires both `github.actor` (the original
publisher) and `github.triggering_actor` (the person starting this run or rerun)
to match `github.repository_owner`, currently `joe-cole1`. Package-write
permission is granted only to that guarded job.

| Release action                                        | Publishing job                          |
| ----------------------------------------------------- | --------------------------------------- |
| Owner publishes a release or reruns their own release | Allowed                                 |
| Collaborator or bot publishes a release               | Skipped                                 |
| Collaborator or bot reruns an owner-published release | Skipped                                 |
| Owner reruns a collaborator- or bot-published release | Skipped; the original actor is retained |

Publishing a GitHub release can therefore succeed while the image job is skipped.
Check the **Release** workflow result before expecting a new GHCR image. Keep
release publication and reruns with the owner; a rerun does not change the
original publisher. Release tags must include the current publishing safeguards.
Rerunning an old release uses its original commit and cannot adopt a guard that
was added later on `main`. See GitHub's [context reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#github-context)
and [rerun behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs).

The YAML guard is separate from GitHub's repository-level execution protections.
To enforce the same restriction before the workflow starts, configure **Settings
→ Actions → Policies** for `.github/workflows/release.yml`, allowing the owner
and the `release` event. Keep CI and Container QC outside that publishing policy.
Merging this change does not create or modify that setting. See [GitHub's policy
guide](https://docs.github.com/en/actions/how-tos/administer/control-workflow-execution).

---

## v2.1.0 release

v2.1.0 adds info-only events without RSVPs (#843, #942), structured
questionnaire contact and terms fields with quick-add templates and a Going-only
filter (#786, #943), pre-RSVP potluck visibility and per-poll open voting
(#696, #879, #941), and a cleaner event hero without a dark background scrim
(#944).

- **Migrations:** three additive migrations run automatically at startup:

  | Migration                                                | Change                                                                                   |
  | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
  | `20261126120000_poll_require_rsvp`                       | Adds per-poll `requireRsvp` toggle and browser voter token identity for open polls.      |
  | `20261127000000_info_only_events`                        | Adds `Event.rsvpEnabled`, comment voter tokens, and standalone questionnaire tables.     |
  | `20261127010000_questionnaire_field_types_and_templates` | Adds `PHONE`, `ADDRESS`, and `TERMS` `RSVPFieldType` values, `description`, `goingOnly`. |

- **Environment & worker:** no new environment variables are required, and no
  Cloudflare email worker redeployment is needed. Node 22, PostgreSQL 18, and
  Redis 8 remain the supported runtime and services.
- **Source installs:** the temporary `brace-expansion` compatibility shim,
  `.npmrc`, and overrides have been removed (#546, #945); source installations
  use standard `npm ci` from the checked-in lockfile.
- **Rollback:** see [Rolling back v2.1.0 to v2.0.0](#rolling-back-v210-to-v200).
  If you are upgrading directly from v1.5.0, also complete the
  [v2.0.0 breaking-change checklist](#breaking-change-checklist) first.

---

## v2.0.0 release

v2.0.0 is a major release. It hardens accounts, events and public RSVPs, replaces
invite-code environment configuration with a first-administrator setup page, and
adds recipient notification preferences, paired sign-in codes, configurable
event URLs, offline background effects and occasion presets. The project is now
licensed under AGPL-3.0-only. Node 22, PostgreSQL 18 and Redis 8 remain the
supported runtime and services.

**Upgrading is one-way.** v1.5.0 cannot run safely on an upgraded database. The
only supported way back is to restore the backup taken before the upgrade, which
loses everything received after it. Take the backups in
[Before You Upgrade](#before-you-upgrade--back-up-your-data) and read
[Rolling back v2.0.0 to v1.5.0](#rolling-back-v200-to-v150) before you start.

### Breaking-change checklist

Check each item before upgrading:

- [ ] **`HOST_INVITE_CODE` is retired.** Remove it from `.env`. Set
      `INITIAL_ADMIN_EMAIL` and email delivery; an instance with no real
      administrator finishes setup at `/setup`. Existing database invite codes
      and administrator roles are kept. Create new codes in **Admin Panel → Host
      settings**. See [Seed-free first-administrator setup](#seed-free-first-administrator-setup-877). (#877, #882)
- [ ] **IP rate limits apply only with `TRUSTED_IP_HEADER`.** Without it,
      forwarding headers are ignored and the per-IP tiers are skipped; contact,
      account and token limits still apply. Behind a trusted reverse proxy, set it
      to the header that proxy writes. See
      [TRUSTED_IP_HEADER](configuration.md#trusted_ip_header). (#847, #873)
- [ ] **Public RSVPs with a contact require verification.** A guest who gives an
      email address or phone number must enter a code sent to it before the RSVP
      is saved, so a working email provider (and SMS provider, for phone numbers)
      is effectively required. Test delivery before and after upgrading. See
      [Public RSVP contact verification](#public-rsvp-contact-verification-792). (#792, #895, #849, #875)
- [ ] **Sessions are checked in PostgreSQL on every request**, even with Redis
      configured, so the database must stay available. Existing event-password
      unlock cookies are invalidated; visitors enter the current password again.
      Sign-out is a same-origin POST from the app, so a link or script that signs
      out with a GET request no longer works. See
      [Account and participation hardening](#account-and-participation-hardening). (#872)
- [ ] **Uploads have a quota and a cleanup.** Each account has a fixed 100 MiB
      upload quota (the 8 MiB per-file limit is unchanged). At startup and in the
      daily maintenance job, uploads that no cover or avatar references and that
      are older than 24 hours are removed. Back up `data/uploads` together with
      the database. See [Upload storage and cleanup](configuration.md#upload-storage-and-cleanup). (#850, #876)
- [ ] **Event URLs.** Existing URLs are kept. New Unlisted and Private events get
      random six-character URLs, and renaming a URL breaks the old link with no
      redirect. See [Event links](#event-links-880). (#880, #884)
- [ ] **Phone numbers outside North America need a `+` country code.** Existing
      North American numbers without one still match their invitations. See the
      [SMS guide](sms.md). (#848, #874)
- [ ] **Redeploy the optional Cloudflare email worker** (or replace the copied
      **Admin → Email** template) to enable its new auto-reply guards. The
      upgrade does not deploy it. See the [email guide](email.md). (#849, #875)
- [ ] **License.** RSVP to Me is now licensed under AGPL-3.0-only. If you modify
      it and let others use it over a network, you must offer them the source of
      your version. See the [Installation Guide](installation.md). (#797)
- [ ] **Stop every old app instance** before the new one starts. Mixed-version
      rolling upgrades are unsupported: old instances cannot read the new
      credential format or enforce notification preferences.

### What runs at startup

The first v2.0.0 start takes a pre-migration snapshot,
`data/backups/pre-migration/pre-migration-schema_<timestamp>.sql`, then applies
twelve migrations:

| Migration                                        | Change                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `20261103120000_notification_preferences`        | Adds recipient notification preferences and converts the old Email/SMS switches.             |
| `20261103121000_event_notification_eligibility`  | Records which account contacts each event's old alert switches covered.                      |
| `20261103122000_organizer_notification_bindings` | Creates organizer notification rows for events whose alerts were on.                         |
| `20261107120000_guest_invited_display`           | Adds the Invited display row; hides a count wherever its names were already hidden.          |
| `20261107180000_theme_effect_library`            | Adds effect icon and movement columns (additive only).                                       |
| `20261108130000_theme_preset_defaults`           | Adds eleven presets and preset presentation; fills empty effects on linked built-in presets. |
| `20261112201312_signin_code`                     | Adds paired six-digit sign-in codes to sign-in links.                                        |
| `20261115000000_participation_identity`          | Adds RSVP identity to votes and claims; drops the name-based vote index; clears vote links.  |
| `20261115130000_upload_accounting`               | Records uploads for the per-account quota.                                                   |
| `20261116100000_seed_free_presets`               | Installs missing built-in presets without changing existing rows.                            |
| `20261116120000_event_url_codes`                 | Adds event URL provenance for generated codes.                                               |
| `20261117000000_rsvp_contact_proof`              | Adds public RSVP contact-verification challenges.                                            |

It then converts saved provider credentials to the new encryption format,
first taking a mandatory `pre-migration-secrets_<timestamp>.sql` snapshot when
any need converting. See
[Automatic configuration-secret conversion](#automatic-configuration-secret-conversion-328--339).
Expect a longer first start than usual and measure readiness with the health
check.

### Automatic configuration-secret conversion (#328 / #339)

The upgrade containing these fixes automatically converts saved SMTP passwords,
Cloudflare worker secrets/API tokens, and Twilio auth tokens to versioned
encryption with random salts. This is an application data conversion, not a
Prisma schema migration. Events, RSVPs, accounts, and session formats are
unchanged. Environment-only credentials need no conversion; empty settings
stay empty. Hosts and guests take no migration steps.

Keep your existing `ENCRYPTION_KEY` exactly as configured. If it is unset,
keep using the same `SESSION_SECRET`; do not introduce a new encryption key
during this upgrade. Back up the database and `.env`, record the old image
digest, and stop all older app instances before the new one starts. The normal
single-app Compose recreation already replaces the old instance. Mixed-version
rolling upgrades across this format change are unsupported.

The container converts secrets before seeding and starting the web server.
Before changing any credentials it requires a successful automatic pg_dump
snapshot under `data/backups/pre-migration/`. The earlier schema snapshot remains
best-effort; secret conversion takes its own mandatory snapshot when needed.
Backups may contain old plaintext credentials, so protect them as secrets.
Startup retains seven schema snapshots separately from seven secret-recovery
snapshots (conversion, selective rollback and old unclassified dumps). It rotates
only after a new successful dump, so ordinary restarts cannot age out conversion
recovery points. The Admin Backups table shows read-only metadata; manage or copy
these sensitive files on the server. Save any required long-term recovery point
in protected storage before it ages out of its pool.
Conversion and its completion marker commit together. Subsequent restarts
verify the new format without changing credentials or repeating conversion.

Logs include a summary such as `[config-secrets] migrate: 2 converted, 0 verified;
v2 ready.` On failure, `[config-secrets] ERROR:` explains the affected setting
or backup/database problem without displaying credentials. Startup stops and
the secret transaction rolls back; successful earlier schema migrations remain
applied. Fix the cause before restarting. Wrong-key failures require the
original key; ambiguous legacy plaintext containing colons or corrupt data
must be repaired using the previous app before retrying. No credentials need
re-entry for a normal upgrade. Verify health and test enabled email/SMS after
the app starts.

If corruption is detected after a successful conversion, restore a valid v2
credential from a protected backup. An older app cannot read credentials in
the new format, so do not start it on the converted database; to go back to
v1.5.0, follow [Rolling back v2.0.0 to v1.5.0](#rolling-back-v200-to-v150).

For a read-only check using the new image, without starting the web server:

```bash
docker compose -f docker-compose.release.yml run --rm --no-deps app npm run db:secrets -- --check
```

`npm start` and `scripts/dev-sync.sh` also convert automatically. Native/source
installations need `pg_dump` on PATH and writable `data/backups/pre-migration/`
when conversion is necessary. Custom launchers that start Next.js directly must
run `npm run db:secrets` after schema deployment and before serving requests.

**Selective credential downgrade (`db:secrets --rollback`).** The command
still rewrites only the saved credentials to the previous format, but it is
not a supported way back from v2.0.0 to v1.5.0: v1.5.0 also mishandles
same-name poll votes on the upgraded schema. Restore the pre-upgrade database
instead. That backup predates the conversion, so no credential downgrade is
needed after the restore. Keep the same `SESSION_SECRET` and `ENCRYPTION_KEY`
when restoring any backup.

### Account and participation hardening

The participation identity migration preserves existing vote counts and potluck
quantities without assigning old display names to accounts or RSVPs. Historical
votes have no automatic personal selection; guests can make a new choice.
Historical potluck claims remain visible and count toward capacity; hosts can
remove them. New votes and claims remain independent when guests share a name.
The migration drops the display-name vote index. v1.5.0 still matches votes
by display name, so on upgraded data a guest retracting a vote also deletes
the vote of every other guest with the same name on that option. Going back
therefore requires restoring the pre-upgrade backup; see
[Rolling back v2.0.0 to v1.5.0](#rolling-back-v200-to-v150).

The upgrade invalidates existing event-password unlock cookies. Visitors can
enter the current password again. Future password changes also invalidate those
cookies. Existing account sessions are checked against PostgreSQL on every
request, so database availability is required even with Redis configured.

Stored avatars and covers must be upload paths generated by the application.
Invalid historical URLs show no image; re-upload the image through the existing
profile or event controls. External image URLs are not fetched for social cards.

### Seed-free first-administrator setup (#877)

Normal installation no longer requires baseline seeding. Keep `SEED_TEST_DATA=false`;
it controls demo content only. Configure `INITIAL_ADMIN_EMAIL` and email delivery,
then open `/setup` if the instance has no real administrator. Verify the emailed
LOGIN link or code to finish. SYSTEM is ignored when checking for existing admins.

`HOST_INVITE_CODE` is retired. Existing database codes and administrator roles remain
unchanged; manage codes in the Admin Panel. Remove the obsolete environment variable.
Migrations insert missing built-in presets while preserving existing preset rows.
SYSTEM is created on demand before account-deletion cleanup. Container restarts no
longer refresh or overwrite theme presets through seeding.

### Public RSVP contact verification (#792)

Apply `20261117000000_rsvp_contact_proof` through the normal upgrade process.
It adds an event-scoped challenge table without rewriting existing RSVP,
invitation, account or notification records. No new environment variables or
provider settings are required. New proof requests use the configured email/SMS
adapters, so delivery must work for each contact a guest supplies.

Public-form submissions containing email or phone now require verification of
each supplied contact, followed by review and explicit confirmation. Requests
use the same behavior for new and invited contacts and return no invitation
state or private link. Code verification neither signs in a user nor changes an
RSVP. Successful final submission may return the proved RSVP's private edit link.
Existing invitation-link, signed SMS and organizer responses remain available.
Contactless public submissions create separate new RSVPs.

Codes and receipts expire after 15 minutes. Each challenge allows five
code attempts; issuance is capped at five requests per destination per hour,
with a one-minute resend interval per event/contact. A trusted IP is limited to 15 requests per 10 minutes.
The existing scheduled challenge cleanup removes consumed or expired public RSVP
proof records after 24 hours. Do not log codes, receipts or full private links.

If delivery is unavailable, guests should retry, use their original invitation
link or contact the host. See [Managing RSVPs](../host/managing-rsvps.md).

### Event links (#880)

Apply the additive `slugRandomCode` migration with the normal upgrade process.
Existing event URLs are preserved and their provenance starts empty; no invitation
links are rewritten automatically. New Public events retain title-based URLs.
New Unlisted/Private events use case-sensitive six-character alphanumeric codes,
with bounded collision retries that grow to eight, ten and twelve characters.

Hosts/co-hosts can edit or regenerate URLs in Display options. Unlisted custom
links require an explicit guessability choice, including when visibility changes
from Public or Private. URL changes require confirmation that shared links will
break. No old-to-new redirect is installed. Have hosts redistribute invitations,
RSVP and calendar links after a rename; password unlocks are tied to the address.
New email/SMS links use the current event URL. Already delivered messages retain
their old addresses. Six-character codes are a convenience/privacy tradeoff;
Private/password access checks remain the protection for sensitive events.

Generated-code previews expire after 15 minutes and are not reservations. A save
rechecks database uniqueness and rejects stale URL/visibility state from another
tab. Preview proof uses the existing configuration/session encryption secret;
no new environment variable is required. Secret rotation invalidates outstanding
previews; hosts can generate another. General settings updates cannot switch to
Unlisted without the dedicated URL decision flow.

### Event password controls (#878)

Existing event passwords remain active when visibility changes to Public or
Unlisted. Display options now keeps the password controls visible whenever a
password is set and always offers **Remove password**, followed by confirmation.
The displayed password status changes only after a successful save. Hosts can
remove passwords previously hidden by a visibility change without switching back
to Private. Removing a Private event's password does not remove its invite-only
restriction. No data migration or configuration change is needed.

### Recipient notification preferences (`01a1a105`)

Back up the database and stop every old application instance and scheduler
before applying this upgrade. Do not mix legacy producers with preference-aware
workers: old binaries cannot enforce category/event preferences or revocation.
The additive notification migrations run through normal `prisma migrate deploy`.
No new credentials, environment variables or dependencies are required.

Migration keeps the scope each legacy choice had. The old Email/SMS switches covered
reminders and host blasts, so they become update/reminder choices, not channel blocks;
confirmations, approval decisions and host alerts keep arriving as before. The old
channel choice keeps applying to event updates. Both checks email and text; because no
address is verified at upgrade, it stays one message, email first, then SMS, never
duplicate delivery. A recipient gets a copy on each channel only after verifying those
addresses. Organizers keep
the account contacts their event's alert switches covered; events whose alerts were off
get no organizer row, so turning alerts on later works. No contact is marked verified.
Connections remain unverified until the owner proves possession; enrollment does
not change login identity or existing event contacts.

Old reminder timings merge by offset while retaining source-channel ceilings.
Either sent marker consumes the merged occurrence. Already-due occurrences are
consumed at upgrade to avoid a catch-up burst. Migrated schedules keep their channel
limits until a host chooses **Let each guest's settings decide**.

Recipients see only channels the site offers: a channel must be enabled here and its
provider configured. Disabling a service hides it without discarding anyone's choices;
re-enabling it restores them. Used and expired verification challenges are deleted a
day later by the existing rate-limit cleanup job.

Verify profile preferences, private guest management, confirmation decisions,
organizer alerts and reminders after upgrade. See
[Notification Preferences](../host/notification-preferences.md) and the
[local milestone test plan](../engineering/testing/01a1a105-notifications.md).
Manual blasts now apply the **Event updates** choices too (#789), with the host's
selected channels as a limit. Verify an opted-out guest is skipped and an eligible
guest remains reachable. This adoption needs no additional migration, credential or
dependency. Manual blasts retain independent submissions for each permitted channel
the host selects, including unverified contacts; the composer reports provider
acceptance, skips, failures and uncertainty instead of requested-recipient counts.
Invitations remain separate.
Authentication and inbound SMS behavior are not migrated.

A database-only additive rollback is insufficient: a legacy binary would ignore
new preferences. Before downgrading, stop notification production or restore a
consistent pre-upgrade database/application backup. Destination challenges,
connections and event bindings contain private contact information; protect
backups accordingly and never copy verification codes or private links into logs.

### Guest RSVP display table and Invited row (#811)

The `20261107120000_guest_invited_display` migration adds two event fields,
`guestInvitedList` and `guestInvitedCount`, both defaulting to `HIDDEN`, so no
existing or new event shows invited guests to other guests until a host turns it
on. Counts are now independent of names, so the same migration sets a response's
stored count to `HIDDEN` wherever its names were already hidden; guest-facing
pages look the same after the upgrade.

Hosts set all four rows in one table under **Settings → Display options → Guest
RSVP display**, and every row's count may now use the 3+ cap. When the Invited
row is hidden, invited guests are not queried for or sent to guest browsers;
when it is shown, guests receive names only (never contact details or edit
tokens), and still only when guest list visibility lets them see the list.

The theme's effect **Density** and **Size** controls are replaced by one
**Amount** choice that writes the existing `effectDensity` and `effectSize`
fields. No theme data changes during the upgrade, and stored sizes above 2× keep
rendering until a host picks an Amount. No environment variable is required.
(#825 later restored a separate Size control; see below.)

### Searchable background effects, movement and size (#825)

The `20261107180000_theme_effect_library` migration adds two `EventTheme`
columns: `effectIconIds` (a text array, default empty) and `effectMovement`
(nullable, no default). It is additive only — no existing row is rewritten.
Every event keeps its built-in effect, Amount, Speed and stored size exactly as
before, including sizes outside the new quick choices (for example 6×) and
sizes an #811 Amount choice wrote; a `NULL` size still means 1×, and a `NULL`
movement keeps each built-in set's own fall/float direction.

Hosts can now mix up to three icons from a local library (Noto Emoji 1.2.10,
3,729 icons, one per emoji) that they search in English, Dutch,
German and Spanish, and they set Amount (count only), Size (3×/5×/7× or a
1–10× slider), Speed and Up/Down/Random movement independently. A mixture is
stored as `effectId = 'custom'` plus its icon ids; only ids and settings are
stored, never artwork or URLs.

The first build of this feature (PR #827) also shipped Fluent Emoji Flat 1.2.6.
Every Fluent icon was the same emoji as a Noto one, so it only duplicated search
results and was removed before release. Only `noto:` ids are valid; a test
event that saved a `fluent-emoji-flat:` id from that build shows no effect,
and its editor asks the host to pick the icons again.

**Packaging.** The artwork ships in `public/effects/library/<collection>/<version>/`
(about 24 MB of SVG) and the manifest, provenance and CLDR 49 labels/keywords in
`lib/effect-catalog-data/` (about 6 MB of JSON). The container image already
includes both directories; no volume, download job, cache, API key, environment
variable or outside service is involved, and the existing Content Security
Policy is unchanged. The server reads the data once per process (only when an
event uses a mixture or a host searches), and the browser only receives the
selected icons and one page of 24 search results at a time. The versioned
library paths are served with `Cache-Control: public, max-age=31536000, immutable`.
Host searches go to `GET /api/effects/search`, which requires a host, co-host
or admin session for the event and allows 120 searches per user per minute
(Redis, or the database fallback, like other rate limits).

**Licensing.** Noto Emoji artwork is Apache-2.0 (Google), with its notice and
regional-flag notice; the labels and keywords come from Unicode CLDR under the
Unicode License v3. The full texts are served at
`/effects/library/noto/1.2.10/LICENSE.txt`, `NOTICE.txt`, `REGION-FLAGS-LICENSE.txt`
and `/effects/library/cldr/49.0.0/LICENSE.txt`; source versions and checksums
are recorded in `lib/effect-catalog-data/provenance.json`. These licenses
cover the artwork and data only; they grant no trademark rights.

**Updating the library.** The versions are pinned. A newer collection or CLDR
release is an intentional code change: prepare the new version directory and
data files offline, keep the old ids that events reference (or plan their
replacement), update `provenance.json` and the notices, and ship it like any
other release. The application never downloads icons at runtime. If a stored
icon id disappears from the catalog, that event simply shows no effect, and
the host editor explains why.

### Theme preset defaults (01a1baab)

The additive preset-presentation migration adds eleven presets, Noto tile artwork,
categories and complete default effects. It fills empty effects once on existing
events linked to the affected built-in presets, including customized theme colors.
Existing active effects and theme colors are preserved. Older explicit None choices
cannot be distinguished from untouched empty effects and receive the new defaults.
The migration does not run again on later visits; subsequent None choices persist.
Effects and animation remain web-only and do not enter email.

Administrators can select a preset category, search the local Noto library for a tile
icon, and edit a default mixture of up to three icons with its amount, size, speed and
movement. Save as default includes this metadata; reset restores it too.

The local preflight formatter caps command batches at 64 KB so the Noto asset catalog
does not exceed the npx shell-command argument limit. The file set and checks are unchanged.

Hosts compare against, and Restore to, the applied preset's current settings, so an
administrator's Save reaches hosts at once and never makes a freshly applied preset look
customized. Save as default and the original snapshot remain administrator reset points;
older snapshots that omit newer settings such as font or card opacity inherit the current
preset's values there, while explicit saved values are preserved. No database rewrite is
needed.

Sample seeding preserves all fields of existing preset rows, so an administrator's
category choice survives restarts; new rows still receive the built-in values. Presets
saved before categories existed show as Seasonal when their seasonal flag is set. If the
icon catalog cannot load, the event settings page still opens, without effect icon labels,
and logs a warning.

### Event display and accessibility corrections (#853)

Event cards and event-page times now use the event's stored timezone and display its
zone label. Server and browser timezone settings no longer change card times. No data
migration or new configuration is required.

After upgrading, reload open event settings tabs. The updated Display options and RSVP settings editors send only changed
fields, preserving other tabs' changes to unrelated settings. Older already-open clients
still send their old full payload until refreshed; edits to the same field remain
last completed save wins. Existing administrator moderation access is preserved.

All document routes share a main landmark and keyboard skip link. RSVP fields have
visible labels, autocomplete, linked validation errors, error announcements and focus
management. RSVP document titles identify the page, showing the event title only when
existing public metadata rules allow it; private, password-protected and unpublished
events keep a generic title.

### ESLint 10 development tooling (#340)

The root development toolchain now uses ESLint 10 with the existing Next.js lint
presets. Follow the normal locked install and preflight process; no application,
database, environment-variable or host workflow changes are required. Next.js
16.4.0 added the compatibility handling for the former `context.getFilename()`
crash, so the React lint plugin does not need replacing. Bundled plugins may
still emit npm peer-range warnings; no peer-resolution bypass flags are needed.
The temporary `#546` `brace-expansion` adapter, `.npmrc`, and overrides were
removed once upstream published patched `brace-expansion` 1.x releases (`>= 1.1.21`),
so source installations run normal `npm ci`.
The existing workflow tests now declare their YAML parser (`js-yaml`) directly
as a development dependency because ESLint 10 no longer brings it in transitively.

---

## v1.5.0 release

This release adds Dutch, German, and Spanish UI and notifications, the reviewed
"Invite people" flow, guest-facing RSVP display settings, and a nonce-based
script Content Security Policy. It adds no environment variables, and Node 22
remains the supported runtime.

- **Migrations:** two migrations run automatically at startup and only add
  columns. See [Guest RSVP Display Preferences](#guest-rsvp-display-preferences-667)
  and [User Language Preference](#user-language-preference-732).
- **Caching:** page HTML and React Server Component responses now carry a
  per-request script nonce. A reverse proxy or CDN must not cache or replay
  them, or the cached page blocks its own scripts. Static files under `/_next/`
  and `public/` may still be cached. Check this before upgrading.
- **Sessions:** iron-session 9 reads cookies written by version 8, and version
  8 reads version 9 cookies, so existing sign-ins survive the upgrade and a
  rollback.
- **Image contents:** the container image installs production dependencies
  only. `tsx` is a runtime dependency because startup seeding needs it. Source
  installations must reinstall with `npm ci` from the lockfile.
- **Fonts:** the Roboto theme font is bundled locally. Other Google font
  families still download at build time.
- **Email worker:** the optional worker's Wrangler toolchain is updated. The
  worker API and the admin copy-and-paste template are unchanged; this release
  does not deploy the worker.
- **Host-visible changes:** a 文A language button replaces the header flag;
  hosts invite through the review step; events created after the upgrade
  default to a collapsed "Can't make it" list with no guest-facing count; and an
  unnamed invitee is greeted as "Guest" in the inviting host's language.

During release QC, also check language switching on signed-out and signed-in
pages, inviting through the review step with real operator-controlled email
and SMS destinations, guest list Resend, the display settings on a new event,
and that the browser console shows no Content Security Policy violations.

## v1.4.1 maintenance release

This batch updates Next.js and its ESLint configuration to 16.3.6, Sharp to
0.35.4 in both the application and the optional email worker, Nodemailer to
9.1.1, and html-to-text to 10.0.1. It also refreshes vulnerable transitive
packages. It adds no database migrations or environment variables.

Prisma 7.10.1 now natively depends on deepmerge-ts 8.0.2 through
`@prisma/config`; html-to-text 10.0.1 also accepts the patched 8.x dependency.
The temporary deepmerge-ts overrides have been removed (#603). Keep the
remaining compatibility overrides, including mysql2 3.24.4 for the Prisma CLI;
#546 tracks the legacy brace-expansion adapter. The regression baseline checks
all deepmerge-ts resolutions remain at least 8.0.0 and loads the real Prisma
configuration. Do not use `npm audit fix --force`: a proposed Prisma 6 downgrade
changes the application's supported major version.

The locked development wait-on dependency tree now uses patched Joi 18.3.1 to
address GHSA-4528-x5fx-h6hg; the regression baseline requires 18.3.1 or newer.
Reinstall from the checked-in lockfile with `npm ci`.
`tsx` remains a production dependency for database seeding, with a stable
security minimum of 4.23.15 rather than an exact patch requirement (#779).
Newer stable compatible versions are allowed; prerelease or development-only
resolutions do not satisfy the runtime guard. These dependency maintenance
changes add no migrations, configuration, or host/guest behavior changes.

The optional worker's Cloudflare types now match Wrangler's declared version-5
peer requirement. Reinstall from `worker/package-lock.json` with
`npm ci --prefix worker` when working on that package. This does not deploy the
worker or change its email API. The worker handler annotations now use the
Cloudflare email/request/response types. These annotation changes do not alter
the transport logic or require a change to the admin copy-and-paste template.

CI runs on pull requests, manual dispatches, and pushes to `main`, so each
merge receives its own verification run. It audits the root and worker
packages, and type-checks the tests and worker after the production build.
Unit tests block unmocked HTTP fetches; provider tests use local mocks rather
than sending fixture credentials or messages to live services. The SEC-14
regression now mocks the current REST transport and template-settings lookup.
Vitest and `@vitest/coverage-v8` are aligned at 5.0.2, retaining the earlier
security fixes and exercising the new coverage provider in CI. Keep these packages on matching
versions and verify `npm run test:coverage` when updating the coverage provider.
This test-tool patch does not change application or worker runtime dependencies.

The follow-up UI/test batch updates `lucide-react` to 1.47.0,
`@testing-library/user-event` to 14.6.7, and `@types/pg` to 8.23.1. The PostgreSQL
driver and database schema are unchanged. Lucide preserves the icon exports used
by the app; the Going confirmation's circled checkmark is slightly redrawn.
Check dashboard controls, RSVP status summaries, and keyboard interactions
during release QC.

Before publishing, require passing CI for the merged commit and smoke-test the
built image: sign-in, event creation, public and protected RSVPs, RSVP editing,
image uploads, and email delivery. Record the previous image digest and back
up the database and uploads. This dependency-only batch needs no database
restore for a routine image rollback; preserve RSVPs received after deployment.

React and React DOM are aligned at 19.3.0. Zod 4.6.5 uses explicit compatibility
helpers to retain the existing UTF-16 text limits. Playwright 1.63.0 and its
Docker browser image are updated together. Dotenv 18.0.4 preserves ordinary
`.env` loading; this repository does not use its removed `.env.vault` or legacy
`dotenv_config_*` CLI arguments. Custom source-installation tooling that uses
those removed interfaces needs a separate adjustment.

### Release tags and publication checklist

The release tag validator accepts `vMAJOR.MINOR.PATCH` and optional SemVer
prerelease suffixes. Build metadata (`+build`) is rejected because Docker tags
cannot represent it without renaming. Either a prerelease suffix or GitHub's
prerelease checkbox prevents stable aliases from being written. Automatic
`latest` generation in the metadata action is disabled.

| GitHub release | Prerelease checkbox | Published image tags     |
| -------------- | ------------------- | ------------------------ |
| `v1.5.0`       | Off                 | `1.5.0`, `1.5`, `latest` |
| `v1.5.0-rc.1`  | On or off           | `1.5.0-rc.1`             |
| `v1.5.0`       | On                  | `1.5.0` only             |

Prefer a suffixed candidate tag such as `v1.5.0-rc.1` so its exact image tag is
also separate from the final release. Stable publication still moves `latest`
even for an older stable version, so do not publish an old stable tag as a test.
The guard applies only to releases whose tagged commit includes it; rerunning
an older release does not adopt new workflow code.

Before the owner publishes a release (for example `v2.0.0`):

- [ ] Merge the release-preparation PR and record the resulting `main` SHA.
- [ ] Require CI, CodeQL, and both native Container QC jobs to pass on that SHA.
- [ ] Run Container QC manually on that SHA, which includes the
      [upgrade rehearsal](#upgrade-rehearsal-918), and review its job summary.
- [ ] Review the prepared notes in `.github/release-notes/vX.Y.Z.md` and confirm
      the comparison with the previous release adds only the migrations and
      variables they list.
- [ ] Record the current deployment image digest and back up the database,
      uploads, and `.env`; verify a restore on a disposable database.
- [ ] Run staging QC on a candidate built from the reviewed SHA: sign-in, event
      creation, public and protected RSVPs, guest edit links, cover/avatar upload,
      mobile/keyboard controls, and real delivery to operator-controlled email
      and SMS destinations for each enabled provider. Provider CI tests use mocks.
- [ ] Obtain publication approval, then create the tag/release at the reviewed
      SHA. Publishing a release triggers an image build and registry push; merging
      the preparation PR or saving a GitHub release draft does not.
- [ ] Require the Release workflow to pass; record the resulting multi-platform
      digest and confirm both `linux/amd64` and `linux/arm64` manifests exist.
- [ ] Roll out the pinned image, repeat the health and core-flow checks, and
      watch application/provider logs before considering the rollout complete.

Image publication rebuilds the reviewed commit; it does not promote the exact
local image used by Container QC. Verify the published image as well. Source
builds still fetch fonts through Next.js and can hit the tracked upstream font
query failure; the application serves those fonts locally at runtime.

### Container QC before publishing

The Docker Actions batch pins QEMU 4.4.0, Buildx 4.4.1, and Build/Push 7.4.0.
The separate **Container QC** workflow runs on pull requests, pushes to `main`,
and manual dispatches. Require both `Container (amd64)` and `Container (arm64)`
to pass for the commit being reviewed, alongside the existing CI and CodeQL
checks. These are review gates; repository branch-protection settings are managed
separately.

Each job first validates the production Compose file in a fresh directory with
only that file and an example `.env`: no source tree or Dockerfile is needed,
and the app is enabled without development overrides. It then builds the
unchanged production Dockerfile on a native runner, loads
the image locally, and starts it with new disposable PostgreSQL 18 and Redis 8
containers. It checks the normal migrations-only startup, the image's Docker
health check, detailed and anonymous health responses, homepage rendering,
UID/GID 10001 storage access, Redis connectivity, and Sharp JPEG/WebP/AVIF
conversions. After initial startup, the app restarts to create a real startup
backup of the populated schema. That SQL dump is restored with stop-on-error
into a separate disposable database; an explicit existing invite fixture and migration history
must match the source. QEMU is also exercised with a small
opposite-architecture container. Test data uses an isolated internal network
and temporary volumes; no existing deployment data is used.

The workflow has read-only repository permissions, no registry login, and
`push: false`. It neither publishes an image nor deploys anything. Native image
checks cover both released architectures, but do not exercise the release's
combined multi-architecture registry push. Keep staging QC for sign-in, RSVP
flows, uploads, and real email delivery before approving a release. A green
container check alone is not deployment approval.

To repeat the image checks locally on a Docker-enabled machine:

```bash
docker build -t rsvp-container-qc:local .
# Use arm64 instead of x64 on an ARM64 machine.
bash scripts/container-smoke.sh rsvp-container-qc:local x64
```

### Upgrade rehearsal (#918)

This is the pre-release upgrade check. It runs `scripts/upgrade-rehearsal.sh`
against the image Container QC just built, on both architectures, but only:

- **manually, before you tag a release.** Go to **Actions → Container QC → Run
  workflow** on `main`, or on the release-preparation SHA. Optionally enter a
  `rehearsal_from` tag to rehearse from an older release.
- **as the Release gate.** When a release is published, the Release workflow
  runs Container QC for that commit, and a blocking failure stops the image
  push. The GitHub release and tag already exist by then, so run the manual
  check first.

Pull requests and pushes to `main` skip both rehearsal steps. Their Container QC
runs are unchanged, including the shallow checkout and 35-minute limit. A
blocking failure fails that run's `Container (amd64)` / `Container (arm64)` job;
the job summary lists every check. The rehearsal:

1. **Seeds the previous release.** By default the baseline is the newest stable
   `vX.Y.Z` tag reachable from the commit, excluding tags on that commit
   (prereleases never). Its published image starts with its own
   `SEED_TEST_DATA` fixtures, then the rehearsal adds data through that
   release's own server actions and upload route: saved SMTP, Twilio and
   Cloudflare secrets; avatars, a shared cover and an unreferenced upload; an
   Unlisted password-protected event with display settings and reminders;
   polls, potluck claims, two guests with the same name, companions, an edited
   RSVP and email/SMS invitations. Every upload is then aged 48 hours.
2. **Takes the operator backup** from [Before You Upgrade](#before-you-upgrade--back-up-your-data)
   (a `pg_dump` and a copy of uploads) and snapshots every table.
3. **Upgrades** by starting the candidate on the same database, uploads,
   backups and `.env` values, and checks that:
   - every migration added since the baseline applied. The list comes from Git
     and must match both images, so a release needs no edit;
   - the private `pre-migration-schema_*` and `pre-migration-secrets_*` snapshots
     exist and hold the pre-conversion credentials;
   - all four secrets converted to v2 and still decrypt;
   - the startup sweep keeps old referenced uploads and removes the stale one;
   - every existing row and column is unchanged except the declared rewrites
     below. Vote counts, potluck quantities, display settings and event URLs are
     also compared directly;
   - sign-in by link and by code, public and password-protected RSVPs with
     contact verification, editing with a pre-upgrade edit token, same-name
     votes, invitations and event-update notifications work by email and SMS.
4. **Rehearses the rollback** on separate copies of the upgraded data, which
   include responses received after the upgrade. Each path starts the baseline
   image again and repeats its health, saved-credential sign-in (email and SMS),
   image, event URL, protected RSVP, vote and potluck checks:

   | Path | Steps                                                                             | Gate        |
   | ---- | --------------------------------------------------------------------------------- | ----------- |
   | R1   | Old image only                                                                    | Report only |
   | R2   | `npm run db:secrets -- --rollback` with the new image, then the old image         | Report only |
   | R3a  | Restore the operator `pg_dump` and uploads copy into a new database               | Blocking    |
   | R3b  | Restore the candidate's first `pre-migration-schema_*` snapshot; keep the uploads | Blocking    |

   R3a and R3b also require the restored database to equal the pre-upgrade
   snapshot exactly, including migration history.

Everything runs on an internal Docker network with no published ports and no
registry login. Mail and SMS go to a capture service on that network. It
accepts only the disposable test accounts in
`scripts/upgrade-rehearsal/accounts.cjs` and answers as `api.twilio.com` with a
certificate authority generated for that run. No real provider is reachable.

**Declaring an intentional data change.** A migration that rewrites existing
data must add an entry to `scripts/upgrade-rehearsal/expected-rewrites.json`
with its `migration`, `table`, `column`, `change` (`rewrite`, `extend-json`,
`delete-row`, `drop-column` or `drop-table`), an optional `rows` filter on the
old values and a `reason`. Entries apply only when their migration is part of
the rehearsed upgrade. Additions (tables, columns, rows) never need an entry.

**Baseline scenarios.** `scripts/upgrade-rehearsal/scenarios/vX.Y.Z.cjs`
seeds and checks baselines from that release until a newer scenario exists
(`v1.5.0.cjs` covers `v1.5.0`, and `v2.0.0.cjs` covers `v2.0.0+` with existing
v2 credentials and public RSVP contact verification).
Add one when a release changes an action signature the scenario calls. The
post-upgrade checks in `candidate.cjs` follow the current code.

Run it locally on a Docker-enabled machine with Node 22 and `openssl`:

```bash
# Previous release → this working tree (builds it).
bash scripts/upgrade-rehearsal.sh
# A chosen release → an already-built image.
bash scripts/upgrade-rehearsal.sh --from v1.5.0 --to-image rsvp-container-qc:local
# Any commit that contains the rehearsal, e.g. main. It runs that commit's copy.
bash scripts/upgrade-rehearsal.sh --to-ref main
# Build the baseline from a commit instead of a release image.
bash scripts/upgrade-rehearsal.sh --from-ref <commit> --to-ref <commit>
# Show the resolved baseline, scenario and migrations only.
bash scripts/upgrade-rehearsal.sh --plan-only
```

**What it showed for v1.5.0 → v2.0.0.** R1 starts and reports healthy, but
v1.5.0 cannot read the converted credentials: sign-in by email and SMS fails.
In both R1 and R2, one same-name guest retracting a post-upgrade vote also
removes the other guest's vote, because v1.5.0 matches votes by display name.
R3a and R3b pass with no `db:secrets --rollback`, because both backups predate
the conversion. Both lose responses received after the upgrade. Restoring the
uploads copy was not needed for v1.5.0 to serve its images, because the sweep
keeps referenced files. The supported procedure is
[Rolling back v2.0.0 to v1.5.0](#rolling-back-v200-to-v150).

---

## Before You Upgrade — Back Up Your Data

Always perform a backup before upgrading, and record the running image digest
([Checking the Current Version](#checking-the-current-version)).

> **Also back up your `.env` file.** Your secrets (`SESSION_SECRET`, `ENCRYPTION_KEY`, provider credentials) live only in `.env`. If you ever need to roll back or rebuild, you'll need the original values — losing `ENCRYPTION_KEY` in particular means stored credentials can no longer be decrypted. Copy it somewhere safe: `cp .env ./env-backup-$(date +%Y%m%d)`.

### Method 1: pg_dump via the Postgres Container (recommended)

Use `pg_dump` to create a consistent SQL snapshot while the application is running:

```bash
mkdir -p ./data/backups
docker compose -f docker-compose.release.yml exec -T postgres pg_dump -U postgres rsvp_db > ./data/backups/pre-upgrade-$(date +%Y%m%d-%H%M%S).sql
```

Also back up your uploaded images:

```bash
cp -r ./data/uploads ./uploads-backup-$(date +%Y%m%d-%H%M%S)
```

### Method 2: Built-in Admin Backup Panel

Navigate to `/admin` → **Backups** and click **Back Up Now** to create a `pg_dump` snapshot via the Admin UI.

### Where to Store Backups

- On a separate machine, drive, or local NAS.
- Encrypted cloud storage (e.g. Google Drive, Dropbox, Backblaze B2).
- SQL dump files compress well with gzip: `gzip ./data/backups/pre-upgrade-*.sql`.

---

## Checking the Current Version

To see which image version your system is currently running:

```bash
docker compose -f docker-compose.release.yml images
```

To inspect the specific container:

```bash
image_id=$(docker inspect --format '{{.Image}}' "$(docker compose -f docker-compose.release.yml ps -q app)")
docker image inspect --format '{{json .RepoDigests}}' "$image_id"
```

---

## Performing the Upgrade

### Step 1: Read the Release Notes

Check the [Releases Page](https://github.com/joe-cole1/rsvp-to-me/releases) for breaking changes, required `.env` variables, or custom instructions.
For v2.1.0 from v2.0.0, there are no breaking configuration changes; if upgrading from v1.5.0, work through the [v2.0.0 breaking-change checklist](#breaking-change-checklist) first.

> **Upgrading from a version with default database passwords:** the compose files no longer ship fallback passwords for `POSTGRES_PASSWORD` / `REDIS_PASSWORD` — both must now be set in `.env` or the stack refuses to start. If your existing installation ever ran **without** these variables set, PostgreSQL initialized its data volume with the old built-in default (`postgres_password_here`). Set `POSTGRES_PASSWORD` to that existing value first so the app can still connect, then rotate it to a strong password with: `docker compose -f docker-compose.release.yml exec postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'new-strong-password';"` and update `.env` to match before restarting. Redis reads its password from the compose command on every start, so `REDIS_PASSWORD` can simply be set to a new strong value. The old compose files also published PostgreSQL on host port `5432`; that mapping has been removed, so external tools must now go through `docker compose -f docker-compose.release.yml exec postgres ...` instead of connecting to `localhost:5432` — or use a loopback-only override / shared Docker network as described in the [Installation Guide's "Connecting Database Tools" section](./installation.md#connecting-database-tools).

### Step 2: Back Up the Database

Follow [Method 1](#method-1-pg_dump-via-the-postgres-container-recommended) and also save uploads and `.env`. Record the current image digest before pulling.

### Step 3: Pull the New Image

For v2.1.0, edit only the app image in the Compose file used by your deployment:

```yaml
services:
  app:
    image: ghcr.io/joe-cole1/rsvp-to-me:2.1.0
```

Wait for the published release's image build to succeed, then pull only the app.
Do not combine this rollout with PostgreSQL or Redis upgrades:

```bash
docker compose -f docker-compose.release.yml pull app
```

_Note:_ This downloads the image layers in the background without affecting your active site.

### Step 4: Re-Launch the App

Recreate only the app container, leaving database and cache services running:

```bash
docker compose -f docker-compose.release.yml up -d --no-deps app
docker compose -f docker-compose.release.yml logs --tail=100 app
```

The app will briefly be unavailable while startup checks, migrations, and
seeding finish. Upgrading from v2.0.0 to v2.1.0 applies three additive
migrations and verifies saved v2 credentials (`0 converted, ... verified; v2
ready.`); upgrading directly from v1.5.0 applies all fifteen migrations and
converts saved credentials. See [What runs at startup](#what-runs-at-startup).
Measure readiness with the health check instead of assuming a fixed downtime.

The image automatically repairs ownership in the mapped `./data/uploads` and
`./data/backups` directories when it starts, including files written by older
root-running releases. It never traverses arbitrary siblings under `/app/data`.
The entrypoint then drops permanently to UID/GID `10001:10001` before
migrations, backups, seeding, or the web server run. No host-side `chown` step is
required during an upgrade.

The image also includes the exact patched Sharp/libvips runtime used to produce
responsive cover and avatar variants. Source installations must use `npm ci`
from the checked-in lockfile; do not remove the Sharp override or independently
downgrade it, because Next.js and development tools may otherwise resolve the
vulnerable 0.34.x line.

---

## Database Migrations

RSVP to Me handles database migrations automatically when the container starts. On boot, the `app` container runs a migration script (`scripts/migrate-db.js`) that first takes an automatic pre-migration database snapshot, then applies any new schema updates with `prisma migrate deploy`. If a migration step errors transiently, the script retries a few times with a short backoff before giving up, and surfaces an actionable hint (e.g. a `prisma migrate resolve` command) in the logs for a stuck migration.

### Guest RSVP Display Preferences (#667)

The upgrade containing this feature adds six event presentation fields through
the `20260927044500_guest_rsvp_display` migration. It preserves expanded lists and
exact counts for existing events. Events created after the migration default to
a collapsed Can't make it list with no guest-facing count; Going and Maybe remain
expanded with exact counts.

Hosts configure these per-event preferences under **Settings → Display Options →
Guest-facing RSVP display**. Event visibility appears first on that page, and
Guest list visibility sits directly above the response display controls with a
matching section heading. Hosts and co-hosts always retain complete lists and
exact counts. RSVP records, capacity, notifications, and exports are unaffected.
The existing guest-list visibility controls continue to enforce access; the new
preferences only change presentation. No environment variable is required.

### User Language Preference (#732)

The `20261019000000_user_preferred_locale` migration adds a nullable
`User.preferredLocale` column with no default or backfill. Existing users keep
their browser choice, or English, until they pick a language. Default system
emails and text messages then use each recipient's saved language; unknown
recipients receive English. No environment variable is required.

### If a Migration Fails

If a migration fails on startup:

1. Stop app writes without removing the containers:
   ```bash
   docker compose -f docker-compose.release.yml stop app
   ```
2. Check the startup logs:
   ```bash
   docker compose -f docker-compose.release.yml logs app
   ```
3. Look for errors containing `migrate deploy` or database locking.
4. **Do not repeatedly restart the container.** If a migration failed halfway through, continuous restarts may corrupt the database structure.
5. Preserve the logs and backups, review [Rolling Back](#rolling-back), and open an issue on the project's GitHub before attempting database recovery.

---

## Verifying the Upgrade

Verify that the upgrade went smoothly:

```bash
# Check app, PostgreSQL, and Redis container status
docker compose -f docker-compose.release.yml ps

# Check logs for errors
docker compose -f docker-compose.release.yml logs app | tail -50

# Query the health endpoint
curl http://localhost:3000/api/health
```

_Expected Health Response:_ `{"status":"ok"}`

> To confirm the database migrations applied cleanly, query the health endpoint with your `HEALTH_CHECK_TOKEN` (optional `.env` variable — see the [Configuration Reference](./configuration.md#health_check_token)): `curl -H "x-health-token: <your token>" http://localhost:3000/api/health` should include `"migrations":"ok"`. Without the token the endpoint returns only the minimal status above.

Go to your event page and test functionality:

- Log in and verify that your dashboard loads.
- Open an event in an incognito window and test submitting an RSVP.
- Go to `/admin` > **System Configuration** and click **Send Test Email** to verify mail delivery.

---

## Rolling Back

If you experience issues, you can roll back your application to the previous working version.

### Rolling back v2.1.0 to v2.0.0

- **Image-only rollback (when no `PHONE`, `ADDRESS`, or `TERMS` questionnaire
  fields exist):** if no event created one of the new `RSVPFieldType` enum
  values on v2.1.0, v2.0.0 starts on the migrated database and ignores the new
  columns and tables (`rsvpEnabled`, `requireRsvp`, `goingOnly`, `description`,
  `voterTokenHash`, and standalone questionnaire tables). While rolled back,
  info-only events display RSVPs again and polls require an RSVP; they return
  when you upgrade back to v2.1.0. Pin the recorded v2.0.0 image digest (or
  `ghcr.io/joe-cole1/rsvp-to-me:2.0.0`), pull `app`, recreate `app` with
  `docker compose -f docker-compose.release.yml up -d --no-deps app`, and
  repeat [Verifying the Upgrade](#verifying-the-upgrade). Do not restore an old
  database for a routine image rollback.
- **Full database restore (when `PHONE`, `ADDRESS`, or `TERMS` fields exist,
  or for an exact restore):** v2.0.0 cannot read the new `PHONE`, `ADDRESS`, or
  `TERMS` enum values in `RSVPField`. Either remove or convert those fields on
  v2.1.0 first, or stop `app`, move the upgraded `rsvp_db` aside, and restore
  your pre-upgrade `pg_dump` (or v2.1.0's `pre-migration-schema_*.sql`
  snapshot) into a fresh database with `psql -v ON_ERROR_STOP=1` using the same
  restore commands shown below for v2.0.0 → v1.5.0, then start the v2.0.0
  image with the same `.env` (which loses data received after the upgrade).

### Rolling back v2.0.0 to v1.5.0

The only supported way back from v2.0.0 is to restore the database backup taken
before the upgrade and start the v1.5.0 image with the same `.env`. The
[upgrade rehearsal](#upgrade-rehearsal-918) checks this path before every
release. **Everything received after the upgrade is lost**: RSVPs, votes,
comments, accounts and settings changes.

**Before upgrading**, as described in [Before You Upgrade](#before-you-upgrade--back-up-your-data):

1. Record the running image digest ([Checking the Current Version](#checking-the-current-version)).
2. `pg_dump` the database.
3. Copy `data/uploads`.
4. Keep `.env` unchanged, with the same `SESSION_SECRET` and `ENCRYPTION_KEY`.

**To roll back:**

1. Stop the app, leaving PostgreSQL running:

   ```bash
   docker compose -f docker-compose.release.yml stop app
   ```

2. Choose the backup to restore. Either one restores exactly the pre-upgrade
   data, including migration history:
   - your operator dump, for example `./data/backups/pre-upgrade-YYYYMMDD-HHMMSS.sql`; or
   - the **first** `./data/backups/pre-migration/pre-migration-schema_*.sql`
     file, which v2.0.0 wrote when it first started. (v1.5.0's own startup
     snapshots are named `pre-migration_*.sql`.)

3. Move the upgraded database aside and restore into a fresh `rsvp_db`. Keeping
   the renamed copy lets you recover data received after the upgrade by hand
   later; drop it once you no longer need it.

   ```bash
   docker compose -f docker-compose.release.yml exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 -d postgres -c 'ALTER DATABASE rsvp_db RENAME TO rsvp_db_v2'
   docker compose -f docker-compose.release.yml exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 -d postgres -c 'CREATE DATABASE rsvp_db'
   docker compose -f docker-compose.release.yml exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 -d rsvp_db < ./data/backups/pre-upgrade-YYYYMMDD-HHMMSS.sql
   ```

   `ON_ERROR_STOP` makes the restore stop at the first error instead of leaving
   a partly restored database. If it stops, fix the cause, drop the new
   `rsvp_db` (not `rsvp_db_v2`), create it again and repeat the restore.

4. Pin the v1.5.0 image by the digest you recorded (or use the `1.5.0` tag),
   keep `.env` unchanged, and recreate only the app:

   ```yaml
   services:
     app:
       image: ghcr.io/joe-cole1/rsvp-to-me@sha256:<recorded digest>
   ```

   ```bash
   docker compose -f docker-compose.release.yml pull app
   docker compose -f docker-compose.release.yml up -d --no-deps app
   ```

   Then repeat the [health and core-flow checks](#verifying-the-upgrade),
   including email and SMS sign-in. Do **not** run
   `npm run db:secrets -- --rollback`: both backups predate the credential
   conversion, so v1.5.0 reads the saved credentials as they are.

5. Uploads: the rehearsal did not need the uploads copy, because the v2 cleanup
   keeps every referenced image and removes only unreferenced uploads older than
   24 hours. v2 does delete a cover or avatar once it is replaced or removed and
   nothing else uses it, so if hosts changed images after the upgrade, copy the
   backup back without overwriting newer files:
   `cp -rn ./uploads-backup-YYYYMMDD-HHMMSS/. ./data/uploads/`.

**Not safe:**

- **Old image only.** v1.5.0 starts and reports healthy, but email and SMS
  sign-in fail because it cannot read the converted credentials. It also matches
  poll votes by display name, so when one of two guests with the same name
  retracts a vote cast after the upgrade, both votes are deleted.
- **`npm run db:secrets -- --rollback`, then the old image.** Saved credentials
  work again, but the same-name vote deletion remains.

Not rehearsed: v1.5.0 also ignores the new notification preferences; see
[Recipient notification preferences](#recipient-notification-preferences-01a1a105).

### Rolling back v1.5.0 to v1.4.1: change only the app image

v1.5.0's two migrations only add nullable or defaulted columns. v1.4.1 keeps
working with them, and its startup reports no pending migrations, so a routine
rollback does not restore the database. While rolled back, saved language
preferences and guest display settings are ignored and the UI is English; they
return when you upgrade again. Restore the previously recorded image digest
(preferred) in the existing Compose file, or use this version tag:

```yaml
services:
  app:
    image: ghcr.io/joe-cole1/rsvp-to-me:1.4.1
```

Then recreate only the app and repeat the health and core-flow checks:

```bash
docker compose -f docker-compose.release.yml pull app
docker compose -f docker-compose.release.yml up -d --no-deps app
```

Do not restore an old database for a routine image rollback: that would discard
RSVPs and other changes received after the backup. Keep the same `.env`, secrets,
uploads, and database mounts.

### Database recovery after a migration or data loss

For releases that change the schema, review that release's recovery instructions
before downgrading the image. Stop app writes and take a current backup first.
Verify the chosen backup in a **separate disposable database** before replacing
production data. A full restore replaces current data with the snapshot and can
lose new RSVPs; schedule and approve that recovery explicitly. Never drop a live
database while the app is connected.

---

## Setting Up Automatic Backups

### Option A: Built-in Admin Backup Scheduler

Navigate to `/admin` → **Backups** and configure a cron schedule (e.g. `0 3 * * *` for daily at 3 AM). The application runs `pg_dump` on schedule and stores the results in `./data/backups/`. Rotation and download are also managed from this panel.

---

### Option B: Host-Level Cron Script (Linux/Mac)

For an extra layer of offsite protection, you can run a host cron job alongside the built-in scheduler.

1. Create a script file `/home/user/backup-rsvp.sh`:

   ```bash
   #!/bin/bash
   BACKUP_DIR="/home/user/rsvp-backups"
   DATE=$(date +%Y%m%d-%H%M%S)
   mkdir -p "$BACKUP_DIR"

   docker compose -f /path/to/rsvp-to-me/docker-compose.release.yml exec -T postgres \
     pg_dump -U postgres rsvp_db > "$BACKUP_DIR/rsvp-$DATE.sql"

   # Keep only the last 30 backups
   ls -t "$BACKUP_DIR"/*.sql | tail -n +31 | xargs rm -f
   ```

2. Make the script executable:
   ```bash
   chmod +x /home/user/backup-rsvp.sh
   ```
3. Add the script to your cron table:
   ```bash
   crontab -e
   ```
   Add this line to run the backup daily at 3:00 AM:
   ```
   0 3 * * * /home/user/backup-rsvp.sh >> /home/user/rsvp-backup.log 2>&1
   ```

---

## Node.js Runtime Version

The Node.js runtime is bundled inside the pre-built Docker image, so **self-hosters running via Docker do not need to install or manage Node directly** — a `docker compose -f docker-compose.release.yml pull` always brings the correct runtime.

The bundled runtime is **Node.js 22**. For source installations, use Node
**22.23.1 or newer within 22.x** and npm **10.9.0 or newer within 10.x**, matching
`package.json`.
The repository's `.nvmrc` selects Node 22.23.1.

The final September dependency batch aligns `@types/node` with Node 22 using
version 22.20.4 and its `undici-types` 6.21.0 dependency. These packages supply
TypeScript declarations; the Node executable, HTTP runtime dependencies, and
application behavior are unchanged. Run `npm ci` after pulling this batch and
verify application/test/worker type checks, CI, and both container architectures.
Future major Node typing updates are coordinated with the runtime instead of
being proposed independently by Dependabot.

---

## Upgrading the PostgreSQL Major Version

RSVP to Me uses PostgreSQL 18. When a new major PostgreSQL version is released and you want to upgrade, use the dump-and-restore method (not `pg_upgrade`, which requires native binary installations).

**This procedure requires a brief maintenance window.**

1. **Back up your data** (follow Method 1 above).

2. **Stop the application:**

   ```bash
   docker compose -f docker-compose.release.yml down
   ```

3. **Update the Postgres image tag** in `docker-compose.release.yml`:

   ```yaml
   postgres:
     image: postgres:19-alpine # bump to the new major version
   ```

   > **Note:** The volume mount uses `./pg_data:/var/lib/postgresql` (not `/var/lib/postgresql/data`). This is intentional for Postgres 18+: Postgres creates a `data/` subdirectory within the mount automatically, which enables link-mode upgrades without crossing filesystem mount boundaries.

4. **Delete the old data directory** (incompatible between major versions):

   ```bash
   rm -rf ./pg_data
   ```

5. **Start only the new Postgres container** and wait for it to initialize:

   ```bash
   docker compose -f docker-compose.release.yml up -d postgres
   docker compose -f docker-compose.release.yml logs -f postgres   # wait until "database system is ready"
   ```

6. **Restore your backup:**

   ```bash
   docker compose -f docker-compose.release.yml exec -T postgres psql -U postgres -d rsvp_db < ./data/backups/pre-upgrade-YYYYMMDD.sql
   ```

7. **Start all services:**

   ```bash
   docker compose -f docker-compose.release.yml up -d
   docker compose -f docker-compose.release.yml logs -f app
   ```

8. **Verify** by navigating to your app URL and running a quick sanity check on the dashboard and a public event page.
