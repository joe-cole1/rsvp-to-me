# 0002: Configuration secret encryption and migration

Status: Accepted

Related issues: #328 (SEC-8 / M-5a), #339 (SEC-44)

## Context

Configuration credentials used AES-256-GCM with random IVs but a fixed scrypt
salt. The reader also accepted plaintext and some malformed encrypted values.
Removing compatibility without converting existing settings would break email,
SMS, and inbound Twilio signature verification on existing installations.

## Decision

Write `v2:salt:iv:tag:ciphertext` with independent 16-byte salts, 12-byte IVs,
and authenticated format context. Keep the existing ENCRYPTION_KEY selection
and SESSION_SECRET fallback. Normal application reads accept only authenticated
v2 values; legacy handling lives exclusively in the migration module.

Before serving requests, migrate the four known secret SystemConfig settings.
Serialize migration and administrator writes with a transaction-level table
lock. Validate all inputs, require a successful pre-conversion pg_dump when
values change, update credentials, and write the completion marker in one
transaction. Completed installations reject subsequently introduced legacy
values. Blank settings and unrelated rows are unchanged; no schema migration
is needed. Check mode changes neither settings nor the marker.

Keep a deliberate rollback command that encrypts credentials in the old format
and removes the marker in one backed-up transaction. It never restores the
whole database. Operators stop every app instance before downgrade or an
upgrade across this format boundary.

## Consequences

The default container upgrade requires no manual migration command. Failures
block startup with redacted, actionable logs and roll back secret conversion;
already completed schema migrations are separate. Secrets and original key
material are never logged. Existing plaintext containing colons is ambiguous
and requires repair through the previous application before conversion.

Source/custom deployments must have pg_dump available if credentials need
conversion. Backup failure blocks secret conversion even though the existing
schema backup remains best-effort. A successful conversion can create an
additional startup backup. Old application versions cannot read v2 values;
run the selective rollback using the newer image before downgrading. Preserve
the original encryption key and protect backups, which can contain legacy
plaintext. This work does not provide key rotation or phone-number encryption.

## Backup retention follow-up (#851)

Publish completed dumps atomically from private partial files. Startup keeps
seven schema snapshots and seven recovery snapshots independently. Conversion
and selective rollback write recovery snapshots; pre-existing unclassified dumps
belong to that pool. Only a successful replacement permits rotation. Routine
schema backups never displace conversion recovery points. Operators must copy
long-term recovery points to protected storage before their pool rotates them.
Admin lists expose metadata only; sensitive snapshot download/deletion stays a
server operation. Failed secret backups still block conversion before writes.
