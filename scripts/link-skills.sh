#!/usr/bin/env bash
set -euo pipefail

# NOTE: This is a dev-only script, intended for use by maintainers of this repo.
# It is not a supported installer. Modifications to it, or requests for
# modifications, will not be approved.
#
# Links all skills in the repository into the local skill directories used by
# each agent harness:
#   - ~/.claude/skills: Claude Code
#   - ~/.agents/skills: Codex and other Agent Skills-compatible harnesses
# Each entry is a symlink into this repo, so a `git pull` is all that's needed
# to keep installed skills up to date.

# This fork checks both destinations for conflicts before writing any links.

REPO="$(CDPATH='' cd -P -- "$(dirname "$0")/.." && pwd)"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")

# Collect the repo's skills once, link into every destination. `deprecated/`
# is retired, and `misc/` is kept around but rarely used and not promoted (see
# each bucket's own README): neither belongs in a daily-driver skill
# directory, so both are skipped here, same as everywhere else non-promoted
# skills are kept out. `in-progress/` IS still linked: it's public on purpose,
# feedback wanted, and this local install is exactly where that feedback loop
# runs.
names=()
srcs=()
while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  names+=("$(basename "$src")")
  srcs+=("$src")
done < <(find "$REPO/skills" -name SKILL.md -not -path '*/node_modules/*' -not -path '*/deprecated/*' -not -path '*/misc/*' -print0)

points_into_checkout() {
  local target part path=""
  local -a parts
  # Preserve trailing newlines in the link text.
  target="$(readlink "$1" && printf '.')" || return 1
  target="${target%$'\n.'}"
  if [[ "$target" != /* ]]; then
    target="$(cd -P -- "$(dirname "$1")" && pwd)/$target" || return 1
  fi

  # Use the named path, even if it is missing or is itself a symlink.
  IFS=/ read -r -d '' -a parts < <(printf '%s\0' "$target")
  for part in "${parts[@]}"; do
    case "$part" in
      ""|.) ;;
      ..) path="${path%/*}" ;;
      *) path="$path/$part" ;;
    esac
  done
  [[ "$path" == "$REPO" || "$path" == "$REPO/"* ]]
}

conflicts=0
report_conflict() {
  local path="${1//$'\n'/\\n}"
  printf 'error: %s is %s.\n' "$path" "$2" >&2
  conflicts=1
}

for DEST in "${DESTS[@]}"; do
  # If $DEST is a symlink that resolves into this repo, we'd end up writing the
  # per-skill symlinks back into the repo's own skills/ tree. Detect and bail
  # out instead of polluting the working copy.
  if [ -L "$DEST" ]; then
    resolved="$(readlink -f "$DEST")" || resolved=""
    if [[ "$resolved" == "$REPO" || "$resolved" == "$REPO/"* ]] ||
      points_into_checkout "$DEST"; then
      report_conflict "$DEST" "a destination symlink into this checkout"
    fi
  fi

  for name in "${names[@]}"; do
    target="$DEST/$name"
    if [ -L "$target" ]; then
      if ! points_into_checkout "$target"; then
        report_conflict "$target" "a symlink whose named target is outside this checkout or unreadable"
      fi
    elif [ -f "$target" ]; then
      report_conflict "$target" "a regular file"
    elif [ -d "$target" ]; then
      report_conflict "$target" "a directory"
    elif [ -p "$target" ]; then
      report_conflict "$target" "a named pipe"
    elif [ -S "$target" ]; then
      report_conflict "$target" "a socket"
    elif [ -b "$target" ]; then
      report_conflict "$target" "a block device"
    elif [ -c "$target" ]; then
      report_conflict "$target" "a character device"
    elif [ -e "$target" ]; then
      report_conflict "$target" "another kind of filesystem entry"
    fi
  done
done

if [ "$conflicts" -ne 0 ]; then
  echo "Nothing was changed." >&2
  exit 1
fi

for DEST in "${DESTS[@]}"; do
  mkdir -p "$DEST"

  for i in "${!names[@]}"; do
    name="${names[$i]}"
    src="${srcs[$i]}"
    target="$DEST/$name"

    ln -sfn "$src" "$target"
    echo "linked $name -> $src ($DEST)"
  done
done
