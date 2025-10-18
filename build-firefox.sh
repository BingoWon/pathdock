#!/bin/bash

# ============================================================================
# Build Firefox Version
# ============================================================================
# This script creates a Firefox-compatible version of the extension
# in the firefox/ subdirectory

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIREFOX_DIR="$SCRIPT_DIR/firefox"

echo "🦊 Building Firefox version..."
echo ""

# Clean up existing Firefox directory
if [ -d "$FIREFOX_DIR" ]; then
    echo "🗑️  Removing existing firefox/ directory..."
    rm -rf "$FIREFOX_DIR"
fi

# Create Firefox directory
echo "📁 Creating firefox/ directory..."
mkdir -p "$FIREFOX_DIR"

# Copy all files except git and manifest files
echo "📋 Copying files..."
rsync -av \
    --exclude='.git' \
    --exclude='.gitignore' \
    --exclude='manifest.json' \
    --exclude='manifest.chrome.json' \
    --exclude='manifest.firefox.json' \
    --exclude='firefox/' \
    --exclude='build-firefox.sh' \
    --exclude='README.md' \
    "$SCRIPT_DIR/" "$FIREFOX_DIR/"

# Copy Firefox manifest as manifest.json
echo "📝 Creating Firefox manifest.json..."
if [ -f "$SCRIPT_DIR/manifest.firefox.json" ]; then
    cp "$SCRIPT_DIR/manifest.firefox.json" "$FIREFOX_DIR/manifest.json"
else
    echo "❌ Error: manifest.firefox.json not found!"
    exit 1
fi

# Copy README if exists
if [ -f "$SCRIPT_DIR/README.md" ]; then
    echo "📄 Copying README.md..."
    cp "$SCRIPT_DIR/README.md" "$FIREFOX_DIR/"
fi

echo ""
echo "✅ Firefox version created successfully!"
echo ""
echo "📂 Location: $FIREFOX_DIR"
echo ""
echo "📋 Next steps:"
echo "  1. Open Firefox Developer Edition"
echo "  2. Go to about:debugging"
echo "  3. Click 'This Firefox'"
echo "  4. Click 'Load Temporary Add-on...'"
echo "  5. Navigate to: $FIREFOX_DIR"
echo "  6. Select manifest.json"
echo ""
echo "💡 To rebuild after code changes, run this script again:"
echo "   ./build-firefox.sh"

