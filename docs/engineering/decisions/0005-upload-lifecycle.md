# 0005: Upload accounting and file lifecycle

Status: Accepted

Related issue: #850. Task: `01a1df16`.

## Decision

`lib/uploads.ts` owns file creation, accounting and reclamation. New uploads
record their uploader, byte length and creation time in `Upload`. Each account,
including administrators, has a fixed 100 MiB quota across its tracked files;
the existing 8 MiB per-file limit remains. PostgreSQL serializes quota checks
and writes, so concurrent uploads cannot overspend the remaining space.

Image assignment and reclamation acquire the same transaction advisory lock.
Assignment verifies a regular file exists. Reclamation checks all current event
cover and profile avatar references while holding the lock, then unlinks only
an application-generated filename. Symlinks and unrelated files are ignored.
Reference changes commit before a former image is released. An unlink failure
does not undo a successful edit: it is logged without private error details,
and scheduled reclamation retries unreferenced files after 24 hours.

Uploads that never get attached are retained for 24 hours, then become eligible
for daily cleanup. Existing files are not assigned inferred owners and do not
count toward the new per-account quota. They are eligible for the same
reference-aware cleanup. A referenced image is retained regardless of its age
or whether its uploader still exists. Account anonymization deletes unreferenced
uploads and drops ownership of retained images, preserving covers of events
reassigned to the system account.

## Consequences

File storage is not transactional with PostgreSQL. A failed upload transaction
attempts to unlink its new file before returning an error. A crash can leave a
file or accounting row behind; daily cleanup recovers unreferenced files and
missing-file rows. A shared file keeps counting against its uploader's quota
until its last reference is removed or that account is anonymized.

All application processes must share the same uploads mount. Quota enforcement
requires PostgreSQL; it does not fall back to an unlocked filesystem check.
Database backups still need matching upload backups: images removed after their
last reference disappears are no longer available for an older database restore.
