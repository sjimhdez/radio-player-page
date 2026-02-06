#!/bin/bash

# Script to test plugin compatibility with different PHP versions
# From PHP 5.6 to the latest available version

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Plugin directory
PLUGIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHP_FILES=(
    "$PLUGIN_DIR/radio-player-page.php"
    "$PLUGIN_DIR/admin-page.php"
    "$PLUGIN_DIR/uninstall.php"
)

# PHP versions to test (from 5.6 to 8.4)
PHP_VERSIONS=("5.6" "7.0" "7.1" "7.2" "7.3" "7.4" "8.0" "8.1" "8.2" "8.3" "8.4")

# Array to store results (bash 3.2 compatible)
RESULTS=()

echo "========================================="
echo "  PHP Compatibility Test"
echo "  Plugin: Radio Player Page"
echo "========================================="
echo ""

# Function to find PHP executable for a specific version
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
    # In some installations: php-5.6, php-7.0, etc.
    elif command -v "php-${version}" &> /dev/null; then
        binary="php-${version}"
    # Typical Homebrew path
    elif [ -f "/opt/homebrew/opt/php@${version}/bin/php" ]; then
        binary="/opt/homebrew/opt/php@${version}/bin/php"
    # Legacy Homebrew path (Intel)
    elif [ -f "/usr/local/opt/php@${version}/bin/php" ]; then
        binary="/usr/local/opt/php@${version}/bin/php"
    # If it's the current version, use php directly
    elif [ "$version" = "$(php -r 'echo PHP_VERSION;' 2>/dev/null | cut -d. -f1,2)" ]; then
        binary="php"
    fi
    
    echo "$binary"
}

# Function to verify syntax of a file
test_syntax() {
    local php_binary=$1
    local file=$2
    local output
    local exit_code
    
    output=$($php_binary -l "$file" 2>&1)
    exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        return 0
    else
        return 1
    fi
}

# Detect available PHP versions
echo "Detecting available PHP versions..."
echo ""

AVAILABLE_VERSIONS=()

for version in "${PHP_VERSIONS[@]}"; do
    php_binary=$(find_php_binary "$version")
    
    if [ -n "$php_binary" ]; then
        # Verify it actually works
        php_version_output=$($php_binary -r 'echo PHP_VERSION;' 2>/dev/null)
        if [ $? -eq 0 ]; then
            AVAILABLE_VERSIONS+=("$version|$php_binary|$php_version_output")
            echo "  ✓ PHP ${version} found: $php_binary (version: $php_version_output)"
        fi
    fi
done

echo ""
echo "Versions found: ${#AVAILABLE_VERSIONS[@]}"
echo ""
echo "========================================="
echo "  Running syntax tests..."
echo "========================================="
echo ""

# Test each available version
for version_info in "${AVAILABLE_VERSIONS[@]}"; do
    IFS='|' read -r version php_binary detected_version <<< "$version_info"
    
    echo -n "Testing PHP ${version} (${detected_version})... "
    
    all_passed=true
    failed_files=()
    
    # Test each PHP file
    for php_file in "${PHP_FILES[@]}"; do
        if ! test_syntax "$php_binary" "$php_file" > /dev/null 2>&1; then
            all_passed=false
            failed_files+=("$(basename "$php_file")")
        fi
    done
    
    # Save result
    if [ "$all_passed" = true ]; then
        RESULTS+=("${version}:OK")
        echo -e "${GREEN}✓ OK${NC}"
    else
        RESULTS+=("${version}:FAIL")
        echo -e "${RED}✗ FAIL${NC}"
        for failed_file in "${failed_files[@]}"; do
            echo "    - Error in: $failed_file"
        done
    fi
done

# If no versions found, warn
if [ ${#AVAILABLE_VERSIONS[@]} -eq 0 ]; then
    echo -e "${YELLOW}⚠ No installed PHP versions found${NC}"
    echo ""
    echo "To install PHP versions on macOS with Homebrew:"
    echo "  brew install php@5.6"
    echo "  brew install php@7.0"
    echo "  # etc..."
    echo ""
    echo "Or use a version manager like:"
    echo "  - phpenv (https://github.com/phpenv/phpenv)"
    echo "  - phpbrew (https://github.com/phpbrew/phpbrew)"
fi

# Final summary
echo ""
echo "========================================="
echo "  RESULTS SUMMARY"
echo "========================================="
echo ""

# Count results
total_ok=0
total_fail=0

# Display results sorted
for version in "${PHP_VERSIONS[@]}"; do
    result_found=""
    for result_entry in "${RESULTS[@]}"; do
        result_version="${result_entry%%:*}"
        if [ "$result_version" = "$version" ]; then
            result="${result_entry##*:}"
            result_found="$result"
            if [ "$result" = "OK" ]; then
                echo -e "PHP ${version}: ${GREEN}${result}${NC}"
                total_ok=$((total_ok + 1))
            else
                echo -e "PHP ${version}: ${RED}${result}${NC}"
                total_fail=$((total_fail + 1))
            fi
            break
        fi
    done
done

echo ""
echo "========================================="

echo "Total OK:  ${total_ok}"
echo "Total FAIL: ${total_fail}"
echo ""

# Exit code based on results
if [ $total_fail -gt 0 ]; then
    exit 1
else
    exit 0
fi
