#!/usr/bin/env bash
# Rehearse a real upgrade from a released version to a candidate, then the
# rollback paths, using only disposable containers, volumes and test values.
#
# Usage: bash scripts/upgrade-rehearsal.sh [options]
#   --from auto|vX.Y.Z   Baseline release (default auto: the newest stable tag
#                        reachable from the candidate, excluding its own tags).
#   --from-ref <ref>     Build the baseline from any commit instead of a release
#                        image; its nearest release tag selects the scenario.
#   --from-image <img>   Use this baseline image (default: the release image).
#   --to-image <img>     Candidate image, already built (CI: rsvp-container-qc:local).
#   --to-ref <ref>       Build the candidate from any commit, e.g. main, and run
#                        that commit's own copy of this rehearsal.
#                        Without --to-image/--to-ref, the working tree is built.
#   --plan-only          Print the resolved plan and exit (no Docker).
#   --keep               Leave containers and volumes for inspection.
# See docs/admin/upgrading.md ("Upgrade rehearsal").
set -Eeuo pipefail

usage() { sed -n '2,19p' "$0" | sed 's/^# \{0,1\}//'; }

from=auto
from_ref=""
from_image=""
to_image=""
to_ref=""
plan_only=false
keep=false
original_args=("$@")
while [ $# -gt 0 ]; do
  case "$1" in
    --from) from=${2:?--from needs a value}; shift 2 ;;
    --from-ref) from_ref=${2:?--from-ref needs a value}; shift 2 ;;
    --from-image) from_image=${2:?--from-image needs a value}; shift 2 ;;
    --to-image) to_image=${2:?--to-image needs a value}; shift 2 ;;
    --to-ref) to_ref=${2:?--to-ref needs a value}; shift 2 ;;
    --plan-only) plan_only=true; shift ;;
    --keep) keep=true; shift ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done
if [ -n "$to_image" ] && [ -n "$to_ref" ]; then
  echo "Pass --to-image or --to-ref, not both." >&2
  exit 2
fi

repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
# An exported --to-ref tree has no .git; Git still runs in the original clone.
git_repo=${REHEARSAL_GIT_REPO:-$repo}
g() { git -C "$git_repo" "$@"; }

# Run the candidate's own copy of this rehearsal: its checks follow its code.
if [ -n "$to_ref" ] && [ -z "${REHEARSAL_EXPORTED_REF:-}" ]; then
  to_commit=$(g rev-parse --verify "$to_ref^{commit}")
  export_dir=$(mktemp -d "${TMPDIR:-/tmp}/rsvp-rehearsal-ref.XXXXXX")
  g archive "$to_commit" | tar -x -C "$export_dir"
  if [ ! -f "$export_dir/scripts/upgrade-rehearsal.sh" ]; then
    rm -rf "$export_dir"
    echo "$to_ref predates the upgrade rehearsal; it has no scripts/upgrade-rehearsal.sh." >&2
    exit 2
  fi
  status=0
  REHEARSAL_GIT_REPO=$git_repo REHEARSAL_EXPORTED_REF=$to_commit \
    bash "$export_dir/scripts/upgrade-rehearsal.sh" "${original_args[@]}" || status=$?
  rm -rf "$export_dir"
  exit "$status"
fi

harness=$repo/scripts/upgrade-rehearsal
migration_pattern='^[0-9]{14}_[A-Za-z0-9_]+$'

# The migrations directory a tree uses, from its prisma.config.ts.
migrations_path() {
  local config
  if [ "$1" = worktree ]; then
    config=$(cat "$repo/prisma.config.ts" 2>/dev/null || true)
  else
    config=$(g show "$1:prisma.config.ts" 2>/dev/null || true)
  fi
  local found
  found=$(printf '%s\n' "$config" | sed -nE 's/.*migrations:[[:space:]]*\{[[:space:]]*path:[[:space:]]*"([^"]+)".*/\1/p' | head -n 1)
  printf '%s\n' "${found:-prisma/migrations}"
}

