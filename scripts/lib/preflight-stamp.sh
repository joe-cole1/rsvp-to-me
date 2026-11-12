# shellcheck shell=bash
#
# Preflight pass stamps. preflight.sh records that it passed for an exact
# working tree; ship.sh skips re-running preflight on identical content.
#
# The tree id covers HEAD plus every tracked change and every untracked,
# non-ignored file: exactly what committing the current state would contain.
# It is computed in a throwaway index, so the real index is never touched.

preflight_tree_id() {
  local index status=0
  index="$(mktemp)"
  # Start from the real index when there is one (fast: only changed files are
  # rehashed); an empty file is not a valid index, so drop it otherwise.
  cp "$(git rev-parse --git-path index)" "$index" 2>/dev/null || rm -f "$index"
  if GIT_INDEX_FILE="$index" git add -A >/dev/null 2>&1; then
    GIT_INDEX_FILE="$index" git write-tree || status=$?
  else
    status=1
  fi
  rm -f "$index"
  return "$status"
}

preflight_stamp_file() {
  git rev-parse --git-path rsvp-preflight-pass
}

# preflight_stamp_covers <full|fast> <tree-id>
# True when a recorded pass for that exact tree satisfies the requested mode:
# a full pass covers both modes, a fast pass covers only fast.
preflight_stamp_covers() {
  local wanted="$1" tree="$2" file stamped_tree stamped_mode
  file="$(preflight_stamp_file)"
  [ -r "$file" ] || return 1
  read -r stamped_tree stamped_mode <"$file" || return 1
  [ "$stamped_tree" = "$tree" ] || return 1
  [ "$stamped_mode" = full ] || [ "$wanted" = fast ]
}

# preflight_record_pass <full|fast> <tree-id>
# A fast pass never replaces a full pass recorded for the same tree.
preflight_record_pass() {
  local mode="$1" tree="$2"
  if [ "$mode" = fast ] && preflight_stamp_covers full "$tree"; then
    return 0
  fi
  printf '%s %s\n' "$tree" "$mode" >"$(preflight_stamp_file)"
}
