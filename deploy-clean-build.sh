#!/bin/bash

# Bitmind Clean Build Deployment Script
# Deploys clean build to nginx with cache invalidation
# CRITICAL: Use after clean-rebuild-frontend.sh

set -e  # Exit on any error

echo "=========================================="
echo "BITMIND CLEAN BUILD DEPLOYMENT"
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

echo "📋 DEPLOYMENT CONFIGURATION:"
echo "   Frontend Dir: $FRONTEND_DIR"
echo "   Nginx Root: $NGINX_ROOT"
echo ""

# Step 1: Verify build exists
echo "🧪 STEP 1: Verifying build exists..."
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    echo -e "${RED}✗ Build not found - run clean-rebuild-frontend.sh first${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build exists${NC}"
echo ""

# Step 2: Backup current deployment
echo "💾 STEP 2: Backing up current deployment..."
if [ -d "$NGINX_ROOT" ]; then
    sudo cp -r "$NGINX_ROOT" "$NGINX_ROOT.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${GREEN}✓ Backup created${NC}"
else
    echo -e "${YELLOW}⚠ Nginx root does not exist${NC}"
fi
echo ""

# Step 3: Remove old deployment
echo "🗑️  STEP 3: Removing old deployment..."
sudo rm -rf "$NGINX_ROOT"/*
echo -e "${GREEN}✓ Old deployment removed${NC}"
echo ""

# Step 4: Copy new build
echo "📦 STEP 4: Copying new build..."
sudo cp -r "$FRONTEND_DIR/dist"/* "$NGINX_ROOT/"
echo -e "${GREEN}✓ New build copied${NC}"
echo ""

# Step 5: Set permissions
echo "🔐 STEP 5: Setting permissions..."
sudo chown -R www-data:www-data "$NGINX_ROOT"
sudo chmod -R 755 "$NGINX_ROOT"
echo -e "${GREEN}✓ Permissions set${NC}"
echo ""

# Step 6: Cache invalidation - touch all files
echo "🔄 STEP 6: Invalidating cache (touching files)..."
sudo find "$NGINX_ROOT" -type f -exec touch {} \;
echo -e "${GREEN}✓ Cache invalidated${NC}"
echo ""

# Step 7: Verify deployment
echo "🧪 STEP 7: Verifying deployment..."
if [ ! -f "$NGINX_ROOT/index.html" ]; then
    echo -e "${RED}✗ Deployment failed - index.html not found${NC}"
    exit 1
fi
if [ ! -d "$NGINX_ROOT/assets" ]; then
    echo -e "${RED}✗ Deployment failed - assets folder not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Deployment verified${NC}"
echo ""

# Step 8: Check for deprecated API references in deployed files
echo "🔍 STEP 8: Checking for deprecated API references..."
if sudo grep -r "/api/devices" "$NGINX_ROOT" > /dev/null 2>&1; then
    echo -e "${RED}✗ WARNING: /api/devices still found in deployment!${NC}"
    echo "Files containing /api/devices:"
    sudo grep -r "/api/devices" "$NGINX_ROOT"
    echo ""
    echo "This indicates the build is stale. Rebuild with clean-rebuild-frontend.sh"
    exit 1
else
    echo -e "${GREEN}✓ No /api/devices references in deployment${NC}"
fi
echo ""

# Step 9: Verify new API references
echo "🔍 STEP 9: Verifying new API references..."
if sudo grep -r "/api/miners" "$NGINX_ROOT" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ /api/miners references found in deployment${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: No /api/miners references found${NC}"
fi
echo ""

# Step 10: Restart nginx
echo "🔄 STEP 10: Restarting nginx..."
sudo systemctl restart nginx
echo -e "${GREEN}✓ Nginx restarted${NC}"
echo ""

# Step 11: Verify nginx is running
echo "🧪 STEP 11: Verifying nginx is running..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx is not running${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo "DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo "🌐 NEXT STEPS:"
echo "1. Open https://getbitmind.com in browser"
echo "2. Hard refresh (Ctrl+Shift+R)"
echo "3. Open DevTools Network tab"
echo "4. Verify /api/miners calls (not /api/devices)"
echo "5. Test Connect Miner button"
echo ""