list_migrations() {
  local path
  path=$(migrations_path "$1")
  if [ "$1" = worktree ]; then
    ls -1 "$repo/$path"
  else
    g ls-tree --name-only "$1:$path"
  fi | grep -E "$migration_pattern" | sort
}

# The app image repository released from a tree, from its production Compose file.
release_repository() {
  local compose
  if [ "$1" = worktree ]; then compose=$(cat "$repo/docker-compose.release.yml"); else compose=$(g show "$1:docker-compose.release.yml"); fi
  printf '%s\n' "$compose" | sed -nE 's#^[[:space:]]*image:[[:space:]]*(ghcr\.io/[^:[:space:]]+):.*#\1#p' | head -n 1
}

# Service images (postgres, redis) from the candidate's production Compose file.
compose_image() {
  sed -nE "s#^[[:space:]]*image:[[:space:]]*(${1}:[^[:space:]]+).*#\\1#p" "$repo/docker-compose.release.yml" | head -n 1
}

node_cli() {
  if command -v node >/dev/null 2>&1; then
    node "$harness/lib.cjs" "$@"
  else
    docker run --rm -i --network none -v "$harness:/rehearsal:ro" --entrypoint node "$to_image" /rehearsal/lib.cjs "$@"
  fi
}

# ---- Candidate ---------------------------------------------------------------
if [ -n "${REHEARSAL_EXPORTED_REF:-}" ]; then
  to_tree=$REHEARSAL_EXPORTED_REF
  to_commit=$REHEARSAL_EXPORTED_REF
  to_label="$to_ref ($to_commit)"
else
  to_tree=worktree
  to_commit=$(g rev-parse HEAD)
  to_label="working tree at $(g rev-parse --short HEAD)"
fi

if [ "$plan_only" = false ] && [ -z "$to_image" ]; then
  to_image="rsvp-upgrade-rehearsal:candidate-$(printf '%s' "$to_commit" | cut -c1-12)"
  echo "Building candidate image $to_image from $to_label..."
  docker build -q -t "$to_image" "$repo" >/dev/null
fi

