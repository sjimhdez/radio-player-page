#!/usr/bin/env bash
# SessionStart (startup, resume, clear, compact): gives the session the project's
# working memory, docs/status.md, plus the active spec, branch, uncommitted changes
# and whether the wp-env sites answer (spec 0001 §7.4). Output: additionalContext.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
cd "$PROJECT_DIR" || exit 0

STATUS_FILE="docs/status.md"
if [ -f "$STATUS_FILE" ]; then
	STATUS="$(cat "$STATUS_FILE")"
	# "Spec activa: NNNN — …" → docs/specs/NNNN-*/spec.md
	SPEC_NUMBER="$(sed -n 's/^Spec activa: \([0-9]\{4\}\).*/\1/p' "$STATUS_FILE" | head -1)"
	SPEC_FILE="$(ls -d docs/specs/"${SPEC_NUMBER:-none}"-*/spec.md 2>/dev/null | head -1)"
else
	STATUS="(docs/status.md does not exist: start with the active spec in docs/specs/README.md)"
	SPEC_FILE=""
fi

BRANCH="$(git branch --show-current 2>/dev/null)"
CHANGES="$(git status --short 2>/dev/null)"
CHANGE_COUNT="$(printf '%s' "$CHANGES" | grep -c . || true)"
[ -z "$CHANGES" ] && CHANGES="(clean)"

site_state() {
	if curl -s -o /dev/null --max-time 1 "http://localhost:$1"; then echo "up"; else echo "down"; fi
}
WP_ENV="dev :8886 $(site_state 8886) · tests :8890 $(site_state 8890) (npm run env:start, npm run env:start:min|latest)"

CONTEXT="$(printf '%s\n\n## Repository\nActive spec: %s\nBranch: %s\nwp-env: %s\nUncommitted changes (%s):\n%s\n' \
	"$STATUS" "${SPEC_FILE:-(none)}" "${BRANCH:-(detached)}" "$WP_ENV" "$CHANGE_COUNT" "$(printf '%s\n' "$CHANGES" | head -20)")"

jq -n --arg ctx "$CONTEXT" '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
