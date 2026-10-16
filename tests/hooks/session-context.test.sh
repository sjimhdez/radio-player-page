#!/usr/bin/env bash
# SessionStart: a new session receives docs/status.md and the repository state.

run_hook session-context.sh '{"hook_event_name":"SessionStart","source":"startup"}'
CTX="$(echo "$OUT" | jq -r '.hookSpecificOutput.additionalContext // empty' 2>/dev/null)"
EVENT="$(echo "$OUT" | jq -r '.hookSpecificOutput.hookEventName // empty' 2>/dev/null)"

if [ "$CODE" -eq 0 ] && [ "$EVENT" = "SessionStart" ]; then ok "emits SessionStart JSON"; else ko "emits SessionStart JSON" "code=$CODE $OUT $ERR"; fi

STATUS="$(cat "$ROOT/docs/status.md")"
case "$CTX" in
"$STATUS"*) ok "starts with docs/status.md verbatim" ;;
*) ko "starts with docs/status.md verbatim" "$CTX" ;;
esac

if echo "$CTX" | grep -q '^Branch: ' && echo "$CTX" | grep -q '^wp-env: '; then ok "includes branch and wp-env state"; else ko "includes branch and wp-env state" "$CTX"; fi

if echo "$CTX" | grep -Eq '^Active spec: docs/specs/[0-9]{4}-[a-z0-9-]+/spec\.md$'; then ok "points to the active spec file"; else ko "points to the active spec file" "$CTX"; fi

new_repo "$TMP/no-status"
run_hook session-context.sh '{}' "$TMP/no-status"
if [ "$CODE" -eq 0 ] && echo "$OUT" | jq -e '.hookSpecificOutput.additionalContext | contains("docs/status.md does not exist")' >/dev/null; then
	ok "works without docs/status.md"
else
	ko "works without docs/status.md" "$OUT $ERR"
fi
