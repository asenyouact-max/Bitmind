#!/bin/bash

# Bitmind Build Verification Script
# Verifies build content and API references
# CRITICAL: Use to verify build before deployment

set -e  # Exit on any error

echo "=========================================="
echo "BITMIND BUILD VERIFICATION"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
FRONTEND_DIR="/opt/Bitmind/bitmind-ui"
NGINX_ROOT="/usr/share/nginx/html"

echo "📋 VERIFICATION CONFIGURATION:"
echo "   Frontend Dir: $FRONTEND_DIR"
echo "   Nginx Root: $NGINX_ROOT"
echo ""

# Verify build folder
echo "🧪 STEP 1: Verifying build folder..."
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    echo -e "${RED}✗ Build folder does not exist${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build folder exists${NC}"
echo ""

# Check for deprecated API references in build
echo "🔍 STEP 2: Checking for /api/devices in build..."
if grep -r "/api/devices" "$FRONTEND_DIR/dist" > /dev/null 2>&1; then
    echo -e "${RED}✗ FOUND /api/devices in build!${NC}"
    echo "Files containing /api/devices:"
    grep -r "/api/devices" "$FRONTEND_DIR/dist"
    echo ""
    echo "Build is stale. Run clean-rebuild-frontend.sh"
    exit 1
else
    echo -e "${GREEN}✓ No /api/devices references in build${NC}"
fi
echo ""

# Check for new API references in build
echo "🔍 STEP 3: Checking for /api/miners in build..."
if grep -r "/api/miners" "$FRONTEND_DIR/dist" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ /api/miners references found in build${NC}"
    echo "Files with /api/miners:"
    grep -r "/api/miners" "$FRONTEND_DIR/dist" | head -5
else
    echo -e "${YELLOW}⚠ No /api/miners references found${NC}"
fi
echo ""

# Verify deployment (if exists)
if [ -d "$NGINX_ROOT" ]; then
    echo "🔍 STEP 4: Checking for /api/devices in deployment..."
    if sudo grep -r "/api/devices" "$NGINX_ROOT" > /dev/null 2>&1; then
        echo -e "${RED}✗ FOUND /api/devices in deployment!${NC}"
        echo "Files containing /api/devices:"
        sudo grep -r "/api/devices" "$NGINX_ROOT"
        echo ""
        echo "Deployment is stale. Run deploy-clean-build.sh"
        exit 1
    else
        echo -e "${GREEN}✓ No /api/devices references in deployment${NC}"
    fi
    echo ""

    echo "🔍 STEP 5: Checking for /api/miners in deployment..."
    if sudo grep -r "/api/miners" "$NGINX_ROOT" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ /api/miners references found in deployment${NC}"
    else
        echo -e "${YELLOW}⚠ No /api/miners references in deployment${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠ Deployment folder does not exist${NC}"
    echo ""
fi

# Check file timestamps
echo "📅 STEP 6: Checking file timestamps..."
echo "   Build folder: $(stat -f%m "$FRONTEND_DIR/dist" 2>/dev/null || stat -c%Y "$FRONTEND_DIR/dist" 2>/dev/null | xargs -I{} date -r {} '+%Y-%m-%d %H:%M:%S')"
if [ -d "$NGINX_ROOT" ]; then
    echo "   Deployment: $(stat -f%m "$NGINX_ROOT/index.html" 2>/dev/null || stat -c%Y "$NGINX_ROOT/index.html" 2>/dev/null | xargs -I{} date -r {} '+%Y-%m-%d %H:%M:%S')"
fi
echo ""

echo "=========================================="
echo "VERIFICATION COMPLETE"
echo "=========================================="
echo ""
