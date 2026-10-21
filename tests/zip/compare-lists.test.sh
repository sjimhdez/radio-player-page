#!/usr/bin/env bash
# Tests for tests/zip/compare-lists.sh (spec 0005, task 1.3).
# Usage: bash tests/zip/compare-lists.test.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPARE="$ROOT/tests/zip/compare-lists.sh"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/radplapag-zip-tests.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

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

# compare REFERENCE CURRENT ADDITIONS → sets CODE and OUT (stdout + stderr).
# Each argument is the file content, one path per line.
compare() {
	printf '%s' "$1" >"$TMP/reference.txt"
	printf '%s' "$2" >"$TMP/current.txt"
	printf '%s' "$3" >"$TMP/additions.txt"
	OUT="$(bash "$COMPARE" "$TMP/reference.txt" "$TMP/current.txt" "$TMP/additions.txt" 2>&1)"
	CODE=$?
}

# expect_pass NAME / expect_fail NAME [TEXT]: checks the last compare.
expect_pass() {
	if [ "$CODE" -eq 0 ]; then ok "$1"; else ko "$1" "code=$CODE $OUT"; fi
}

expect_fail() {
	if [ "$CODE" -ne 0 ] && { [ -z "${2:-}" ] || echo "$OUT" | grep -qF -- "$2"; }; then
		ok "$1"
	else
		ko "$1" "code=$CODE $OUT"
	fi
}

REF=$'a.php\nincludes/b.php\nreadme.txt\n'

echo "compare-lists.sh"

compare "$REF" "$REF" ""
expect_pass "passes when the lists match and there are no additions"

compare "$REF" $'readme.txt\na.php\nincludes/b.php\n' ""
expect_pass "ignores the order of the lists"

compare "$REF" $'a.php\nincludes/b.php\nincludes/src/c.php\nreadme.txt\n' $'includes/src/c.php\n'
expect_pass "passes with the reference plus the declared additions"

compare "$REF" $'a.php\nincludes/b.php\nincludes/src/c.php\nreadme.txt\n' \
	$'# New files under includes/src/.\n\nincludes/src/c.php\n'
expect_pass "ignores comments and blank lines in the additions"

compare "$REF" $'a.php\nincludes/b.php\nincludes/src/c.php\nreadme.txt\n' 'includes/src/c.php'
expect_pass "reads an additions file without a final newline"

compare "$REF" $'a.php\nincludes/b.php\nincludes/src/c.php\nreadme.txt\n' ""
expect_fail "fails on an undeclared new path" "includes/src/c.php"

compare "$REF" $'a.php\nreadme.txt\n' ""
expect_fail "fails when a reference path is missing" "includes/b.php"

compare "$REF" "$REF" $'includes/src/c.php\n'
expect_fail "fails when a declared addition is missing" "includes/src/c.php"

compare "$REF" "$REF" $'includes/b.php\n'
expect_fail "fails when a declared addition is already in the reference" "includes/b.php"

compare "$REF" $'a.php\nincludes/b.php\nincludes/src/c.php\nreadme.txt\n' \
	$'includes/src/c.php\nincludes/src/c.php\n'
expect_fail "fails on a duplicated addition" "includes/src/c.php"

compare "$REF" "$REF" ""
if [ -z "$OUT" ]; then ok "prints nothing when the lists match"; else ko "prints nothing when the lists match" "$OUT"; fi

bash "$COMPARE" "$TMP/reference.txt" >/dev/null 2>&1
if [ $? -eq 2 ]; then ok "exits 2 on wrong usage"; else ko "exits 2 on wrong usage"; fi

bash "$COMPARE" "$TMP/reference.txt" "$TMP/current.txt" "$TMP/nope.txt" >/dev/null 2>&1
if [ $? -eq 2 ]; then ok "exits 2 when a file does not exist"; else ko "exits 2 when a file does not exist"; fi

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
