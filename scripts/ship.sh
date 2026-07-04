#!/usr/bin/env bash
#
# ship — run full local CI (preflight), then commit + push + open the PR.
# Nothing is pushed unless EVERYTHING passes locally, so you never wait on
# GitHub CI to surface a failure.
#
#   scripts/ship.sh "<commit message>" [--label <label>] [--base <branch>] [--fast] [--draft]
#
# Examples:
#   scripts/ship.sh "[abc123] fix(auth): tighten session check" --label bug
#   scripts/ship.sh "[abc123] chore: add local CI scripts" --label chore --fast
#
set -Eeuo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true

cd "$(git rev-parse --show-toplevel)"

MSG="${1:-}"
[ -z "$MSG" ] && { echo "usage: scripts/ship.sh \"<commit message>\" [--label X] [--base main] [--fast] [--draft]" >&2; exit 1; }
shift

LABEL="chore"
BASE="main"
FASTFLAG=""
DRAFT=""
while [ $# -gt 0 ]; do
  case "$1" in
    --label) LABEL="$2"; shift 2;;
    --base)  BASE="$2";  shift 2;;
    --fast)  FASTFLAG="--fast"; shift;;
    --draft) DRAFT="--draft"; shift;;
    *) echo "unknown arg: $1" >&2; exit 1;;
  esac
done

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" = "$BASE" ]; then
  echo "✗ Refusing to ship from the base branch '$BASE'. Create a feature branch first." >&2
  exit 1
fi

say() { printf '\n\033[1;35m» %s\033[0m\n' "$*"; }

# 1) Full local CI — aborts the whole script on any failure (set -e).
say "Running local CI (scripts/preflight.sh ${FASTFLAG:-full})"
scripts/preflight.sh $FASTFLAG

# 2) Commit (husky hook runs for real — Node is present in WSL).
if [ -n "$(git status --porcelain)" ]; then
  say "Committing"
  git add -A
  git commit -m "$MSG"
else
  say "No working-tree changes to commit (using existing commits on '$BRANCH')"
fi

# 3) Push.
say "Pushing '$BRANCH'"
git push -u origin "$BRANCH"

# 4) Open PR (or report the existing one). --fill pulls title/body from commits.
if gh pr view "$BRANCH" >/dev/null 2>&1; then
  say "PR already open:"
  gh pr view "$BRANCH" --json url --jq .url
else
  say "Opening PR"
  gh pr create --base "$BASE" --head "$BRANCH" --fill --label "$LABEL" $DRAFT
fi

printf '\n\033[1;32m✅ Shipped: %s\033[0m\n' "$BRANCH"
