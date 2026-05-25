#!/bin/bash

# Bitmind Clean Frontend Rebuild Script
# Removes all build artifacts and performs clean rebuild
# CRITICAL: Use this to fix stale production bundles

set -e  # Exit on any error

echo "=========================================="
echo "BITMIND CLEAN FRONTEND REBUILD"
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

echo "📋 CLEAN REBUILD CONFIGURATION:"
echo "   Frontend Dir: $FRONTEND_DIR"
echo "   Nginx Root: $NGINX_ROOT"
echo ""

# Step 1: Navigate to frontend directory
echo "📁 STEP 1: Navigating to frontend directory..."
cd "$FRONTEND_DIR"
echo -e "${GREEN}✓ Navigated${NC}"
echo ""

# Step 2: Remove dist folder
echo "🗑️  STEP 2: Removing dist folder..."
if [ -d "dist" ]; then
    rm -rf dist
    echo -e "${GREEN}✓ dist folder removed${NC}"
else
    echo -e "${YELLOW}⚠ dist folder does not exist${NC}"
fi
echo ""

# Step 3: Remove Vite cache
echo "🗑️  STEP 3: Removing Vite cache..."
if [ -d "node_modules/.vite" ]; then
    rm -rf node_modules/.vite
    echo -e "${GREEN}✓ Vite cache removed${NC}"
else
    echo -e "${YELLOW}⚠ Vite cache does not exist${NC}"
fi
echo ""

# Step 4: Reinstall dependencies (optional but recommended)
echo "📦 STEP 4: Reinstalling dependencies..."
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 5: Build frontend
echo "🔥 STEP 5: Building frontend..."
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

# Step 6: Verify build
echo "🧪 STEP 6: Verifying build..."
if [ ! -d "dist" ]; then
    echo -e "${RED}✗ Build failed - dist folder not created${NC}"
    exit 1
fi
if [ ! -f "dist/index.html" ]; then
    echo -e "${RED}✗ Build failed - index.html not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build verified${NC}"
echo ""

# Step 7: Check for deprecated API references
echo "🔍 STEP 7: Checking for deprecated API references..."
if grep -r "/api/devices" dist/ > /dev/null 2>&1; then
    echo -e "${RED}✗ WARNING: /api/devices still found in build!${NC}"
    echo "Files containing /api/devices:"
    grep -r "/api/devices" dist/
    echo ""
    echo "This indicates the source code still has old references."
    echo "Please update source code and rebuild."
    exit 1
else
    echo -e "${GREEN}✓ No /api/devices references found${NC}"
fi
echo ""

# Step 8: Verify new API references
echo "🔍 STEP 8: Verifying new API references..."
if grep -r "/api/miners" dist/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ /api/miners references found${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: No /api/miners references found${NC}"
fi
echo ""

echo "=========================================="
echo "CLEAN REBUILD COMPLETE"
echo "=========================================="
echo ""
echo "🌐 NEXT STEPS:"
echo "1. Deploy to nginx: sudo ./deploy-clean-build.sh"
echo "2. Restart nginx: sudo systemctl restart nginx"
echo "3. Clear browser cache and test"
echo ""
