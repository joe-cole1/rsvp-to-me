#!/bin/sh

# A bind mount replaces the image-owned /app/data directory. Start with the
# minimum root bootstrap needed to make that host directory writable, then
# permanently replace this process with the requested command as nextjs.
set -eu

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH

app_user=nextjs
app_group=nodejs
data_dir=/app/data
uploads_dir=$data_dir/uploads
backups_dir=$data_dir/backups

prepare_data_directory() {
  mkdir -p "$uploads_dir" "$backups_dir/pre-migration"

  # Only these application-owned paths may be repaired. Start each traversal at
  # its bind mount, do not follow symlinks, and do not cross nested mounts. In
  # particular, never traverse arbitrary siblings beneath /app/data: operators
  # may keep PostgreSQL, Redis, or other service data under the same host parent.
  for managed_dir in "$uploads_dir" "$backups_dir"; do
    if ! find "$managed_dir" -xdev \( ! -user "$app_user" -o ! -group "$app_group" \) \
      -exec chown -h "$app_user:$app_group" '{}' +; then
      echo >&2 "[entrypoint] Could not normalize ownership under $managed_dir."
      exit 1
    fi
  done

  if ! su-exec "$app_user:$app_group" sh -c \
    'test -w "$1" && test -w "$2/pre-migration"' sh "$uploads_dir" "$backups_dir"; then
    echo >&2 "[entrypoint] Upload and backup storage must be writable by UID/GID 10001:10001."
    echo >&2 "[entrypoint] Check the bind mount and host filesystem permissions."
    exit 1
  fi
}

if [ "$(id -u)" = "0" ]; then
  prepare_data_directory
  exec su-exec "$app_user:$app_group" "$@"
fi

# Preserve explicit Docker --user overrides without attempting privileged
# filesystem changes that the selected account cannot perform.
exec "$@"
