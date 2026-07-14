#!/usr/bin/env bash
#
# ship — run local CI, stage an explicit reviewed file list, self-review it, then
# commit, push, and open a PR. It never stages every changed file automatically.
#
#   scripts/ship.sh "<commit message>" [options] -- <reviewed files...>
#
# Examples:
#   scripts/ship.sh "fix(auth): tighten session check" --label bug --pr-body-file /tmp/pr.md -- app/auth.ts
#   scripts/ship.sh "chore: add local CI scripts" --label chore --fast --pr-body-file /tmp/pr.md -- scripts/ship.sh
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

MSG="${1:-}"
[ -z "$MSG" ] && { echo "usage: scripts/ship.sh \"<commit message>\" [options] -- <reviewed files...>" >&2; exit 1; }
shift

LABEL="chore"
BASE="main"
FASTFLAG=""
DRAFT=""
ALLOW_OPEN_PR=0
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

[ "${#FILES[@]}" -gt 0 ] || {
  echo "✗ Provide the reviewed files after -- (for example: -- app/page.tsx tests/page.test.tsx)." >&2
  exit 1
}

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

command -v gh >/dev/null 2>&1 || {
  echo "✗ GitHub CLI (gh) is required to check and open the PR." >&2
  exit 1
}

OPEN_PR="$(gh pr list --head "$BRANCH" --state open --json url --jq '.[0].url')"
if [ -n "$OPEN_PR" ] && [ "$ALLOW_OPEN_PR" -ne 1 ]; then
  echo "✗ This branch already has an open PR: $OPEN_PR" >&2
  echo "  Obtain explicit approval before rerunning with --allow-open-pr." >&2
  exit 1
fi
if [ -z "$OPEN_PR" ]; then
  [ -n "$PR_BODY_FILE" ] || { echo "✗ A new PR requires --pr-body-file <path>." >&2; exit 1; }
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

# 2) Local CI — aborts the whole script on any failure (set -e).
say "Running local CI (scripts/preflight.sh ${FASTFLAG:-full})"
scripts/preflight.sh $FASTFLAG

# 3) Stage only the explicitly reviewed paths, then self-review the staged diff.
git add -- "${FILES[@]}"
say "Self-review guardrails"

STAGED="$(git diff --cached --name-only)"
[ -z "$STAGED" ] && { echo "✗ Nothing staged to commit." >&2; exit 1; }

UNSTAGED="$(git diff --name-only)"
UNTRACKED="$(git ls-files --others --exclude-standard)"
if [ -n "$UNSTAGED" ] || [ -n "$UNTRACKED" ]; then
  echo "✗ Unstaged changes remain after staging the reviewed paths:" >&2
  [ -z "$UNSTAGED" ] || printf '%s\n' "$UNSTAGED" >&2
  [ -z "$UNTRACKED" ] || printf '%s\n' "$UNTRACKED" >&2
  echo "  Review them or remove them before shipping." >&2
  exit 1
fi

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

# 4) Commit (husky hook runs for real — Node is present in WSL).
say "Committing"
git commit -m "$MSG"

# 5) Push.
say "Pushing '$BRANCH'"
git push -u origin "$BRANCH"

# 6) Open a PR or report the existing one.
if gh pr view "$BRANCH" >/dev/null 2>&1; then
  say "PR already open:"
  gh pr view "$BRANCH" --json url --jq .url
else
  say "Opening PR"
  gh pr create --base "$BASE" --head "$BRANCH" --title "$MSG" --body-file "$PR_BODY_FILE" --label "$LABEL" $DRAFT
fi

printf '\n\033[1;32m✅ Shipped: %s\033[0m\n' "$BRANCH"
