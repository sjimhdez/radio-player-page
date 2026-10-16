#!/usr/bin/env bash
# Release zip guard (spec 0001, phase 1):
#   1. the zip built from the working tree lists exactly the same files as the
#      zip built from tag v3.4.2 (the bootstrap must not change what ships);
#   2. no development path ever ends up in the zip.
# Once a release legitimately changes the file list, the reference tag moves
# with it (REFERENCE_TAG).
set -euo pipefail

REFERENCE_TAG="${REFERENCE_TAG:-v3.4.2}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/radplapag-zip-check.XXXXXX")"
cleanup() {
	git -C "$ROOT" worktree remove --force "$WORK/ref" >/dev/null 2>&1 || true
	rm -rf "$WORK"
}
trap cleanup EXIT

list_zip() {
	# Paths inside the zip, without the version-dependent zip name, sorted.
	unzip -Z1 "$1" | grep -v '/$' | LC_ALL=C sort
}

# Current tree.
bash "$ROOT/scripts/build-release-zip.sh" --output "$WORK/current.zip" >/dev/null
list_zip "$WORK/current.zip" >"$WORK/current.txt"

# Reference tag, built with its own script in a temporary worktree.
git -C "$ROOT" worktree add --detach --quiet "$WORK/ref" "$REFERENCE_TAG"
bash "$WORK/ref/scripts/build-release-zip.sh" --output "$WORK/reference.zip" >/dev/null
list_zip "$WORK/reference.zip" >"$WORK/reference.txt"

status=0

if ! diff -u "$WORK/reference.txt" "$WORK/current.txt" >"$WORK/diff.txt"; then
	echo "Zip file list differs from $REFERENCE_TAG:"
	cat "$WORK/diff.txt"
	status=1
fi

# Development paths that must never ship (spec 0001 §9).
FORBIDDEN='(^|/)(CLAUDE(\.local)?\.md|\.claude/|\.mcp\.json|docs/|SPEC\.md|tests/|spike/|scripts/|composer\.(json|lock)|vendor/|node_modules/|package(-lock)?\.json|\.nvmrc|\.editorconfig|\.eslintrc[^/]*|eslint\.config\.[cm]?js|vitest\.config\.[cm]?[jt]s|playwright\.config\.ts|phpcs\.xml(\.dist)?|phpunit[^/]*\.xml(\.dist)?|\.wp-env[^/]*\.json|\.github/|\.git[^/]*)'
if grep -E "$FORBIDDEN" "$WORK/current.txt" >"$WORK/forbidden.txt"; then
	echo "Development paths found in the zip:"
	cat "$WORK/forbidden.txt"
	status=1
fi

if [ "$status" -eq 0 ]; then
	echo "Zip OK: $(wc -l <"$WORK/current.txt" | tr -d ' ') files, same list as $REFERENCE_TAG, no development paths."
fi
exit "$status"
