#!/bin/bash

# ESLint Script for Player
# Replicates the checks from .github/workflows/test.yml

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running ESLint on player...${NC}"

# Get the plugin directory (parent of scripts/)
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLAYER_DIR="$PLUGIN_DIR/player"

# Check if player directory exists
if [ ! -d "$PLAYER_DIR" ]; then
    echo -e "${RED}Error: player directory not found at $PLAYER_DIR${NC}"
    exit 1
fi

# Change to player directory
cd "$PLAYER_DIR"

# Check if node_modules exists, if not, warn but continue
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Warning: node_modules not found. Running 'npm install'...${NC}"
    npm install
fi

# Run ESLint (matching the CI workflow: npx eslint .)
echo "Running ESLint..."
if npx eslint .; then
    echo -e "${GREEN}ESLint passed!${NC}"
    exit 0
else
    echo -e "${RED}ESLint failed!${NC}"
    exit 1
fi
