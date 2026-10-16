#!/usr/bin/env bash
# Helpers shared by tests/hooks/*.test.sh (sourced by run.sh).

ok() {
	PASS=$((PASS + 1))
	echo "  ✓ $1"
}

ko() {
	FAIL=$((FAIL + 1))
	echo "  ✗ $1"
	if [ -n "${2:-}" ]; then
		echo "$2" | sed 's/^/      /'
	fi
}

# run_hook HOOK JSON [PROJECT_DIR] → sets CODE, OUT, ERR.
run_hook() {
	local hook="$1" json="$2" project="${3:-$ROOT}"
	OUT="$(echo "$json" | CLAUDE_PROJECT_DIR="$project" bash "$HOOKS/$hook" 2>"$TMP/stderr")"
	CODE=$?
	ERR="$(cat "$TMP/stderr")"
}

# edit_json PATH → PreToolUse/PostToolUse input for an Edit of PATH.
edit_json() {
	jq -n --arg p "$1" '{hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: {file_path: $p}}'
}

# new_repo DIR → empty git repository with one commit.
new_repo() {
	mkdir -p "$1"
	git -C "$1" init -q
	git -C "$1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init
}
