#!/usr/bin/env bash
# Compares the zip file list with the reference list plus the declared
# additions (spec 0005 §4.5, ADR 0028).
# Usage: compare-lists.sh <reference> <current> <additions>
#   Each file holds one path per line; in <additions>, blank lines and lines
#   starting with # are ignored. Passes only when <current> is exactly
#   <reference> + <additions>, and no addition is already in <reference> or
#   declared twice. Prints the problems and exits 1 otherwise; exits 2 on
#   wrong usage. The version in the names of the player assets is ignored
#   (asset-name.sh, spec 0014 R8): problems print those names with {VERSION}.
set -euo pipefail

# shellcheck source=tests/zip/asset-name.sh
. "$(dirname "$0")/asset-name.sh"

if [ "$#" -ne 3 ]; then
	echo "Usage: $0 <reference> <current> <additions>" >&2
	exit 2
fi
for file in "$@"; do
	if [ ! -f "$file" ]; then
		echo "$0: $file not found" >&2
		exit 2
	fi
done

WORK="$(mktemp -d "${TMPDIR:-/tmp}/radplapag-zip-compare.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

clean() {
	# Non-empty, non-comment lines, version-normalized and sorted.
	{ grep -vE '^[[:space:]]*(#|$)' "$1" || true; } | radplapag_normalize_asset_paths | LC_ALL=C sort
}

clean "$1" >"$WORK/reference.txt"
clean "$2" >"$WORK/current.txt"
clean "$3" >"$WORK/additions.txt"

status=0

duplicated="$(uniq -d "$WORK/additions.txt")"
if [ -n "$duplicated" ]; then
	echo "Additions declared more than once:"
	echo "$duplicated"
	status=1
fi

already="$(LC_ALL=C comm -12 "$WORK/reference.txt" <(uniq "$WORK/additions.txt"))"
if [ -n "$already" ]; then
	echo "Additions already in the reference list:"
	echo "$already"
	status=1
fi

LC_ALL=C sort -u "$WORK/reference.txt" "$WORK/additions.txt" >"$WORK/expected.txt"

missing="$(LC_ALL=C comm -23 "$WORK/expected.txt" "$WORK/current.txt")"
if [ -n "$missing" ]; then
	echo "Missing from the zip (in the reference or declared as additions):"
	echo "$missing"
	status=1
fi

extra="$(LC_ALL=C comm -13 "$WORK/expected.txt" "$WORK/current.txt")"
if [ -n "$extra" ]; then
	echo "Not expected in the zip (declare new files in tests/zip/expected-additions.txt):"
	echo "$extra"
	status=1
fi

exit "$status"
