#!/usr/bin/env bash
# R4: runs the spike tests inside player/ of a throwaway worktree, so player/package.json
# in the real tree is never touched. Usage: ./run.sh [happy-dom|jsdom]...
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(git -C "$here" rev-parse --show-toplevel)"
wt="$(mktemp -d "${TMPDIR:-/tmp}/radplapag-r4.XXXXXX")"
trap 'git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1 || true' EXIT
git -C "$repo" worktree add --detach "$wt" HEAD >/dev/null
cd "$wt/player"
npm ci --no-audit --no-fund >/dev/null
npm install --no-save --no-audit --no-fund $(node -e "const d=require('$here/package.json').devDependencies;console.log(Object.entries(d).map(([k,v])=>k+'@'+v).join(' '))") >/dev/null
mkdir -p src/__spike__
cp "$here/fake-audio.ts" "$here/use-audio-player.test.tsx" src/__spike__/
cp "$here/vitest.config.ts" vitest.spike.config.ts
# MUTATE=1: drop crossOrigin from every branch, to prove the tests catch it.
if [ "${MUTATE:-}" = 1 ]; then sed -i.bak "/crossOrigin = 'anonymous'/d" src/hooks/use-audio-player.tsx; fi
for env in "${@:-happy-dom jsdom}"; do
  for e in $env; do
    echo "== $e"
    npx vitest run -c vitest.spike.config.ts --environment "$e" || status=$?
  done
done
exit "${status:-0}"
