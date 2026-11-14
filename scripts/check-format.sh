#!/usr/bin/env bash
# Check source candidates without traversing runtime volumes or modifying files.
set -Eeuo pipefail
cd "$(git rev-parse --show-toplevel)"

# Keep batches below Linux's argument limit and omit deleted tracked paths.
while IFS= read -r -d '' file; do
  if [ -e "$file" ]; then
    printf '%s\0' "$file"
  fi
done < <(git ls-files -co --exclude-standard -z) \
  | xargs -0 -r -s 65536 npx prettier --check --ignore-unknown
