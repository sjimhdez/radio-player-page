#!/usr/bin/env bash
# PreToolUse Edit|Write: generated and vendored files cannot be edited by hand.

for path in player/dist/manifest.json player/dist/radio-player-page-3.4.2.min.js \
	blocks/schedule/build/index.js blocks/now-playing/build/index.asset.php \
	vendor/autoload.php node_modules/x/index.js player/node_modules/react/index.js; do
	run_hook protect-generated.sh "$(edit_json "$ROOT/$path")"
	if [ "$CODE" -eq 2 ] && [ -n "$ERR" ]; then ok "blocks $path"; else ko "blocks $path" "code=$CODE"; fi
done

run_hook protect-generated.sh "$(edit_json "$ROOT/player/dist/manifest.json")"
if echo "$ERR" | grep -q 'npm --prefix player run build'; then ok "says how to regenerate player/dist"; else ko "says how to regenerate player/dist" "$ERR"; fi
run_hook protect-generated.sh "$(edit_json "$ROOT/blocks/schedule/build/index.js")"
if echo "$ERR" | grep -q 'npm --prefix blocks/schedule run build'; then ok "says how to regenerate a block build"; else ko "says how to regenerate a block build" "$ERR"; fi

for path in player/src/main.tsx blocks/schedule/src/index.js blocks/schedule/render.php includes/radplapag-stations.php docs/status.md; do
	run_hook protect-generated.sh "$(edit_json "$ROOT/$path")"
	if [ "$CODE" -eq 0 ]; then ok "allows $path"; else ko "allows $path" "code=$CODE $ERR"; fi
done

run_hook protect-generated.sh "$(edit_json "/elsewhere/player/dist/x.js")"
if [ "$CODE" -eq 0 ]; then ok "ignores files outside the project"; else ko "ignores files outside the project"; fi

run_hook protect-generated.sh '{"tool_input":{}}'
if [ "$CODE" -eq 0 ]; then ok "ignores input without file_path"; else ko "ignores input without file_path"; fi
