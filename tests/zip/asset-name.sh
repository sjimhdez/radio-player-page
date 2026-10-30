#!/usr/bin/env bash
# Player asset names carry the plugin version (radio-player-page-<x.y.z>…), so
# a release renames every file under player/dist/. The zip guard compares those
# names with the version replaced by {VERSION} (spec 0014, R8).
# Sourced by compare-lists.sh, compare-with-v3.5.0.sh and their tests.

# Reads paths relative to the plugin root on stdin and prints them with the
# version of the player assets replaced. Other paths are left as they are.
radplapag_normalize_asset_paths() {
	sed -E 's#^player/dist/radio-player-page-[0-9]+\.[0-9]+\.[0-9]+#player/dist/radio-player-page-{VERSION}#'
}

# Usage: radplapag_matching_asset <dir> <name>
# Prints the path of the file in <dir> whose normalized name matches <name>, a
# player/dist/ file name of any version. Exits 1 when there is none.
radplapag_matching_asset() {
	local want candidate
	want="$(printf 'player/dist/%s\n' "$2" | radplapag_normalize_asset_paths)"
	for candidate in "$1"/*; do
		[ -f "$candidate" ] || continue
		if [ "$(printf 'player/dist/%s\n' "$(basename "$candidate")" | radplapag_normalize_asset_paths)" = "$want" ]; then
			printf '%s\n' "$candidate"
			return 0
		fi
	done
	return 1
}
