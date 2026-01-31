#!/bin/bash

# PHP Versions Compatibility Check Script
# Tests PHP syntax compatibility with different PHP versions
# Based on test-php-versions.sh.local

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the plugin directory (parent of scripts/)
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# PHP files to check (matching test-php-versions.sh.local)
PHP_FILES=(
    "$PLUGIN_DIR/radio-player-page.php"
    "$PLUGIN_DIR/admin-page.php"
)

# Check if compatibility.php exists and add it
if [ -f "$PLUGIN_DIR/compatibility.php" ]; then
    PHP_FILES+=("$PLUGIN_DIR/compatibility.php")
fi

# Minimum and maximum PHP versions to test (from plugin requirements)
MIN_PHP_VERSION="5.6"
MAX_PHP_VERSION="8.4"

# Versions to test (minimum, current, and maximum if available)
PHP_VERSIONS_TO_TEST=("$MIN_PHP_VERSION")

# Add current PHP version if available
CURRENT_PHP_VERSION=$(php -r 'echo PHP_VERSION;' 2>/dev/null | cut -d. -f1,2)
if [ -n "$CURRENT_PHP_VERSION" ] && [ "$CURRENT_PHP_VERSION" != "$MIN_PHP_VERSION" ]; then
    PHP_VERSIONS_TO_TEST+=("$CURRENT_PHP_VERSION")
fi

# Add max version if different
if [ "$MAX_PHP_VERSION" != "$MIN_PHP_VERSION" ] && [ "$MAX_PHP_VERSION" != "$CURRENT_PHP_VERSION" ]; then
    PHP_VERSIONS_TO_TEST+=("$MAX_PHP_VERSION")
fi

echo -e "${YELLOW}Running PHP Versions Compatibility Check...${NC}"

# Function to find PHP binary for a specific version
find_php_binary() {
    local version=$1
    local binary=""
    
    # Try different common formats
    # Homebrew on macOS: php@5.6, php@7.0, etc.
    if command -v "php@${version}" &> /dev/null; then
        binary="php@${version}"
    # Direct binary: php5.6, php7.0, etc.
    elif command -v "php${version}" &> /dev/null; then
        binary="php${version}"
    # Some installations: php-5.6, php-7.0, etc.
    elif command -v "php-${version}" &> /dev/null; then
        binary="php-${version}"
    # Typical Homebrew path
    elif [ -f "/opt/homebrew/opt/php@${version}/bin/php" ]; then
        binary="/opt/homebrew/opt/php@${version}/bin/php"
    # Old Homebrew path (Intel)
    elif [ -f "/usr/local/opt/php@${version}/bin/php" ]; then
        binary="/usr/local/opt/php@${version}/bin/php"
    # If it's the current version, use php directly
    elif [ "$version" = "$CURRENT_PHP_VERSION" ]; then
        binary="php"
    fi
    
    echo "$binary"
}

# Function to test syntax of a file
test_syntax() {
    local php_binary=$1
    local file=$2
    
    if [ ! -f "$file" ]; then
        return 0  # File doesn't exist, skip
    fi
    
    if $php_binary -l "$file" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Track if any version failed
ANY_FAILED=false
FAILED_VERSIONS=()

# Test each required version
for version in "${PHP_VERSIONS_TO_TEST[@]}"; do
    php_binary=$(find_php_binary "$version")
    
    if [ -z "$php_binary" ]; then
        # If minimum version not found, try current PHP
        if [ "$version" = "$MIN_PHP_VERSION" ]; then
            if [ -n "$CURRENT_PHP_VERSION" ]; then
                echo -e "${YELLOW}PHP ${version} not found, using current PHP ${CURRENT_PHP_VERSION}${NC}"
                php_binary="php"
                version="$CURRENT_PHP_VERSION"
            else
                echo -e "${YELLOW}PHP ${version} not found and no current PHP available. Skipping...${NC}"
                continue
            fi
        else
            echo -e "${YELLOW}PHP ${version} not found. Skipping...${NC}"
            continue
        fi
    fi
    
    # Verify binary works
    detected_version=$($php_binary -r 'echo PHP_VERSION;' 2>/dev/null)
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}PHP ${version} binary found but not working. Skipping...${NC}"
        continue
    fi
    
    echo -n "Testing PHP ${version} (${detected_version})... "
    
    version_passed=true
    failed_files=()
    
    # Test each PHP file
    for php_file in "${PHP_FILES[@]}"; do
        if ! test_syntax "$php_binary" "$php_file"; then
            version_passed=false
            failed_files+=("$(basename "$php_file")")
        fi
    done
    
    if [ "$version_passed" = true ]; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${RED}✗ FAIL${NC}"
        for failed_file in "${failed_files[@]}"; do
            echo "    Error in: $failed_file"
            # Show actual error
            $php_binary -l "$PLUGIN_DIR/$failed_file" 2>&1 | head -5
        done
        ANY_FAILED=true
        FAILED_VERSIONS+=("$version")
    fi
done

# If no PHP versions were tested, warn but don't fail
if [ ${#PHP_VERSIONS_TO_TEST[@]} -eq 0 ] || [ -z "$php_binary" ]; then
    echo -e "${YELLOW}⚠ No PHP versions available for testing${NC}"
    echo -e "${YELLOW}This check will still run in CI.${NC}"
    exit 0
fi

# Final result
if [ "$ANY_FAILED" = true ]; then
    echo -e "${RED}PHP Versions Compatibility Check failed!${NC}"
    echo -e "${RED}Failed versions: ${FAILED_VERSIONS[*]}${NC}"
    exit 1
else
    echo -e "${GREEN}PHP Versions Compatibility Check passed!${NC}"
    exit 0
fi