# ---- Baseline ----------------------------------------------------------------
if [ -n "$from_ref" ]; then
  from_tree=$(g rev-parse --verify "$from_ref^{commit}")
  from_version=$(g describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' --exclude '*-*' "$from_tree" 2>/dev/null || true)
  [ -n "$from_version" ] || { echo "No release tag precedes $from_ref; cannot choose a scenario." >&2; exit 2; }
  from_label="$from_ref ($from_tree, scenario base $from_version)"
else
  if [ "$from" = auto ]; then
    set +e
    from=$(g tag --merged "$to_commit" | node_cli baseline $(g tag --points-at "$to_commit"))
    found=$?
    set -e
    [ "$found" -eq 0 ] || { echo "No earlier stable release tag is reachable from the candidate." >&2; exit 2; }
  fi
  g rev-parse -q --verify "refs/tags/$from" >/dev/null || { echo "Unknown release tag: $from (fetch tags first)." >&2; exit 2; }
  from_tree=$(g rev-parse "$from^{commit}")
  from_version=$from
  from_label=$from
fi

scenario_versions=$(cd "$harness/scenarios" && ls -1 v*.cjs | sed 's/\.cjs$//')
set +e
scenario=$(node_cli scenario "$from_version" $scenario_versions)
found=$?
set -e
[ "$found" -eq 0 ] || { echo "No rehearsal scenario supports $from_version (oldest: $(printf '%s\n' "$scenario_versions" | sort -V | head -n 1))." >&2; exit 2; }

baseline_migrations=$(list_migrations "$from_tree")
candidate_migrations=$(list_migrations "$to_tree")
expected=$(printf '%s\n---\n%s\n' "$baseline_migrations" "$candidate_migrations" | node_cli migrations)

if [ -z "$from_image" ] && [ -z "$from_ref" ]; then
  from_image="$(release_repository "$to_tree"):${from_version#v}"
fi

cat <<PLAN
Upgrade rehearsal plan
  baseline:   $from_label
  image:      ${from_image:-built from $from_ref}
  scenario:   scenarios/$scenario.cjs
  candidate:  $to_label
  image:      ${to_image:-(built at run time)}
  migrations: $(printf '%s\n' "$expected" | grep -c . || true) added since the baseline
$(printf '%s\n' "$expected" | sed 's/^/    /')
PLAN
if [ "$plan_only" = true ]; then exit 0; fi

# ---- Disposable resources ----------------------------------------------------
prefix="rsvp-rehearsal-$(date +%s)-$$"
network=""
containers=()
volumes=()
temp_dirs=()
report_done=false

cleanup() {
  local status=$?
  trap - EXIT
  if [ "$report_done" = false ] && [ -n "$network" ]; then
    print_report || true
  fi
  if [ "$keep" = true ]; then
    echo "Kept for inspection: network $network; containers ${containers[*]:-none}; volumes ${volumes[*]:-none}"
  else
    for id in "${containers[@]}"; do docker rm -fv "$id" >/dev/null 2>&1 || true; done
    for volume in "${volumes[@]}"; do docker volume rm "$volume" >/dev/null 2>&1 || true; done
    [ -z "$network" ] || docker network rm "$network" >/dev/null 2>&1 || true
  fi
  for dir in "${temp_dirs[@]}"; do rm -rf "$dir"; done
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Creates "$prefix-<name>" and registers it for cleanup (never in a subshell).
new_volume() {
  docker volume create "$prefix-$1" >/dev/null
  volumes+=("$prefix-$1")
}

if [ -n "$from_ref" ] && [ -z "$from_image" ]; then
  from_image="rsvp-upgrade-rehearsal:baseline-$(printf '%s' "$from_tree" | cut -c1-12)"
  baseline_dir=$(mktemp -d "${TMPDIR:-/tmp}/rsvp-rehearsal-baseline.XXXXXX")
  temp_dirs+=("$baseline_dir")
  g archive "$from_tree" | tar -x -C "$baseline_dir"
  echo "Building baseline image $from_image from $from_ref..."
  docker build -q -t "$from_image" "$baseline_dir" >/dev/null
fi
docker image inspect "$from_image" >/dev/null 2>&1 || docker pull -q "$from_image" >/dev/null
postgres_image=$(compose_image postgres)
redis_image=$(compose_image redis)

# An internal network: no container can reach a real provider or the internet.
docker network create --internal "$prefix" >/dev/null
network=$prefix
for name in work uploads backups operator-backup operator-uploads; do new_volume "$name"; done
work=$prefix-work
uploads=$prefix-uploads
backups=$prefix-backups
operator=$prefix-operator-backup
uploads_backup=$prefix-operator-uploads

tls=$(mktemp -d "${TMPDIR:-/tmp}/rsvp-rehearsal-tls.XXXXXX")
temp_dirs+=("$tls")
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=Upgrade rehearsal CA" \
  -keyout "$tls/ca.key" -out "$tls/ca.crt" 2>/dev/null
openssl req -newkey rsa:2048 -nodes -subj "/CN=api.twilio.com" \
  -keyout "$tls/server.key" -out "$tls/server.csr" 2>/dev/null
printf 'subjectAltName=DNS:api.twilio.com\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\n' > "$tls/ext.cnf"
openssl x509 -req -days 1 -in "$tls/server.csr" -CA "$tls/ca.crt" -CAkey "$tls/ca.key" \
  -CAcreateserial -extfile "$tls/ext.cnf" -out "$tls/server.crt" 2>/dev/null
rm -f "$tls/ca.key" "$tls/server.csr"
chmod 0755 "$tls" && chmod 0644 "$tls"/*

pg_password=rehearsal-postgres
database=rsvp_rehearsal
session_secret=upgrade-rehearsal-disposable-session-secret
health_token=rehearsal-health
bootstrap_user=bootstrap-smtp@rehearsal.invalid
bootstrap_pass=rehearsal-bootstrap-pass
invite_code="rehearsal-$(openssl rand -hex 12)"

wait_for_health() {
  local id=$1
  for ((attempt = 0; attempt < 90; attempt++)); do
    [ "$(docker inspect --format '{{.State.Running}}' "$id")" = true ] || return 1
    [ "$(docker inspect --format '{{.State.Health.Status}}' "$id")" = healthy ] && return 0
    sleep 2
  done
  return 1
}

postgres=$(docker run -d --name "$prefix-postgres" --network "$network" --network-alias postgres \
  -e POSTGRES_PASSWORD="$pg_password" -e POSTGRES_DB="$database" \
  -v "$operator:/operator" -v "$backups:/app-backups:ro" \
  --health-cmd "pg_isready -U postgres -d $database" --health-interval 2s --health-retries 30 \
  "$postgres_image")
containers+=("$postgres")
redis=$(docker run -d --name "$prefix-redis" --network "$network" --network-alias redis \
  --health-cmd 'redis-cli ping' --health-interval 2s --health-retries 30 "$redis_image")
containers+=("$redis")
capture=$(docker run -d --name "$prefix-capture" --network "$network" --no-healthcheck \
  --network-alias capture --network-alias smtp-capture --network-alias api.twilio.com \
  -e CAPTURE_BOOTSTRAP_SMTP_USER="$bootstrap_user" -e CAPTURE_BOOTSTRAP_SMTP_PASS="$bootstrap_pass" \
  -v "$tls:/capture-tls:ro" -v "$harness:/rehearsal:ro" \
  --entrypoint node "$to_image" /rehearsal/capture.cjs)
containers+=("$capture")
wait_for_health "$postgres" || { docker logs "$postgres"; exit 1; }
wait_for_health "$redis" || { docker logs "$redis"; exit 1; }

pg_sql() { docker exec "$postgres" psql -q -U postgres -v ON_ERROR_STOP=1 "$@"; }

# A sidecar runs rehearsal code with the given app image's own modules.
sidecar() {
  local image=$1 db=$2
  shift 2
  docker run --rm -i --network "$network" -v "$harness:/rehearsal:ro" -v "$work:/work" \
    "${mounts[@]}" \
    -e REHEARSAL_DATABASE_URL="postgresql://postgres:$pg_password@postgres:5432/$db" \
    -e REHEARSAL_SCENARIO="/rehearsal/scenarios/$scenario.cjs" \
    -e HEALTH_CHECK_TOKEN="$health_token" -e SESSION_SECRET="$session_secret" \
    --entrypoint node "$image" /rehearsal/run.cjs "$@"
}
mounts=()

record() {
  mounts=()
  sidecar "$to_image" "$database" record "$@" >/dev/null
}

put_work_file() {
  docker run --rm -i -v "$work:/work" --network none --entrypoint sh "$to_image" -c "cat > /work/$1"
}

print_report() {
  mounts=()
  local output status=0
  output=$(sidecar "$to_image" "$database" report) || status=$?
  printf '%s\n' "$output"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then printf '%s\n' "$output" >> "$GITHUB_STEP_SUMMARY"; fi
  report_done=true
  return "$status"
}

app=""
start_app() { # label image database uploads-volume backups-volume seed
  [ -z "$app" ] || docker rm -fv "$app" >/dev/null
  app=$(docker run -d --name "$prefix-$1" --network "$network" --network-alias app \
    -e DATABASE_URL="postgresql://postgres:$pg_password@postgres:5432/$3" \
    -e REDIS_URL=redis://redis:6379 \
    -e SESSION_SECRET="$session_secret" -e HEALTH_CHECK_TOKEN="$health_token" \
    -e HOST_INVITE_CODE="$invite_code" -e OPEN_REGISTRATION=false \
    -e EMAIL_FROM=rehearsal@example.invalid -e NEXT_PUBLIC_APP_URL=http://app:3000 \
    -e SMTP_HOST=smtp-capture -e SMTP_PORT=2525 \
    -e SMTP_USER="$bootstrap_user" -e SMTP_PASS="$bootstrap_pass" \
    -e NODE_EXTRA_CA_CERTS=/capture-tls/ca.crt -e SEED_TEST_DATA="$6" \
    -v "$4:/app/data/uploads" -v "$5:/app/data/backups" -v "$tls:/capture-tls:ro" \
    --health-interval 5s --health-start-period 120s \
    "$2")
  containers+=("$app")
  wait_for_health "$app"
}

stop_app() {
  [ -n "$app" ] || return 0
  docker stop "$app" >/dev/null
}

copy_volume() {
  docker run --rm --network none -v "$1:/from:ro" -v "$2:/to" --entrypoint sh "$to_image" -c 'cp -a /from/. /to/'
}

# The images must contain exactly the migrations Git says they do.
image_migrations() { # image tree
  docker run --rm --network none --entrypoint sh "$1" -c "ls -1 /app/$(migrations_path "$2")" |
    grep -E "$migration_pattern" | sort
}
for side in baseline candidate; do
  if [ "$side" = baseline ]; then image=$from_image tree=$from_tree listed=$baseline_migrations; else image=$to_image tree=$to_tree listed=$candidate_migrations; fi
  if [ "$(image_migrations "$image" "$tree")" = "$listed" ]; then
    record plan ok blocking "The $side image has the migrations Git lists" "$(printf '%s\n' "$listed" | grep -c .) migrations"
  else
    record plan fail blocking "The $side image has the migrations Git lists" "$image differs from $tree"
    exit 1
  fi
done
record plan ok blocking "Expected new migrations derived from Git" "$(printf '%s\n' "$expected" | grep -c . || true) since $from_version"

# ---- Baseline: the release's own seed plus scenario fixtures -----------------
echo "== Baseline $from_label"
mounts=()
printf '%s\n' "$expected" | put_work_file expected-migrations.txt
if ! start_app baseline "$from_image" "$database" "$uploads" "$backups" true; then
  docker logs "$app" | tail -n 60
  record seed fail blocking "Baseline starts with its own seed data"
  exit 1
fi
record seed ok blocking "Baseline starts with its own seed data" "$from_image"
app_logs() { echo "--- $1 application log (last 40 lines)"; docker logs --tail 40 "$app" 2>&1; }
sidecar "$from_image" "$database" seed || { app_logs baseline; echo "Baseline seeding failed." >&2; exit 1; }
sidecar "$from_image" "$database" smoke baseline || { app_logs baseline; echo "Baseline control checks failed." >&2; exit 1; }
stop_app

mounts=(-v "$uploads:/uploads")
sidecar "$from_image" "$database" backdate-uploads 48 >/dev/null
# The documented pre-upgrade backup: a database dump and a copy of uploads.
docker exec "$postgres" pg_dump -U postgres -f /operator/pre-upgrade.sql "$database"
copy_volume "$uploads" "$uploads_backup"
mounts=()
sidecar "$to_image" "$database" snapshot before.json >/dev/null
record seed ok blocking "Operator backup taken" "pg_dump and uploads copy"

# ---- Upgrade ------------------------------------------------------------------
echo "== Upgrade to $to_label"
baseline_backups=$(docker exec "$postgres" sh -c 'ls -1 /app-backups/pre-migration/ 2>/dev/null || true' | sort)
printf '%s\n' "$baseline_backups" | put_work_file baseline-pre-migration.txt
if ! start_app candidate "$to_image" "$database" "$uploads" "$backups" false; then
  docker logs "$app" | tail -n 80
  record upgrade fail blocking "Candidate starts on the upgraded database"
  exit 1
fi
record upgrade ok blocking "Candidate starts on the upgraded database" "$to_image"
docker logs "$app" 2>&1 | put_work_file candidate-start.log
mounts=(-v "$uploads:/uploads:ro" -v "$backups:/backups:ro")
sidecar "$to_image" "$database" verify-upgrade || app_logs candidate
stop_app
after_backups=$(docker exec "$postgres" sh -c 'ls -1 /app-backups/pre-migration/ 2>/dev/null || true' | sort)
startup_snapshot=$(printf '%s\n---\n%s\n' "$baseline_backups" "$after_backups" | node_cli new-snapshot pre-migration-schema_ || true)

# ---- Rollback probes ----------------------------------------------------------
# Each probe starts from its own copy of the upgraded database and storage,
# including the RSVPs and votes received after the upgrade.
probe() { # label database uploads backups blocking
  local label=$1 db=$2 probe_uploads=$3 probe_backups=$4 kind=$5
  local flag=()
  [ "$kind" = blocking ] || flag=(--report-only)
  # Each rollback probe tests a mutually exclusive timeline; reset rate-limit
  # counters in the shared Redis container so prior probes do not bleed over.
  docker exec "$redis" redis-cli FLUSHDB >/dev/null
  if start_app "probe-$db" "$from_image" "$db" "$probe_uploads" "$probe_backups" false; then
    record "$label" ok "$kind" "Baseline image starts"
    mounts=()
    sidecar "$from_image" "$db" smoke "$label" "${flag[@]}" || app_logs "$label"
  else
    local reason
    reason=$(docker logs "$app" 2>&1 | grep -iE 'error|fail' | tail -n 3 | tr '\n' ' ')
    record "$label" fail "$kind" "Baseline image starts" "${reason:-not healthy}"
  fi
  stop_app
}

# Sets r_uploads/r_backups to new copies of the post-upgrade storage.
clone_storage() {
  new_volume "$1-uploads"
  new_volume "$1-backups"
  r_uploads=$prefix-$1-uploads
  r_backups=$prefix-$1-backups
  copy_volume "$uploads" "$r_uploads"
  copy_volume "$backups" "$r_backups"
}

echo "== R1: image-only rollback"
pg_sql -c "CREATE DATABASE probe_r1 TEMPLATE $database"
clone_storage r1
probe "R1 image-only" probe_r1 "$r_uploads" "$r_backups" report

echo "== R2: db:secrets --rollback, then the baseline image"
pg_sql -c "CREATE DATABASE probe_r2 TEMPLATE $database"
clone_storage r2
if output=$(docker run --rm --network "$network" \
  -e DATABASE_URL="postgresql://postgres:$pg_password@postgres:5432/probe_r2" \
  -e SESSION_SECRET="$session_secret" -v "$r_uploads:/app/data/uploads" -v "$r_backups:/app/data/backups" \
  "$to_image" npm run --silent db:secrets -- --rollback 2>&1); then
  record "R2 secrets-rollback" ok report "Candidate db:secrets --rollback" "$(printf '%s' "$output" | grep 'config-secrets' | tail -n 1)"
else
  record "R2 secrets-rollback" fail report "Candidate db:secrets --rollback" "$(printf '%s' "$output" | tail -n 2 | tr '\n' ' ')"
fi
probe "R2 secrets-rollback" probe_r2 "$r_uploads" "$r_backups" report

echo "== R3a: restore the operator backup (database and uploads)"
pg_sql -c "CREATE DATABASE probe_r3a"
pg_sql -d probe_r3a -f /operator/pre-upgrade.sql >/dev/null
clone_storage r3a
# Replace the post-upgrade uploads with the operator's pre-upgrade copy.
docker run --rm --network none -v "$r_uploads:/to" --entrypoint sh "$to_image" -c 'find /to -mindepth 1 -delete'
copy_volume "$uploads_backup" "$r_uploads"
mounts=()
sidecar "$to_image" probe_r3a compare-exact "R3a restore-operator-backup" "Restored database equals the pre-upgrade data" || true
probe "R3a restore-operator-backup" probe_r3a "$r_uploads" "$r_backups" blocking

echo "== R3b: restore the candidate's automatic pre-migration snapshot, keep uploads"
if [ -n "$startup_snapshot" ]; then
  pg_sql -c "CREATE DATABASE probe_r3b"
  pg_sql -d probe_r3b -f "/app-backups/pre-migration/$startup_snapshot" >/dev/null
  clone_storage r3b
  sidecar "$to_image" probe_r3b compare-exact "R3b restore-startup-snapshot" "Restored database equals the pre-upgrade data" || true
  probe "R3b restore-startup-snapshot" probe_r3b "$r_uploads" "$r_backups" blocking
else
  record "R3b restore-startup-snapshot" fail blocking "Automatic pre-migration snapshot exists"
fi

print_report
