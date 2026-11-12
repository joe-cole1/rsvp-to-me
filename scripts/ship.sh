#!/usr/bin/env bash
#
# ship — run local CI, stage an explicit reviewed file list, self-review it, then
# commit, push, and open a PR. It never stages every changed file automatically.
#
#   scripts/ship.sh "<commit message>" [options] -- <reviewed files...>
#   scripts/ship.sh "<PR title>" --committed [options]
#
# The PR title is the message's first line, so a commit body and trailers stay
# out of it. --committed ships commits already on the branch (no staging or new
# commit) after the same checks on the branch's diff from origin/<base>.
#
# Preflight is skipped when it already passed for this exact working tree in the
# requested mode or stronger (a full pass covers --fast); --rerun-preflight
# forces a new run. Push and gh calls retry transient network failures.
#
# Examples:
#   scripts/ship.sh "fix(auth): tighten session check" --label bug --pr-body-file /tmp/pr.md -- app/auth.ts
#   scripts/ship.sh "chore: add local CI scripts" --label chore --fast --pr-body-file /tmp/pr.md -- scripts/ship.sh
#   scripts/ship.sh "chore: update tooling" --pr-handoff --label chore --fast --pr-body-file /tmp/pr.md -- scripts/ship.sh
#   scripts/ship.sh "fix: two separately committed fixes" --committed --label bug --pr-body-file /tmp/pr.md
#
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel)"

# Codex/Desktop-launched WSL shells can inherit Windows temp paths. Keep Node
# tooling on the native WSL filesystem for reliability and performance.
export TMPDIR=/tmp
export TMP=/tmp
export TEMP=/tmp

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
if command -v nvm >/dev/null 2>&1; then
  nvm use --silent >/dev/null || { echo "✗ Node from .nvmrc is unavailable — run: nvm install" >&2; exit 1; }
fi
command -v node >/dev/null 2>&1 || { echo "✗ node not found — run: nvm install" >&2; exit 1; }

# shellcheck source=scripts/lib/preflight-stamp.sh
. scripts/lib/preflight-stamp.sh
# shellcheck source=scripts/lib/net-retry.sh
. scripts/lib/net-retry.sh

USAGE='usage: scripts/ship.sh "<commit message>" [options] -- <reviewed files...>
       scripts/ship.sh "<PR title>" --committed [options]'

MSG="${1:-}"
[ -z "$MSG" ] && { echo "$USAGE" >&2; exit 1; }
shift
# The PR title is the subject line only, never the commit body or trailers.
TITLE="${MSG%%$'\n'*}"

LABEL="chore"
BASE="main"
FASTFLAG=""
DRAFT=""
ALLOW_OPEN_PR=0
PR_HANDOFF=0
COMMITTED=0
RERUN_PREFLIGHT=0
PR_BODY_FILE=""
FILES=()
while [ $# -gt 0 ]; do
  case "$1" in
    --label)
      [ $# -ge 2 ] || { echo "✗ --label requires a value." >&2; exit 1; }
      LABEL="$2"
      shift 2
      ;;
    --base)
      [ $# -ge 2 ] || { echo "✗ --base requires a value." >&2; exit 1; }
      BASE="$2"
      shift 2
      ;;
    --fast)  FASTFLAG="--fast"; shift;;
    --draft) DRAFT="--draft"; shift;;
    --allow-open-pr) ALLOW_OPEN_PR=1; shift;;
    --pr-handoff) PR_HANDOFF=1; shift;;
    --committed) COMMITTED=1; shift;;
    --rerun-preflight) RERUN_PREFLIGHT=1; shift;;
    --pr-body-file)
      [ $# -ge 2 ] || { echo "✗ --pr-body-file requires a value." >&2; exit 1; }
      PR_BODY_FILE="$2"
      shift 2
      ;;
    --)
      shift
      FILES=("$@")
      break
      ;;
    *) echo "unknown arg: $1" >&2; exit 1;;
  esac
done

if [ "$COMMITTED" -eq 1 ]; then
  [ "${#FILES[@]}" -eq 0 ] || {
    echo "✗ --committed ships existing commits; do not list files after --." >&2
    exit 1
  }
