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

# Zip filename: radio-player-page-{VERSION}.zip (e.g. radio-player-page-2.0.2.zip)
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

# Plugin PHP
cp "$PLUGIN_DIR/radio-player-page.php" "$RELEASE_ROOT/"
mkdir -p "$RELEASE_ROOT/includes"
cp "$PLUGIN_DIR/includes/radplapag-settings.php" "$RELEASE_ROOT/includes/"
mkdir -p "$RELEASE_ROOT/admin"
cp "$PLUGIN_DIR/admin/admin.php" "$RELEASE_ROOT/admin/"
cp "$PLUGIN_DIR/admin/sanitize-settings.php" "$RELEASE_ROOT/admin/"
cp "$PLUGIN_DIR/admin/settings-page.php" "$RELEASE_ROOT/admin/"
mkdir -p "$RELEASE_ROOT/admin/css"
cp "$PLUGIN_DIR/admin/css/admin.css" "$RELEASE_ROOT/admin/css/"
mkdir -p "$RELEASE_ROOT/admin/js"
cp "$PLUGIN_DIR/admin/js/admin.js" "$RELEASE_ROOT/admin/js/"
cp "$PLUGIN_DIR/uninstall.php"      "$RELEASE_ROOT/"

# readme.txt (WordPress)
cp "$PLUGIN_DIR/readme.txt"         "$RELEASE_ROOT/"

# Built player assets (manifest + JS/CSS/chunks)
mkdir -p "$RELEASE_ROOT/player"
cp -r "$DIST_SOURCE" "$RELEASE_ROOT/player/"

# Create zip (root directory = plugin name)
(cd "$STAGING_DIR" && zip -r -q "$OUTPUT_ZIP" "$PLUGIN_SLUG")

echo -e "${GREEN}Zip created: $OUTPUT_ZIP${NC}"
echo ""
echo "Zip contents:"
unzip -l "$OUTPUT_ZIP" | head -30
echo "  ..."
echo ""
echo "To install: Upload the zip in WordPress (Plugins > Add New > Upload Plugin)."
