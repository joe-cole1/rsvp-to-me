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

prepare_data_directory() {
  mkdir -p "$data_dir/uploads" "$data_dir/backups/pre-migration"

  # Do not follow symlinks or cross into nested mounts while running as root.
  # The ownership filter makes repeat starts inexpensive for correctly owned
  # installations while automatically repairing data from older root images.
  if ! find "$data_dir" -xdev \( ! -user "$app_user" -o ! -group "$app_group" \) \
    -exec chown -h "$app_user:$app_group" '{}' +; then
    echo >&2 "[entrypoint] Could not normalize all ownership under $data_dir."
  fi

  if ! su-exec "$app_user:$app_group" sh -c \
    'test -w "$1" && test -w "$1/uploads" && test -w "$1/backups/pre-migration"' \
    sh "$data_dir"; then
    echo >&2 "[entrypoint] $data_dir is not writable by UID/GID 10001:10001."
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
