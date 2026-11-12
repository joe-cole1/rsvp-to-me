# shellcheck shell=bash
#
# net_retry <command...>
#
# Runs a command and retries it only when it fails with a transient network
# error, such as the intermittent WSL DNS failures (EAI_AGAIN) seen against
# registry.npmjs.org and github.com. Any other failure (a vulnerable package, a
# rejected push, a missing PR) returns immediately with its own status.
#
# Attempts: NET_RETRY_ATTEMPTS (default 3), NET_RETRY_DELAY seconds apart
# (default 5). Each attempt's stdout and stderr are replayed when it finishes,
# so callers can still capture stdout with $(...).

NET_RETRY_PATTERN='EAI_AGAIN|ENOTFOUND|ETIMEDOUT|ECONNRESET|ENETUNREACH|EHOSTUNREACH|socket hang up|Could not resolve host|Temporary failure in name resolution|error connecting to|i/o timeout|TLS handshake timeout|Connection timed out|Connection reset by peer'

net_retry() {
  local attempt=1 max="${NET_RETRY_ATTEMPTS:-3}" delay="${NET_RETRY_DELAY:-5}" out err status
  out="$(mktemp)"
  err="$(mktemp)"
  while :; do
    status=0
    "$@" >"$out" 2>"$err" || status=$?
    cat "$out"
    cat "$err" >&2
    if [ "$status" -eq 0 ] || [ "$attempt" -ge "$max" ] ||
      ! grep -qE "$NET_RETRY_PATTERN" "$out" "$err"; then
      rm -f "$out" "$err"
      return "$status"
    fi
    printf '⚠ Network error (attempt %s of %s); retrying in %ss: %s\n' \
      "$attempt" "$max" "$delay" "$*" >&2
    attempt=$((attempt + 1))
    sleep "$delay"
  done
}
