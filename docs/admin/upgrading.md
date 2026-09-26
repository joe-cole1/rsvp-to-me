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
2. [Before You Upgrade — Back Up Your Data](#before-you-upgrade--back-up-your-data)
3. [Checking the Current Version](#checking-the-current-version)
4. [Performing the Upgrade](#performing-the-upgrade)
5. [Database Migrations](#database-migrations)
6. [Verifying the Upgrade](#verifying-the-upgrade)
7. [Rolling Back](#rolling-back)
8. [Setting Up Automatic Backups](#setting-up-automatic-backups)

---

## How Updates Work

RSVP to Me is distributed as a pre-built Docker image. When a new version is released:

- A new Docker image is pushed to our container registry.
- Stable releases receive an exact version tag, a minor-version alias, and `latest`.
- Prereleases receive only the exact version tag and do not move stable aliases.
- Database migrations (if any) are applied automatically when the new container starts.

The production `docker-compose.release.yml` uses `latest` by default. For a
controlled rollout, pin its app image to a version or digest before pulling.
Container tags omit the leading `v`: Git release `v1.4.1` publishes image `1.4.1`.

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

## v1.4.1 maintenance release

This batch updates Next.js and its ESLint configuration to 16.3.6, Sharp to
0.35.4 in both the application and the optional email worker, Nodemailer to
9.1.1, and html-to-text to 10.0.1. It also refreshes vulnerable transitive
packages. It adds no database migrations or environment variables.

Keep the existing compatibility overrides. Prisma is now on 7.10.0; temporary
scoped overrides select deepmerge-ts 8.0.1 for `@prisma/config` and mysql2
3.24.4 for the Prisma CLI. Check Prisma config loading, client generation, and
migrations before removing those overrides. Issue #603 tracks the remaining
Prisma deepmerge dependency; #546 tracks the legacy brace-expansion adapter.
Do not use `npm audit fix --force` to resolve this backlog: its proposed
Prisma 6 downgrade changes the application's supported major version.

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
| `v1.4.1`       | Off                 | `1.4.1`, `1.4`, `latest` |
| `v1.4.1-rc.1`  | On or off           | `1.4.1-rc.1`             |
| `v1.4.1`       | On                  | `1.4.1` only             |

Prefer a suffixed candidate tag such as `v1.4.1-rc.1` so its exact image tag is
also separate from the final release. Stable publication still moves `latest`
even for an older stable version, so do not publish an old stable tag as a test.
The guard applies only to releases whose tagged commit includes it; rerunning
an older release does not adopt new workflow code.

Before the owner publishes `v1.4.1`:

- [ ] Merge the release-preparation PR and record the resulting `main` SHA.
- [ ] Require CI, CodeQL, and both native Container QC jobs to pass on that SHA.
- [ ] Review the prepared notes in `.github/release-notes/v1.4.1.md` and confirm
      the comparison with `v1.4.0` contains no new migration or required variable.
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
containers. It checks the normal migration and seed startup, the image's Docker
health check, detailed and anonymous health responses, homepage rendering,
UID/GID 10001 storage access, Redis connectivity, and Sharp JPEG/WebP/AVIF
conversions. After initial seeding, the app restarts to create a real startup
backup of the populated schema. That SQL dump is restored with stop-on-error
into a separate disposable database; the seeded invite and migration history
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

---

## Before You Upgrade — Back Up Your Data

Always perform a backup before upgrading.

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

> **Upgrading from a version with default database passwords:** the compose files no longer ship fallback passwords for `POSTGRES_PASSWORD` / `REDIS_PASSWORD` — both must now be set in `.env` or the stack refuses to start. If your existing installation ever ran **without** these variables set, PostgreSQL initialized its data volume with the old built-in default (`postgres_password_here`). Set `POSTGRES_PASSWORD` to that existing value first so the app can still connect, then rotate it to a strong password with: `docker compose -f docker-compose.release.yml exec postgres psql -U postgres -c "ALTER USER postgres WITH PASSWORD 'new-strong-password';"` and update `.env` to match before restarting. Redis reads its password from the compose command on every start, so `REDIS_PASSWORD` can simply be set to a new strong value. The old compose files also published PostgreSQL on host port `5432`; that mapping has been removed, so external tools must now go through `docker compose -f docker-compose.release.yml exec postgres ...` instead of connecting to `localhost:5432` — or use a loopback-only override / shared Docker network as described in the [Installation Guide's "Connecting Database Tools" section](./installation.md#connecting-database-tools).

### Step 2: Back Up the Database

Follow [Method 1](#method-1-pg_dump-via-the-postgres-container-recommended) and also save uploads and `.env`. Record the current image digest before pulling.

### Step 3: Pull the New Image

For v1.4.1, edit only the app image in the Compose file used by your deployment:

```yaml
services:
  app:
    image: ghcr.io/joe-cole1/rsvp-to-me:1.4.1
```

Wait for the published release's image build to succeed, then pull only the app.
Do not combine this maintenance rollout with PostgreSQL or Redis upgrades:

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
seeding finish. v1.4.1 adds no migrations; startup still checks migration state.
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

### Routine v1.4.1 rollback: change only the app image

v1.4.1 adds no schema changes relative to v1.4.0. Restore the previously recorded
image digest (preferred) in the existing Compose file, or use this version tag:

```yaml
services:
  app:
    image: ghcr.io/joe-cole1/rsvp-to-me:1.4.0
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
