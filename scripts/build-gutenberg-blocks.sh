#!/bin/bash

# Build Gutenberg Blocks - Radio Player Page
# Replicates the gutenberg-blocks job from .github/workflows/test.yml
#
# Usage: ./scripts/build-gutenberg-blocks.sh [--verify]
#   --verify  Fail if build/ differs from the committed output (matches CI)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLOCK_DIRS=(
	"blocks/schedule"
	"blocks/programs-list"
)
VERIFY=false

while [[ $# -gt 0 ]]; do
	case $1 in
		--verify)
			VERIFY=true
			shift
			;;
		*)
			echo -e "${RED}Unknown option: $1${NC}"
			echo "Usage: $0 [--verify]"
			exit 1
			;;
	esac
done

build_block() {
	local block_dir="$1"
	local block_path="$PLUGIN_DIR/$block_dir"

	if [ ! -d "$block_path" ]; then
		echo -e "${RED}Error: block directory not found at $block_path${NC}"
		return 1
	fi

	if [ ! -f "$block_path/package.json" ]; then
		echo -e "${RED}Error: package.json not found in $block_path${NC}"
		return 1
	fi

	echo -e "${YELLOW}Building $block_dir...${NC}"
	(
		cd "$block_path"
		npm ci --no-audit --no-fund
		npm run build
	)
	echo -e "${GREEN}$block_dir built successfully.${NC}"
}

echo -e "${YELLOW}Building Gutenberg blocks...${NC}"

for block_dir in "${BLOCK_DIRS[@]}"; do
	build_block "$block_dir"
done

if [ "$VERIFY" = true ]; then
	echo -e "${YELLOW}Verifying committed build output...${NC}"
	for block_dir in "${BLOCK_DIRS[@]}"; do
		if ! git diff --exit-code -- "$PLUGIN_DIR/$block_dir/build/"; then
			echo -e "${RED}$block_dir/build is out of date; commit the updated build output.${NC}"
			exit 1
		fi
	done
	echo -e "${GREEN}Committed build output is up to date.${NC}"
fi

echo -e "${GREEN}All Gutenberg blocks built successfully!${NC}"
