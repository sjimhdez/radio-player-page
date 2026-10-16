#!/usr/bin/env bash
# Stop: if the turn changed something, rebuild what is generated and run the fast
# checks of the touched areas; a failure keeps Claude working, up to a cap.

REPO="$TMP/stop-repo"
new_repo "$REPO"
SESSION="hooktest-$$-$RANDOM"
stop_json() {
	jq -n --arg s "$SESSION" --argjson active "${1:-false}" '{hook_event_name: "Stop", session_id: $s, stop_hook_active: $active}'
}

run_hook verify-before-stop.sh "$(stop_json)" "$REPO"
if [ "$CODE" -eq 0 ] && [ -z "$OUT" ]; then ok "does nothing without changes"; else ko "does nothing without changes" "$OUT $ERR"; fi

echo "notes" >"$REPO/README.md"
run_hook verify-before-stop.sh "$(stop_json)" "$REPO"
if [ "$CODE" -eq 0 ] && [ -z "$OUT" ]; then ok "passes when no checked area changed"; else ko "passes when no checked area changed" "$OUT $ERR"; fi

# A PHP unit test without vendor/ cannot run: the check fails.
mkdir -p "$REPO/tests/php/unit" && printf '<?php\n' >"$REPO/tests/php/unit/XTest.php"
run_hook verify-before-stop.sh "$(stop_json)" "$REPO"
if [ "$CODE" -eq 0 ] && echo "$OUT" | jq -e '.decision == "block" and (.reason | contains("PHPUnit unit"))' >/dev/null; then
	ok "blocks the stop when a check fails"
else
	ko "blocks the stop when a check fails" "$OUT $ERR"
fi

printf '<?php\nfunction (\n' >"$REPO/broken.php"
run_hook verify-before-stop.sh "$(stop_json true)" "$REPO"
if echo "$OUT" | jq -e '.reason | contains("broken.php")' >/dev/null; then ok "lints changed PHP files"; else ko "lints changed PHP files" "$OUT"; fi

run_hook verify-before-stop.sh "$(stop_json true)" "$REPO"
run_hook verify-before-stop.sh "$(stop_json true)" "$REPO"
if [ "$CODE" -eq 0 ] && echo "$OUT" | jq -e 'has("systemMessage") and (has("decision") | not)' >/dev/null; then
	ok "lets the turn end after 3 blocked attempts"
else
	ko "lets the turn end after 3 blocked attempts" "$OUT"
fi

rm -f "$REPO/broken.php" "$REPO/tests/php/unit/XTest.php"
run_hook verify-before-stop.sh "$(stop_json)" "$REPO"
if [ "$CODE" -eq 0 ] && [ -z "$OUT" ]; then ok "resets the cap once the checks pass"; else ko "resets the cap once the checks pass" "$OUT"; fi
rm -f "${TMPDIR:-/tmp}/radplapag-stop-$SESSION"
