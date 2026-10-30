#!/usr/bin/env bash
# Tests for tests/zip/compare-lists.sh (ADR 0028, ADR 0075) and
# tests/zip/asset-name.sh.
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

# compare REFERENCE CURRENT ADDITIONS [REMOVALS] → sets CODE and OUT (stdout +
# stderr). Each argument is the file content, one path per line.
compare() {
	printf '%s' "$1" >"$TMP/reference.txt"
	printf '%s' "$2" >"$TMP/current.txt"
	printf '%s' "$3" >"$TMP/additions.txt"
	printf '%s' "${4:-}" >"$TMP/removals.txt"
	OUT="$(bash "$COMPARE" "$TMP/reference.txt" "$TMP/current.txt" "$TMP/additions.txt" "$TMP/removals.txt" 2>&1)"
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

compare "$REF" $'a.php\nreadme.txt\n' "" $'includes/b.php\n'
expect_pass "passes with the reference minus the declared removals"

compare "$REF" $'a.php\nincludes/c.php\nreadme.txt\n' $'includes/c.php\n' \
	$'# Renamed.\n\nincludes/b.php\n'
expect_pass "passes with a declared removal and its renamed addition"

compare "$REF" "$REF" "" $'includes/c.php\n'
expect_fail "fails when a declared removal is not in the reference" "includes/c.php"

compare "$REF" $'a.php\nreadme.txt\n' "" $'includes/b.php\nincludes/b.php\n'
expect_fail "fails on a duplicated removal" "includes/b.php"

compare "$REF" "$REF" "" $'includes/b.php\n'
expect_fail "fails when a declared removal is still in the zip" "includes/b.php"

compare "$REF" "$REF" ""
if [ -z "$OUT" ]; then ok "prints nothing when the lists match"; else ko "prints nothing when the lists match" "$OUT"; fi

bash "$COMPARE" "$TMP/reference.txt" >/dev/null 2>&1
if [ $? -eq 2 ]; then ok "exits 2 on wrong usage"; else ko "exits 2 on wrong usage"; fi

bash "$COMPARE" "$TMP/reference.txt" "$TMP/current.txt" "$TMP/additions.txt" >/dev/null 2>&1
if [ $? -eq 2 ]; then ok "exits 2 without the removals"; else ko "exits 2 without the removals"; fi

bash "$COMPARE" "$TMP/reference.txt" "$TMP/current.txt" "$TMP/additions.txt" "$TMP/removals.txt" \
	"$TMP/removals.txt" >/dev/null 2>&1
if [ $? -eq 2 ]; then ok "exits 2 with an extra argument"; else ko "exits 2 with an extra argument"; fi

bash "$COMPARE" "$TMP/reference.txt" "$TMP/current.txt" "$TMP/nope.txt" "$TMP/removals.txt" >/dev/null 2>&1
if [ $? -eq 2 ]; then ok "exits 2 when a file does not exist"; else ko "exits 2 when a file does not exist"; fi

# Player assets carry the plugin version in their names.
PLAYER_REF=$'player/dist/manifest.json\nplayer/dist/radio-player-page-3.4.2-hls.min.js\nplayer/dist/radio-player-page-3.4.2.css\nplayer/dist/radio-player-page-3.4.2.min.js\nreadme.txt\n'

compare "$PLAYER_REF" \
	$'player/dist/manifest.json\nplayer/dist/radio-player-page-3.5.0-hls.min.js\nplayer/dist/radio-player-page-3.5.0.css\nplayer/dist/radio-player-page-3.5.0.min.js\nreadme.txt\n' ""
expect_pass "passes when only the version of the player assets changes"

compare "$PLAYER_REF" \
	$'player/dist/manifest.json\nplayer/dist/radio-player-page-3.5.0.css\nplayer/dist/radio-player-page-3.5.0.min.js\nreadme.txt\n' ""
expect_fail "still fails when a player asset with another version is missing" "radio-player-page-{VERSION}-hls.min.js"

compare "$PLAYER_REF" \
	$'player/dist/manifest.json\nplayer/dist/radio-player-page-3.5.0-dash.min.js\nplayer/dist/radio-player-page-3.5.0-hls.min.js\nplayer/dist/radio-player-page-3.5.0.css\nplayer/dist/radio-player-page-3.5.0.min.js\nreadme.txt\n' ""
expect_fail "still fails when there is an extra player asset" "radio-player-page-{VERSION}-dash.min.js"

compare "$PLAYER_REF" \
	$'player/dist/manifest.json\nplayer/dist/radio-player-page-3.4.2-hls.min.js\nplayer/dist/radio-player-page-3.5.0-hls.min.js\nplayer/dist/radio-player-page-3.5.0.css\nplayer/dist/radio-player-page-3.5.0.min.js\nreadme.txt\n' ""
expect_fail "fails when the same player asset ships with two versions" "radio-player-page-{VERSION}-hls.min.js"

compare $'a.php\nradio-player-page-3.4.2.css\nplayer/src/radio-player-page-3.4.2.ts\n' \
	$'a.php\nradio-player-page-3.5.0.css\nplayer/src/radio-player-page-3.5.0.ts\n' ""
expect_fail "does not normalize outside player/dist/" "radio-player-page-3.5.0.css"

# shellcheck source=tests/zip/asset-name.sh
. "$ROOT/tests/zip/asset-name.sh"

echo
echo "asset-name.sh"

mkdir -p "$TMP/dist"
touch "$TMP/dist/radio-player-page-3.5.0-hls.min.js" "$TMP/dist/radio-player-page-3.5.0.min.js"

match="$(radplapag_matching_asset "$TMP/dist" radio-player-page-3.4.2-hls.min.js)"
if [ "$match" = "$TMP/dist/radio-player-page-3.5.0-hls.min.js" ]; then
	ok "pairs a reference asset with the current one of another version"
else
	ko "pairs a reference asset with the current one of another version" "got: $match"
fi

match="$(radplapag_matching_asset "$TMP/dist" radio-player-page-3.4.2.min.js)"
if [ "$match" = "$TMP/dist/radio-player-page-3.5.0.min.js" ]; then
	ok "does not pair the main script with a chunk"
else
	ko "does not pair the main script with a chunk" "got: $match"
fi

if radplapag_matching_asset "$TMP/dist" radio-player-page-3.4.2-dash-all-min.min.js >/dev/null; then
	ko "fails when the reference asset has no pair"
else
	ok "fails when the reference asset has no pair"
fi

echo
echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
