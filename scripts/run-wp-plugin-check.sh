#!/bin/bash

# WordPress Plugin Check Script
# Replicates the checks from .github/workflows/test.yml
# Matches: wordpress/plugin-check-action@v1 with:
#   - exclude-directories: 'player'
#   - ignore-codes: WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet, NonEnqueuedScript
#   - exclude-files: .gitignore

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running WordPress Plugin Check...${NC}"

# Get the plugin directory (parent of scripts/)
PLUGIN_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Check if wp-cli is available and WordPress is installed
if command -v wp &> /dev/null; then
    # Check if WordPress is available (wp core version will fail if WP not installed)
    if wp core version --allow-root 2>/dev/null >/dev/null; then
        echo "Using WP-CLI plugin check..."
        
        # Run wp plugin check
        # Note: wp plugin check doesn't support all the exclusion options directly,
        # but it will check the plugin according to WordPress standards
        if wp plugin check "$PLUGIN_DIR" --allow-root 2>&1 | grep -v "player/" > /tmp/wp-plugin-check-output.txt; then
            # Check if there are any real errors (not just warnings about player directory)
            if grep -q "ERROR" /tmp/wp-plugin-check-output.txt 2>/dev/null; then
                echo -e "${RED}WordPress Plugin Check failed!${NC}"
                cat /tmp/wp-plugin-check-output.txt
                rm -f /tmp/wp-plugin-check-output.txt
                exit 1
            else
                echo -e "${GREEN}WordPress Plugin Check passed!${NC}"
                rm -f /tmp/wp-plugin-check-output.txt
                exit 0
            fi
        else
            # If command failed, check output
            if [ -f /tmp/wp-plugin-check-output.txt ]; then
                ERRORS=$(cat /tmp/wp-plugin-check-output.txt | grep -v "player/" | grep -i "error" || true)
                if [ -n "$ERRORS" ]; then
                    echo -e "${RED}WordPress Plugin Check failed!${NC}"
                    cat /tmp/wp-plugin-check-output.txt
                    rm -f /tmp/wp-plugin-check-output.txt
                    exit 1
                fi
            fi
            rm -f /tmp/wp-plugin-check-output.txt
            echo -e "${YELLOW}WP-CLI plugin check completed with warnings.${NC}"
            echo -e "${YELLOW}Trying PHPCS as additional check...${NC}"
        fi
    else
        echo -e "${YELLOW}WordPress not found. Trying PHPCS...${NC}"
    fi
fi

# Fallback: Use PHPCS with WordPress Coding Standards
# Check if PHPCS is available (either globally or via composer)
PHPCS_CMD=""
if command -v phpcs &> /dev/null; then
    PHPCS_CMD="phpcs"
elif [ -f "$PLUGIN_DIR/vendor/bin/phpcs" ]; then
    PHPCS_CMD="$PLUGIN_DIR/vendor/bin/phpcs"
fi

if [ -n "$PHPCS_CMD" ]; then
    echo "Using PHPCS with WordPress Coding Standards..."
    
    # Create a temporary ruleset XML that matches the CI workflow exclusions
    RULESET_FILE=$(mktemp)
    cat > "$RULESET_FILE" << 'EOF'
<?xml version="1.0"?>
<ruleset name="WordPress Plugin Check">
    <description>WordPress Plugin Check matching CI workflow</description>
    <rule ref="WordPress">
        <!-- Exclude player directory -->
        <exclude-pattern>player/*</exclude-pattern>
        <!-- Exclude .gitignore file -->
        <exclude-pattern>*.gitignore</exclude-pattern>
        <!-- Ignore specific codes matching CI workflow -->
        <exclude name="WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet"/>
        <exclude name="WordPress.WP.EnqueuedResources.NonEnqueuedScript"/>
    </rule>
</ruleset>
EOF
    
    # Run PHPCS with the custom ruleset
    if $PHPCS_CMD \
        --standard="$RULESET_FILE" \
        --extensions=php \
        --ignore-annotations \
        "$PLUGIN_DIR" 2>&1; then
        echo -e "${GREEN}WordPress Plugin Check passed!${NC}"
        rm -f "$RULESET_FILE"
        exit 0
    else
        EXIT_CODE=$?
        echo -e "${RED}WordPress Plugin Check failed!${NC}"
        rm -f "$RULESET_FILE"
        exit $EXIT_CODE
    fi
else
    echo -e "${YELLOW}PHPCS not found. Skipping WordPress Plugin Check.${NC}"
    echo -e "${YELLOW}To enable WordPress Plugin Check, install PHPCS and WordPress Coding Standards:${NC}"
    echo -e "${YELLOW}  composer require --dev squizlabs/php_codesniffer wp-coding-standards/wpcs${NC}"
    echo -e "${YELLOW}  vendor/bin/phpcs --config-set installed_paths vendor/wp-coding-standards/wpcs${NC}"
    echo -e "${YELLOW}Or install WP-CLI and ensure WordPress is available.${NC}"
    echo -e "${YELLOW}Note: This check will still run in CI.${NC}"
    exit 0
fi
