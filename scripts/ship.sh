#!/usr/bin/env bash
#
# ship — run full local CI (preflight), self-review the staged diff, then commit
# + push + open the PR. Nothing is pushed unless EVERYTHING passes locally, so you
# never wait on GitHub CI to surface a failure.
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

# 2) Stage everything, then self-review the staged diff before committing.
git add -A
say "Self-review guardrails"

STAGED="$(git diff --cached --name-only)"
[ -z "$STAGED" ] && { echo "✗ Nothing staged to commit." >&2; exit 1; }

fail=0

# a) Never commit an environment file.
if printf '%s\n' "$STAGED" | grep -qE '(^|/)\.env($|\.)'; then
  echo "✗ A .env file is staged — remove it (git restore --staged) before shipping."
  fail=1
fi

# b) Block .only() in staged tests (silences the rest of the suite in CI).
#    .skip()/it.todo() are allowed — sometimes a deliberately-parked test.
if git diff --cached -U0 -- '*.test.ts' '*.test.tsx' '*.spec.ts' '*.spec.tsx' \
   | grep -qE '^\+.*\b(it|test|describe)\.only\('; then
  echo "✗ A .only() is staged in a test file — it would silence CI. Remove it."
  fail=1
fi

# c) Block stray debug artifacts in staged APP source (scripts/prisma/tests exempt).
if git diff --cached -U0 -- app/ components/ lib/ \
   | grep -qE '^\+[^+].*(console\.(log|debug)|(^|[^.])\bdebugger\b)'; then
  echo "✗ A console.log/console.debug/debugger is staged in app source — remove it."
  fail=1
fi

[ "$fail" -eq 1 ] && { echo "Self-review failed — fix the above and re-run." >&2; exit 1; }
ok_msg() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
ok_msg "self-review clean"

# 3) Commit (husky hook runs for real — Node is present in WSL).
say "Committing"
git commit -m "$MSG"

# 4) Push.
say "Pushing '$BRANCH'"
git push -u origin "$BRANCH"

# 5) Open PR (or report the existing one). --fill pulls title/body from commits.
if gh pr view "$BRANCH" >/dev/null 2>&1; then
  say "PR already open:"
  gh pr view "$BRANCH" --json url --jq .url
else
  say "Opening PR"
  gh pr create --base "$BASE" --head "$BRANCH" --fill --label "$LABEL" $DRAFT
fi

printf '\n\033[1;32m✅ Shipped: %s\033[0m\n' "$BRANCH"
