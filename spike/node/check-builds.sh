#!/usr/bin/env bash
# R6: rebuilds player/ and every block with each Node version in a throwaway worktree
# and reports whether the committed build output is reproduced byte for byte.
# Usage: ./check-builds.sh 26.12.0 24.22.0 22.23.3 20.19.2
set -uo pipefail
repo="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
source "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null
for v in "$@"; do
  wt="$(mktemp -d "${TMPDIR:-/tmp}/radplapag-r6.XXXXXX")"
  git -C "$repo" worktree add --detach "$wt" HEAD >/dev/null 2>&1
  nvm use "$v" >/dev/null
  echo "== Node $(node --version) · npm $(npm --version)"
  for dir in player blocks/schedule blocks/programs-list blocks/now-playing; do
    out="$( (cd "$wt/$dir" && npm ci --no-audit --no-fund && npm run build) 2>&1 )"
    rc=$?
    if [ $rc -ne 0 ]; then
      echo "   $dir: BUILD FAILED"; echo "$out" | grep -iE "error|engine" | head -5 | sed 's/^/      /'
      continue
    fi
    target=$([ "$dir" = player ] && echo player/dist || echo "$dir/build")
    changes="$(git -C "$wt" status --porcelain -- "$target")"
    if [ -z "$changes" ]; then echo "   $dir: identical"; else echo "   $dir: DIFFERS"; echo "$changes" | head -5 | sed 's/^/      /'; fi
    warn="$(echo "$out" | grep -ciE "npm warn (EBADENGINE|deprecated)")"
    [ "$warn" != 0 ] && echo "      ($warn npm engine/deprecation warnings)"
  done
  git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1
done
