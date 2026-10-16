#!/usr/bin/env bash
# Stop: if the working tree has changes, regenerate what is generated and run the
# fast checks of the areas touched (spec 0001 §7.4). Each project uses its own
# tools. A failure returns {"decision":"block"} so Claude keeps working; after
# MAX_ATTEMPTS blocked stops in a row the turn ends with a warning instead.
#   player/src        → player build (dist), typecheck, Vitest
#   blocks/<b>/src    → that block's build
#   *.php             → php -l on each changed file + PHPUnit unit
#   admin/js, tests/js → root Vitest
#   .claude/hooks, tests/hooks → hook tests
# Integration and e2e need Docker and stay out (npm run test:php:integration / test:e2e).
set -uo pipefail

MAX_ATTEMPTS=3

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$PROJECT_DIR" || exit 0

INPUT="$(cat)"
SESSION="$(echo "$INPUT" | jq -r '.session_id // "default"')"
COUNTER="${TMPDIR:-/tmp}/radplapag-stop-$SESSION"

CHANGED="$(git status --porcelain --untracked-files=all 2>/dev/null | cut -c4- | sed 's/.* -> //')"
if [ -z "$CHANGED" ]; then
	rm -f "$COUNTER"
	exit 0
fi

changed() { echo "$CHANGED" | grep -Eq "$1"; }

FAILURES=""
check() {
	local name="$1"
	shift
	local output
	if ! output="$("$@" 2>&1)"; then
		FAILURES+="## $name failed"$'\n'"$(echo "$output" | tail -25)"$'\n\n'
	fi
}

if changed '^player/src/'; then
	check "Player build" npm --prefix player run -s build
	check "Player typecheck" npm --prefix player run -s typecheck
	check "Player Vitest" npm --prefix player test --silent
fi

for block_dir in blocks/*/; do
	block="$(basename "$block_dir")"
	if changed "^blocks/$block/src/"; then
		check "Block $block build" npm --prefix "blocks/$block" run -s build
	fi
done

PHP_CHANGED="$(echo "$CHANGED" | grep -E '\.php$' | grep -Ev '^(vendor|spike|blocks/[^/]+/build)/' || true)"
if [ -n "$PHP_CHANGED" ]; then
	while IFS= read -r file; do
		[ -f "$file" ] && check "php -l $file" php -l "$file"
	done <<<"$PHP_CHANGED"
	check "PHPUnit unit" vendor/bin/phpunit
fi

if changed '^(admin/js|tests/js)/'; then
	check "Root Vitest" npm test --silent
fi

if changed '^(\.claude/hooks|tests/hooks)/'; then
	check "Hook tests" bash tests/hooks/run.sh
fi

if [ -z "$FAILURES" ]; then
	rm -f "$COUNTER"
	exit 0
fi

ATTEMPTS=$(($(cat "$COUNTER" 2>/dev/null || echo 0) + 1))
echo "$ATTEMPTS" >"$COUNTER"

if [ "$ATTEMPTS" -gt "$MAX_ATTEMPTS" ]; then
	rm -f "$COUNTER"
	jq -n --arg msg "verify-before-stop: checks still failing after $MAX_ATTEMPTS attempts; stopping anyway. Run npm run check." \
		'{systemMessage: $msg}'
	exit 0
fi

jq -n --arg reason "Checks failed (attempt $ATTEMPTS of $MAX_ATTEMPTS). Fix them before finishing:"$'\n\n'"$FAILURES" \
	'{decision: "block", reason: $reason}'
exit 0
