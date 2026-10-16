#!/usr/bin/env bash
# PostToolUse Edit|Write: formats only the edited file, with the tools of the
# project it belongs to, and reports what cannot be fixed.

SCRATCH_DIRS=( "$ROOT/.hook-test-$$" "$ROOT/player/src/__hook-test-$$" "$ROOT/blocks/schedule/src/__hook-test-$$" "$ROOT/tests/js/__hook-test-$$" )
mkdir -p "${SCRATCH_DIRS[@]}"
trap 'rm -rf "$TMP" "${SCRATCH_DIRS[@]}"' EXIT
SCRATCH="${SCRATCH_DIRS[0]}"

# PHP: syntax errors go back to Claude.
printf '<?php\nfunction (\n' >"$SCRATCH/broken.php"
run_hook format-edited-file.sh "$(edit_json "$SCRATCH/broken.php")"
if [ "$CODE" -eq 0 ] && echo "$OUT" | jq -e '.decision == "block" and (.reason | test("(?i)parse error|syntax error"))' >/dev/null; then
	ok "reports PHP syntax errors"
else
	ko "reports PHP syntax errors" "$OUT $ERR"
fi

# PHP: a legacy file is not reformatted (phpcbf stays off until spec 0002).
LEGACY="$ROOT/includes/radplapag-upgrade.php"
BEFORE="$(shasum "$LEGACY")"
run_hook format-edited-file.sh "$(edit_json "$LEGACY")"
if [ "$CODE" -eq 0 ] && [ -z "$OUT" ] && [ "$(shasum "$LEGACY")" = "$BEFORE" ]; then
	ok "leaves a valid legacy PHP file untouched"
else
	ko "leaves a valid legacy PHP file untouched" "$OUT"
fi

# Player (its own Prettier + ESLint).
printf "const value = {a:1}\nexport default value\n" >"${SCRATCH_DIRS[1]}/sample.ts"
run_hook format-edited-file.sh "$(edit_json "${SCRATCH_DIRS[1]}/sample.ts")"
if [ "$CODE" -eq 0 ] && [ -z "$OUT" ] && grep -q 'const value = { a: 1 }$' "${SCRATCH_DIRS[1]}/sample.ts"; then
	ok "formats player TypeScript with the player's Prettier"
else
	ko "formats player TypeScript with the player's Prettier" "$OUT $(cat "${SCRATCH_DIRS[1]}/sample.ts")"
fi

# WordPress side (root ESLint with wp-prettier).
printf "const value = {a:1};\nexport default value;\n" >"${SCRATCH_DIRS[3]}/sample.js"
run_hook format-edited-file.sh "$(edit_json "${SCRATCH_DIRS[3]}/sample.js")"
if [ "$CODE" -eq 0 ] && [ -z "$OUT" ] && grep -q 'const value = { a: 1 };' "${SCRATCH_DIRS[3]}/sample.js"; then
	ok "formats WordPress-side JS with the root ESLint"
else
	ko "formats WordPress-side JS with the root ESLint" "$OUT $(cat "${SCRATCH_DIRS[3]}/sample.js")"
fi

printf "undefinedFunction();\n" >"${SCRATCH_DIRS[3]}/broken.js"
run_hook format-edited-file.sh "$(edit_json "${SCRATCH_DIRS[3]}/broken.js")"
if [ "$CODE" -eq 0 ] && echo "$OUT" | jq -e '.decision == "block" and (.reason | contains("no-undef"))' >/dev/null; then
	ok "reports ESLint errors that --fix cannot solve"
else
	ko "reports ESLint errors that --fix cannot solve" "$OUT $ERR"
fi

# A block (its own @wordpress/scripts).
printf "const value = {a:1};\nexport default value;\n" >"${SCRATCH_DIRS[2]}/sample.js"
run_hook format-edited-file.sh "$(edit_json "${SCRATCH_DIRS[2]}/sample.js")"
if [ "$CODE" -eq 0 ] && [ -z "$OUT" ] && grep -q 'const value = { a: 1 };' "${SCRATCH_DIRS[2]}/sample.js"; then
	ok "formats block JS with the block's own tools"
else
	ko "formats block JS with the block's own tools" "$OUT $(cat "${SCRATCH_DIRS[2]}/sample.js")"
fi

# Ignored.
printf 'x' >"$SCRATCH/notes.txt"
run_hook format-edited-file.sh "$(edit_json "$SCRATCH/notes.txt")"
if [ "$CODE" -eq 0 ] && [ -z "$OUT" ]; then ok "ignores other file types"; else ko "ignores other file types" "$OUT"; fi
run_hook format-edited-file.sh "$(edit_json "$ROOT/player/dist/manifest.json")"
if [ "$CODE" -eq 0 ] && [ -z "$OUT" ]; then ok "ignores generated files"; else ko "ignores generated files" "$OUT"; fi