else
  [ "${#FILES[@]}" -gt 0 ] || {
    echo "✗ Provide the reviewed files after -- (for example: -- app/page.tsx tests/page.test.tsx)," >&2
    echo "  or use --committed to ship commits already on the branch." >&2
    exit 1
  }
fi

case "$LABEL" in
  feature|ui/ux|bug|refactor|performance|documentation|tests|chore) ;;
  *)
    echo "✗ Unsupported release label '$LABEL'." >&2
    echo "  Use one of: feature, ui/ux, bug, refactor, performance, documentation, tests, chore." >&2
    exit 1
    ;;
esac

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "$BASE" ]; then
  echo "✗ Refusing to ship from the base branch '$BASE'. Create a feature branch first." >&2
  exit 1
fi

OPEN_PR=""
if [ "$PR_HANDOFF" -eq 1 ]; then
  echo "⚠ PR state was not checked (open, closed, or merged)." >&2
  echo "  The caller must check branch PR state through the GitHub integration before running --pr-handoff." >&2
  if [ "$ALLOW_OPEN_PR" -eq 1 ]; then
    echo "  --allow-open-pr cannot enforce the open-PR guard in handoff mode." >&2
  fi
else
  command -v gh >/dev/null 2>&1 || {
    echo "✗ GitHub CLI (gh) is required to check and open the PR." >&2
    exit 1
  }

  OPEN_PR="$(net_retry gh pr list --head "$BRANCH" --state open --json url --jq '.[0].url')"
  if [ -n "$OPEN_PR" ] && [ "$ALLOW_OPEN_PR" -ne 1 ]; then
    echo "✗ This branch already has an open PR: $OPEN_PR" >&2
    echo "  Obtain explicit approval before rerunning with --allow-open-pr." >&2
    exit 1
  fi
fi
if [ "$PR_HANDOFF" -eq 1 ] || [ -z "$OPEN_PR" ]; then
  [ -n "$PR_BODY_FILE" ] || {
    if [ "$PR_HANDOFF" -eq 1 ]; then
      echo "✗ --pr-handoff requires --pr-body-file <path>." >&2
    else
      echo "✗ A new PR requires --pr-body-file <path>." >&2
    fi
    exit 1
  }
  [ -r "$PR_BODY_FILE" ] || { echo "✗ PR body file is not readable: $PR_BODY_FILE" >&2; exit 1; }
  for heading in "## Summary" "## Verification" "## Documentation"; do
    grep -Fqx "$heading" "$PR_BODY_FILE" || {
      echo "✗ PR body must contain the heading: $heading" >&2
      exit 1
    }
  done
fi

if ! git diff --cached --quiet; then
  echo "✗ The index already contains staged changes. Review or unstage them before shipping:" >&2
  git diff --cached --name-only >&2
  exit 1
fi

say() { printf '\n\033[1;35m» %s\033[0m\n' "$*"; }
ok_msg() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }

# Leftover changes outside the reviewed paths (or, with --committed, any at all).
fail_on_leftovers() {
  local unstaged untracked
  unstaged="$(git diff --name-only)"
  untracked="$(git ls-files --others --exclude-standard)"
  if [ -n "$unstaged" ] || [ -n "$untracked" ]; then
    echo "✗ $1" >&2
    [ -z "$unstaged" ] || printf '%s\n' "$unstaged" >&2
    [ -z "$untracked" ] || printf '%s\n' "$untracked" >&2
    echo "  Review them or remove them before shipping." >&2
    exit 1
  fi
}

if [ "$COMMITTED" -eq 1 ]; then
  fail_on_leftovers "--committed ships commits only, but the working tree has uncommitted changes:"
  net_retry git fetch --quiet origin "$BASE"
  AHEAD="$(git rev-list --count "origin/$BASE..HEAD")"
  [ "$AHEAD" -gt 0 ] || { echo "✗ No commits ahead of origin/$BASE to ship." >&2; exit 1; }
else
  # 1) Format only reviewed paths that still exist. Deleted files are valid ship
  # inputs but cannot be passed to Prettier.
  FORMAT_FILES=()
  for file in "${FILES[@]}"; do
    [ -e "$file" ] && FORMAT_FILES+=("$file")
  done
  if [ "${#FORMAT_FILES[@]}" -gt 0 ]; then
    say "Formatting reviewed files"
    npx prettier --write --ignore-unknown "${FORMAT_FILES[@]}"
  fi
