#!/usr/bin/env bash
# Runs every tests/hooks/*.test.sh against .claude/hooks/ (spec 0001 §7.4).
# Usage: npm run test:hooks [-- <name>]   e.g. npm run test:hooks -- session-context
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HOOKS="$ROOT/.claude/hooks"
PASS=0
FAIL=0
TMP="$(mktemp -d "${TMPDIR:-/tmp}/radplapag-hook-tests.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

# shellcheck source=tests/hooks/lib.sh
. "$ROOT/tests/hooks/lib.sh"

for test_file in "$ROOT"/tests/hooks/${1:-*}.test.sh; do
	echo "$(basename "$test_file" .test.sh).sh"
	# shellcheck source=/dev/null
	. "$test_file"
done

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
