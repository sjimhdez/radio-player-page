#!/bin/bash

# Build Release Zip - Radio Player Page
# Builds a zip containing only the files needed to install the plugin
# in a real environment (plugin PHP + built player assets).
#
# Usage: ./scripts/build-release-zip.sh [--build] [--output DIR|FILE]
#   --build   Run 'npm run build' in player/ if dist/ is missing or empty
#   --output  Zip path (directory or full path). Default: current working directory.

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Plugin directory (project root)
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLAYER_DIR="$PLUGIN_DIR/player"
DIST_SOURCE="$PLAYER_DIR/dist"
STAGING_DIR=""
OUTPUT_ZIP=""
RUN_BUILD=false

# Plugin name (must match directory under wp-content/plugins/)
PLUGIN_SLUG="radio-player-page"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            RUN_BUILD=true
            shift
            ;;
        --output)
            OUTPUT_ZIP="$2"
            shift 2
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Zip filename: radio-player-page-{VERSION}.zip (e.g. radio-player-page-3.1.0.zip)
VERSION=$(grep "Version:" "$PLUGIN_DIR/radio-player-page.php" | head -1 | sed 's/.*Version:[[:space:]]*\([0-9][0-9.]*\).*/\1/' | tr -d '[:space:]')
[ -z "$VERSION" ] && VERSION="unknown"
ZIP_BASENAME="${PLUGIN_SLUG}-${VERSION}.zip"

# Default zip path: current working directory
if [ -z "$OUTPUT_ZIP" ]; then
    OUTPUT_ZIP="$(pwd)/${ZIP_BASENAME}"
elif [ -d "$OUTPUT_ZIP" ]; then
    OUTPUT_ZIP="$OUTPUT_ZIP/${ZIP_BASENAME}"
fi

echo -e "${YELLOW}Building installation zip: ${PLUGIN_SLUG}${NC}"

# Check that player/dist exists with manifest
if [ ! -f "$DIST_SOURCE/manifest.json" ]; then
    if [ "$RUN_BUILD" = true ]; then
        echo -e "${YELLOW}player/dist not found. Running player build...${NC}"
        (cd "$PLAYER_DIR" && npm ci --no-audit --no-fund && npm run build)
    else
        echo -e "${RED}Error: $DIST_SOURCE/manifest.json does not exist.${NC}"
        echo "Run 'npm run build' in player/ first, or use --build."
        exit 1
    fi
fi

if [ ! -f "$DIST_SOURCE/manifest.json" ]; then
    echo -e "${RED}Error: build did not produce manifest.json in player/dist${NC}"
    exit 1
fi

# Staging directory for packaging
STAGING_DIR=$(mktemp -d "${TMPDIR:-/tmp}/${PLUGIN_SLUG}-zip.XXXXXX")
trap 'rm -rf "$STAGING_DIR"' EXIT

RELEASE_ROOT="$STAGING_DIR/$PLUGIN_SLUG"
mkdir -p "$RELEASE_ROOT"

# Copy only production files
echo "Including production files..."

copy_file() {
	local src="$1"
	local dest="$2"
	if [ ! -f "$src" ]; then
		echo -e "${RED}Error: required file not found: $src${NC}"
		exit 1
	fi
	cp "$src" "$dest"
}

copy_dir() {
	local src="$1"
	local dest="$2"
	if [ ! -d "$src" ]; then
		echo -e "${RED}Error: required directory not found: $src${NC}"
		exit 1
	fi
	cp -R "$src" "$dest"
}

# Root plugin files used by WordPress/plugin bootstrap.
copy_file "$PLUGIN_DIR/radio-player-page.php" "$RELEASE_ROOT/"
copy_file "$PLUGIN_DIR/readme.txt" "$RELEASE_ROOT/"
copy_file "$PLUGIN_DIR/uninstall.php" "$RELEASE_ROOT/"

# Runtime PHP (core logic + admin + migrations + data classes).
copy_dir "$PLUGIN_DIR/includes" "$RELEASE_ROOT/"
copy_dir "$PLUGIN_DIR/admin" "$RELEASE_ROOT/"

# Dynamic Gutenberg blocks and their compiled editor assets.
mkdir -p "$RELEASE_ROOT/blocks"
for block in schedule programs-list; do
	BLOCK_SOURCE="$PLUGIN_DIR/blocks/$block"
	BLOCK_TARGET="$RELEASE_ROOT/blocks/$block"

	if [ ! -d "$BLOCK_SOURCE" ]; then
		echo -e "${RED}Error: required block directory not found: $BLOCK_SOURCE${NC}"
		exit 1
	fi

	mkdir -p "$BLOCK_TARGET"
	copy_file "$BLOCK_SOURCE/block.json" "$BLOCK_TARGET/"
	copy_file "$BLOCK_SOURCE/render.php" "$BLOCK_TARGET/"
	copy_dir "$BLOCK_SOURCE/build" "$BLOCK_TARGET/"
done

# Built player assets (manifest + JS/CSS/chunks).
mkdir -p "$RELEASE_ROOT/player"
copy_dir "$DIST_SOURCE" "$RELEASE_ROOT/player/"

# Create zip (root directory = plugin name)
(cd "$STAGING_DIR" && zip -r -q "$OUTPUT_ZIP" "$PLUGIN_SLUG")

echo -e "${GREEN}Zip created: $OUTPUT_ZIP${NC}"
echo ""
echo "Zip contents:"
unzip -l "$OUTPUT_ZIP" | head -30
echo "  ..."
echo ""
echo "To install: Upload the zip in WordPress (Plugins > Add New > Upload Plugin)."
