#!/bin/bash

# Dev Fixtures Seeder
# Wrapper around `wp eval-file` for scripts/fixtures/seed.php: creates a
# station, 5 radio shows and a full weekly schedule for local testing.
# See scripts/fixtures/README.md for what it creates and how to customize it.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the plugin directory (parent of scripts/)
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SEED_FILE="$PLUGIN_DIR/scripts/fixtures/seed.php"

if [ ! -f "$SEED_FILE" ]; then
    echo -e "${RED}Error: fixtures seed script not found at $SEED_FILE${NC}"
    exit 1
fi

if ! command -v wp &> /dev/null; then
    echo -e "${RED}Error: WP-CLI ('wp') not found in PATH.${NC}"
    exit 1
fi

echo -e "${YELLOW}Seeding dev fixtures (station, 5 radio shows, weekly schedule)...${NC}"

# Any extra arguments (e.g. --path=/path/to/wordpress, --allow-root) are
# passed straight through to WP-CLI.
if wp eval-file "$SEED_FILE" "$@"; then
    echo -e "${GREEN}Fixtures seeded successfully.${NC}"
    exit 0
else
    echo -e "${RED}Fixture seeding failed.${NC}"
    exit 1
fi
