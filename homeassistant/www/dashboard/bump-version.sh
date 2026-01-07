#!/bin/bash
# Dashboard Version Bump Script
# Usage: ./bump-version.sh [description]
# Example: ./bump-version.sh "added-family-view"

DASHBOARD_DIR="$(dirname "$0")"
VERSION_FILE="$DASHBOARD_DIR/version.json"
MOBILE_HTML="$DASHBOARD_DIR/mobile.html"
INDEX_HTML="$DASHBOARD_DIR/index.html"

# Generate version: YYYY.MM.DD.N (N = increment if same day)
TODAY=$(date +%Y.%m.%d)
TIMESTAMP=$(date +%s)000

# Get current version from version.json
CURRENT_VERSION=$(grep -oP '"version":\s*"\K[^"]+' "$VERSION_FILE" 2>/dev/null || echo "")

# If same day, increment; otherwise start at .1
if [[ "$CURRENT_VERSION" == "$TODAY"* ]]; then
    # Extract the increment number and add 1
    INCREMENT=$(echo "$CURRENT_VERSION" | grep -oP '\.\d+$' | tr -d '.')
    INCREMENT=$((INCREMENT + 1))
else
    INCREMENT=1
fi

NEW_VERSION="$TODAY.$INCREMENT"
DESCRIPTION="${1:-update}"

echo "Bumping version: $CURRENT_VERSION -> $NEW_VERSION"

# Update version.json
cat > "$VERSION_FILE" << EOF
{
  "version": "$NEW_VERSION",
  "timestamp": $TIMESTAMP,
  "build": "$DESCRIPTION"
}
EOF

echo "Updated: version.json"

# Update mobile.html - CURRENT_VERSION constant
sed -i "s/const CURRENT_VERSION = '[^']*'/const CURRENT_VERSION = '$NEW_VERSION'/" "$MOBILE_HTML"
echo "Updated: mobile.html (CURRENT_VERSION)"

# Update mobile.html - script src version
sed -i "s/main-mobile\.js?v=[^\"']*/main-mobile.js?v=$NEW_VERSION/" "$MOBILE_HTML"
echo "Updated: mobile.html (script src)"

# Update index.html if it exists and has versioning
if [ -f "$INDEX_HTML" ]; then
    if grep -q "CURRENT_VERSION" "$INDEX_HTML"; then
        sed -i "s/const CURRENT_VERSION = '[^']*'/const CURRENT_VERSION = '$NEW_VERSION'/" "$INDEX_HTML"
        echo "Updated: index.html (CURRENT_VERSION)"
    fi
    # Update any versioned script/css imports
    sed -i "s/\.js?v=[^\"']*/.js?v=$NEW_VERSION/g" "$INDEX_HTML"
    sed -i "s/\.css?v=[^\"']*/.css?v=$NEW_VERSION/g" "$INDEX_HTML"
    echo "Updated: index.html (asset versions)"
fi

echo ""
echo "Version bumped to: $NEW_VERSION"
echo "Description: $DESCRIPTION"
echo ""
echo "Changes will take effect when users:"
echo "  1. Refresh the page, or"
echo "  2. Wait up to 60 seconds (auto-check), or"
echo "  3. Return to the app after switching away"
