#!/usr/bin/env bash
# PreToolUse (Edit|Write): generated and vendored files are never edited by hand
# (spec 0001 §7.4). Exit 2 + stderr blocks the edit and tells Claude what to do.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
FILE_PATH="$(jq -r '.tool_input.file_path // empty')"
[ -z "$FILE_PATH" ] && exit 0

case "$FILE_PATH" in
"$PROJECT_DIR"/*) REL="${FILE_PATH#"$PROJECT_DIR"/}" ;;
*) exit 0 ;;
esac

block() {
	echo "Blocked: $1" >&2
	exit 2
}

case "$REL" in
node_modules/* | */node_modules/*)
	block "node_modules/ is managed by npm. Change package.json and run npm install in that project."
	;;
vendor/*)
	block "vendor/ is managed by Composer (composer install / composer require --dev)."
	;;
player/dist/*)
	block "player/dist/ is generated. Edit player/src/ and run: npm --prefix player run build (the Stop hook also rebuilds)."
	;;
blocks/*/build/*)
	BLOCK="${REL#blocks/}"
	BLOCK="${BLOCK%%/*}"
	block "blocks/$BLOCK/build/ is generated. Edit blocks/$BLOCK/src/ and run: npm --prefix blocks/$BLOCK run build (the Stop hook also rebuilds)."
	;;
esac
exit 0