fi

# 2) Local CI — aborts the whole script on any failure (set -e), unless this
# exact tree already passed in this mode or a stronger one.
MODE=full
[ -n "$FASTFLAG" ] && MODE=fast
TREE="$(preflight_tree_id)"
if [ "$RERUN_PREFLIGHT" -eq 0 ] && preflight_stamp_covers "$MODE" "$TREE"; then
  say "Local CI (scripts/preflight.sh ${FASTFLAG:-full})"
  ok_msg "already passed for this exact working tree; not rerun (--rerun-preflight forces it)"
else
  say "Running local CI (scripts/preflight.sh ${FASTFLAG:-full})"
  scripts/preflight.sh $FASTFLAG
fi

# 3) Stage only the explicitly reviewed paths, then self-review what ships.
if [ "$COMMITTED" -eq 1 ]; then
  REVIEW_RANGE=("origin/$BASE...HEAD")
else
  git add -- "${FILES[@]}"
  REVIEW_RANGE=(--cached)
fi
say "Self-review guardrails"

SHIPPED="$(git diff --name-only "${REVIEW_RANGE[@]}")"
[ -z "$SHIPPED" ] && { echo "✗ Nothing staged to commit." >&2; exit 1; }

[ "$COMMITTED" -eq 1 ] || fail_on_leftovers "Unstaged changes remain after staging the reviewed paths:"

fail=0

# a) Never commit an environment file.
if printf '%s\n' "$SHIPPED" | grep -qE '(^|/)\.env($|\.)'; then
  echo "✗ A .env file is staged — remove it (git restore --staged) before shipping."
  fail=1
fi

# b) Block .only() in staged tests (silences the rest of the suite in CI).
#    .skip()/it.todo() are allowed — sometimes a deliberately-parked test.
if git diff "${REVIEW_RANGE[@]}" -U0 -- '*.test.ts' '*.test.tsx' '*.spec.ts' '*.spec.tsx' \
   | grep -qE '^\+.*\b(it|test|describe)\.only\('; then
  echo "✗ A .only() is staged in a test file — it would silence CI. Remove it."
  fail=1
fi

# c) Block stray debug artifacts in staged APP source (scripts/prisma/tests exempt).
if git diff "${REVIEW_RANGE[@]}" -U0 -- app/ components/ lib/ \
   | grep -qE '^\+[^+].*(console\.(log|debug)|(^|[^.])\bdebugger\b)'; then
  echo "✗ A console.log/console.debug/debugger is staged in app source — remove it."
  fail=1
fi

[ "$fail" -eq 1 ] && { echo "Self-review failed — fix the above and re-run." >&2; exit 1; }
ok_msg "self-review clean"

# 4) Commit (husky hook runs for real — Node is present in WSL).
if [ "$COMMITTED" -eq 0 ]; then
  say "Committing"
  git commit -m "$MSG"
fi

# 5) Push.
say "Pushing '$BRANCH'"
net_retry git push -u origin "$BRANCH"

# 6) Hand off PR handling, open a PR, or report the existing one.
if [ "$PR_HANDOFF" -eq 1 ]; then
  say "PR handoff"
  printf '  Base: %s\n' "$BASE"
  printf '  Head: %s\n' "$BRANCH"
  printf '  Title: %s\n' "$TITLE"
  printf '  Label: %s\n' "$LABEL"
  printf '  Body file: %s\n' "$PR_BODY_FILE"
  printf '  Draft flag: %s\n' "${DRAFT:-(none)}"
  printf '\n\033[1;32m✓ Pushed; PR handoff required: %s\033[0m\n' "$BRANCH"
  exit 0
fi

if net_retry gh pr view "$BRANCH" >/dev/null 2>&1; then
  say "PR already open:"
  net_retry gh pr view "$BRANCH" --json url --jq .url
else
  say "Opening PR"
  net_retry gh pr create --base "$BASE" --head "$BRANCH" --title "$TITLE" --body-file "$PR_BODY_FILE" --label "$LABEL" $DRAFT
fi

printf '\n\033[1;32m✅ Shipped: %s\033[0m\n' "$BRANCH"
