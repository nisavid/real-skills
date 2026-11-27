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

# This fork differs from upstream. It checks both destinations before writing
# and refuses to delete or repoint conflicting entries. On any conflict, it
# changes nothing and exits with status 1.

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PHYSICAL_REPO="$(cd -P "$REPO" && pwd)"
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

# Judge link text lexically against REPO (upstream's link path) and destinations physically against PHYSICAL_REPO.
points_into_checkout() {
  local target part path=""
  local -a parts
  # Preserve trailing newlines in the link text.
  target="$(readlink -n "$1" && printf '.')" || return 1
  target="${target%.}"
  if [[ "$target" != /* ]]; then
    target="${1%/*}/$target"
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

resolved_dests=()
for DEST in "${DESTS[@]}"; do
  ancestor="$DEST"
  suffix=""
  while [ ! -e "$ancestor" ] && [ ! -L "$ancestor" ]; do
    suffix="/${ancestor##*/}$suffix"
    ancestor="$(dirname "$ancestor")"
  done

  if ! ancestor="$(cd -P -- "$ancestor" 2>/dev/null && pwd)" || [ ! -x "$ancestor" ]; then
    report_conflict "$DEST" "not a writable, searchable directory outside this checkout"
    continue
  fi
  if [[ ! -w "$ancestor" || "$ancestor" == "$PHYSICAL_REPO" || "$ancestor" == "$PHYSICAL_REPO/"* ]]; then
    report_conflict "$DEST" "not a writable, searchable directory outside this checkout"
  fi

  resolved="${ancestor%/}$suffix"
  resolved_dests+=("${resolved:-/}")
done

for DEST in ${resolved_dests[@]+"${resolved_dests[@]}"}; do
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
    elif [ -e "$target" ]; then
      report_conflict "$target" "another kind of filesystem entry"
    else
      for destination in "${resolved_dests[@]}"; do
        if [[ "$destination" == "$target" || "$destination" == "$target/"* ]]; then
          report_conflict "$target" "needed as a destination directory"
          break
        fi
      done
    fi
  done
done

if [ "$conflicts" -ne 0 ]; then
  echo "Nothing was changed." >&2
  exit 1
fi

for DEST in "${resolved_dests[@]}"; do
  mkdir -p "$DEST"

  for i in "${!names[@]}"; do
    name="${names[$i]}"
    src="${srcs[$i]}"
    target="$DEST/$name"

    ln -sfn "$src" "$target"
    echo "linked $name -> $src ($DEST)"
  done
done
