#!/usr/bin/env bash
# Release zip guard (spec 0001, phase 1):
#   1. the zip built from the working tree lists exactly the same files as the
#      zip built from tag v3.4.2 plus the ones declared in
#      tests/zip/expected-additions.txt (spec 0005 §4.5, ADR 0028);
#   2. no development path ever ends up in the zip.
# Player asset names are compared without their version (asset-name.sh, spec
# 0014 R8), so a release that only renames them passes.
# The reference tag (REFERENCE_TAG) does not move in the release itself: the
# first spec after a release points it at the new tag, renames this script and
# empties the additions list (release skill, section 2).
set -euo pipefail

REFERENCE_TAG="${REFERENCE_TAG:-v3.4.2}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=tests/zip/asset-name.sh
. "$ROOT/tests/zip/asset-name.sh"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/radplapag-zip-check.XXXXXX")"
cleanup() {
	git -C "$ROOT" worktree remove --force "$WORK/ref" >/dev/null 2>&1 || true
	rm -rf "$WORK"
}
trap cleanup EXIT

list_zip() {
	# Paths inside the zip relative to the plugin root, sorted.
	unzip -Z1 "$1" | grep -v '/$' | sed 's|^radio-player-page/||' | LC_ALL=C sort
}

# Current tree.
bash "$ROOT/scripts/build-release-zip.sh" --output "$WORK/current.zip" >/dev/null
list_zip "$WORK/current.zip" >"$WORK/current.txt"

# Reference tag, built with its own script in a temporary worktree.
git -C "$ROOT" worktree add --detach --quiet "$WORK/ref" "$REFERENCE_TAG"
bash "$WORK/ref/scripts/build-release-zip.sh" --output "$WORK/reference.zip" >/dev/null
list_zip "$WORK/reference.zip" >"$WORK/reference.txt"

status=0

if ! bash "$ROOT/tests/zip/compare-lists.sh" "$WORK/reference.txt" "$WORK/current.txt" \
	"$ROOT/tests/zip/expected-additions.txt" >"$WORK/diff.txt"; then
	echo "Zip file list differs from $REFERENCE_TAG + tests/zip/expected-additions.txt:"
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

# Bundled third-party license notices must survive minification (spec 0003,
# task 1.6): each player script keeps at least as many as its pair, by
# version-normalized name, in the reference.
LEGAL='@license|/\*!'
for ref_file in "$WORK/ref/player/dist/"*.js; do
	name="$(basename "$ref_file")"
	if ! cur_file="$(radplapag_matching_asset "$ROOT/player/dist" "$name")"; then
		echo "player/dist/$name: no script with the same name, any version, in the working tree."
		status=1
		continue
	fi
	ref_count="$(grep -cE "$LEGAL" "$ref_file" || true)"
	cur_count="$(grep -cE "$LEGAL" "$cur_file" || true)"
	if [ "${cur_count:-0}" -lt "$ref_count" ]; then
		echo "player/dist/$(basename "$cur_file"): $cur_count license notices, $ref_count in $REFERENCE_TAG ($name)."
		status=1
	fi
done

if [ "$status" -eq 0 ]; then
	echo "Zip OK: $(wc -l <"$WORK/current.txt" | tr -d ' ') files, same list as $REFERENCE_TAG + declared additions, no development paths, license notices kept."
fi
exit "$status"
