#!/usr/bin/env bash

# Process-group helpers for scripts/preflight.sh. The E2E app must run in an
# isolated group so cleanup can stop npm and every descendant without touching
# the caller's shell, the PM2 development server, or any unrelated process.

preflight_capture_process_group() {
  local pid="$1"
  local pgid=""
  local caller_pgid

  [[ "$pid" =~ ^[0-9]+$ ]] || {
    echo "✗ Invalid E2E server PID: $pid" >&2
    return 1
  }

  # `setsid` may not have completed between `$!` and this function. Give it a
  # brief window to establish the new session before validating ownership.
  for _ in $(seq 1 50); do
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d '[:space:]')"
    [ "$pgid" = "$pid" ] && break
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.02
  done

  if [ "$pgid" != "$pid" ]; then
    echo "✗ E2E server did not enter its expected process group (pid=$pid, pgid=${pgid:-missing})." >&2
    return 1
  fi

  caller_pgid="$(ps -o pgid= -p "$$" | tr -d '[:space:]')"
  if [ -z "$caller_pgid" ] || [ "$pgid" = "$caller_pgid" ]; then
    echo "✗ Refusing to register the caller's process group for E2E cleanup." >&2
    return 1
  fi

  printf '%s\n' "$pgid"
}

preflight_process_group_alive() {
  local pgid="$1"

  # Ignore zombies: they have already terminated and only await reaping.
  ps -eo pgid=,stat= | awk -v pgid="$pgid" '$1 == pgid && $2 !~ /^Z/ { found = 1 } END { exit !found }'
}

preflight_pid_alive() {
  local pid="$1"
  local state

  state="$(ps -o stat= -p "$pid" 2>/dev/null | tr -d '[:space:]')"
  [ -n "$state" ] && [[ "$state" != Z* ]]
}

preflight_terminate_process_group() {
  local pid="$1"
  local pgid="$2"
  local caller_pgid

  [[ "$pid" =~ ^[0-9]+$ && "$pgid" =~ ^[0-9]+$ && "$pid" = "$pgid" && "$pgid" -gt 1 ]] || {
    echo "✗ Refusing unsafe E2E process-group cleanup (pid=$pid, pgid=$pgid)." >&2
    return 1
  }

  caller_pgid="$(ps -o pgid= -p "$$" | tr -d '[:space:]')"
  if [ -z "$caller_pgid" ] || [ "$pgid" = "$caller_pgid" ]; then
    echo "✗ Refusing to terminate the caller's process group." >&2
    return 1
  fi

  if preflight_process_group_alive "$pgid"; then
    kill -TERM -- "-$pgid" 2>/dev/null || true

    for _ in $(seq 1 50); do
      preflight_process_group_alive "$pgid" || break
      sleep 0.1
    done

    if preflight_process_group_alive "$pgid"; then
      echo "! E2E server group $pgid did not stop after SIGTERM; sending SIGKILL." >&2
      kill -KILL -- "-$pgid" 2>/dev/null || true

      for _ in $(seq 1 20); do
        preflight_process_group_alive "$pgid" || break
        sleep 0.05
      done
    fi
  elif preflight_pid_alive "$pid"; then
    # A signal can arrive in the few milliseconds before `setsid` establishes
    # the expected group. In that case only the exact child PID is safe to
    # target, and it cannot have spawned the E2E descendant yet.
    kill -TERM "$pid" 2>/dev/null || true
    for _ in $(seq 1 20); do
      preflight_pid_alive "$pid" || break
      sleep 0.05
    done
    preflight_pid_alive "$pid" && kill -KILL "$pid" 2>/dev/null || true
  fi

  # Reap the group leader when it is still a child of this shell. Its status is
  # intentionally ignored so cleanup cannot replace the preflight exit status.
  wait "$pid" 2>/dev/null || true

  if preflight_process_group_alive "$pgid"; then
    echo "✗ E2E server group $pgid survived SIGKILL." >&2
    return 1
  fi
}

preflight_assert_port_available() {
  local port="$1"

  node - "$port" <<'NODE'
const net = require("node:net");
const port = Number(process.argv[2]);

function probe(host) {
  const server = net.createServer();

  server.once("error", (error) => {
    if (error.code === "EAFNOSUPPORT" && host === "::") {
      probe("0.0.0.0");
      return;
    }

    if (error.code === "EADDRINUSE") {
      console.error(
        `✗ E2E port ${port} is already occupied; refusing to use a stale or unrelated server.`
      );
    } else {
      console.error(`✗ Unable to verify E2E port ${port}: ${error.message}`);
    }
    process.exitCode = 1;
  });

  server.listen({ port, host, ipv6Only: false, exclusive: true }, () => server.close());
}

probe("::");
NODE
}
