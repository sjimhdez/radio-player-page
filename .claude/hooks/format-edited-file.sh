#!/usr/bin/env bash
# PostToolUse (Edit|Write): formats only the edited file, with the tools of the
# project it belongs to (spec 0001 §7.4), and sends back what cannot be fixed as
# {"decision":"block","reason":…}.
#   *.php                          php -l + phpcbf (project ruleset)
#   player/**/*.{ts,tsx,js}         player's Prettier + ESLint --fix
#   blocks/<block>/src/**/*.js      that block's wp-scripts lint-js --fix
#   other *.{js,mjs,ts}             root ESLint --fix (WordPress rules + wp-prettier)
set -uo pipefail

# Turned on by spec 0002 once the PHP has been through phpcbf (phase 3).
PHPCBF_ENABLED=true

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
FILE_PATH="$(jq -r '.tool_input.file_path // empty')"
[ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
"$PROJECT_DIR"/*) REL="${FILE_PATH#"$PROJECT_DIR"/}" ;;
*) exit 0 ;;
esac

case "$REL" in
*/node_modules/* | node_modules/* | vendor/* | player/dist/* | blocks/*/build/* | spike/*) exit 0 ;;
esac

report() {
	jq -n --arg reason "$1" '{decision: "block", reason: $reason}'
	exit 0
}

case "$REL" in
*.php)
	if ! OUTPUT="$(php -l "$FILE_PATH" 2>&1)"; then
		report "PHP syntax error in $REL: $OUTPUT"
	fi
	if [ "$PHPCBF_ENABLED" = true ] && [ -x "$PROJECT_DIR/vendor/bin/phpcbf" ]; then
		(cd "$PROJECT_DIR" && vendor/bin/phpcbf -q "$REL" >/dev/null 2>&1)
	fi
	;;
player/*.ts | player/*.tsx | player/*.js)
	FILE_IN_PLAYER="${REL#player/}"
	cd "$PROJECT_DIR/player" || exit 0
	node_modules/.bin/prettier --write --log-level=silent "$FILE_IN_PLAYER" >/dev/null 2>&1
	if ! OUTPUT="$(node_modules/.bin/eslint --fix "$FILE_IN_PLAYER" 2>&1)"; then
		report "ESLint (player) errors in $REL:$OUTPUT"
	fi
	;;
blocks/*/src/*.js | blocks/*/src/*.jsx)
	BLOCK="${REL#blocks/}"
	BLOCK="${BLOCK%%/*}"
	FILE_IN_BLOCK="${REL#blocks/"$BLOCK"/}"
	cd "$PROJECT_DIR/blocks/$BLOCK" || exit 0
	if ! OUTPUT="$(node_modules/.bin/wp-scripts lint-js --fix "$FILE_IN_BLOCK" 2>&1)"; then
		report "ESLint (blocks/$BLOCK) errors in $REL:$OUTPUT"
	fi
	;;
*.js | *.mjs | *.ts)
	cd "$PROJECT_DIR" || exit 0
	if ! OUTPUT="$(node_modules/.bin/eslint --fix "$REL" 2>&1)"; then
		report "ESLint errors in $REL:$OUTPUT"
	fi
	;;
esac
exit 0
