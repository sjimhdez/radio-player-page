#!/usr/bin/env bash
# Compares the zip file list with the reference list minus the declared
# removals plus the declared additions (ADR 0028, ADR 0075).
# Usage: compare-lists.sh <reference> <current> <additions> <removals>
#   Each file holds one path per line; in <additions> and <removals>, blank
#   lines and lines starting with # are ignored. Passes only when <current> is
#   exactly <reference> - <removals> + <additions>, no addition is already in
#   <reference>, every removal is in <reference> and not in <current>, and
#   nothing is declared twice. Prints the problems and exits 1 otherwise;
#   exits 2 on wrong usage. The version in the names of the player assets is
#   ignored (asset-name.sh): problems print those names with {VERSION}.
set -euo pipefail

# shellcheck source=tests/zip/asset-name.sh
. "$(dirname "$0")/asset-name.sh"

if [ "$#" -ne 4 ]; then
	echo "Usage: $0 <reference> <current> <additions> <removals>" >&2
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
clean "$4" >"$WORK/removals.txt"

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

duplicated="$(uniq -d "$WORK/removals.txt")"
if [ -n "$duplicated" ]; then
	echo "Removals declared more than once:"
	echo "$duplicated"
	status=1
fi

unknown="$(LC_ALL=C comm -13 "$WORK/reference.txt" <(uniq "$WORK/removals.txt"))"
if [ -n "$unknown" ]; then
	echo "Removals not in the reference list:"
	echo "$unknown"
	status=1
fi

kept="$(LC_ALL=C comm -12 "$WORK/current.txt" <(uniq "$WORK/removals.txt"))"
if [ -n "$kept" ]; then
	echo "Removals still in the zip:"
	echo "$kept"
	status=1
fi

LC_ALL=C comm -23 "$WORK/reference.txt" <(uniq "$WORK/removals.txt") \
	| LC_ALL=C sort -u - "$WORK/additions.txt" >"$WORK/expected.txt"

missing="$(LC_ALL=C comm -23 "$WORK/expected.txt" "$WORK/current.txt")"
if [ -n "$missing" ]; then
	echo "Missing from the zip (in the reference or declared as additions; declare removed files in tests/zip/expected-removals.txt):"
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
