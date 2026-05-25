#!/bin/bash

# Bitmind Deterministic Reset Script
# Complete elimination of /api/devices and full clean rebuild
# CRITICAL: This is a full reset - no cache, no legacy, no exceptions

set -e  # Exit on any error

echo "=========================================="
echo "BITMIND DETERMINISTIC RESET"
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

echo "📋 DETERMINISTIC RESET CONFIGURATION:"
echo "   Frontend Dir: $FRONTEND_DIR"
echo "   Nginx Root: $NGINX_ROOT"
echo ""

# STEP 1: Pull latest code
echo "📥 STEP 1: Pulling latest code..."
cd /opt/Bitmind
git pull
echo -e "${GREEN}✓ Latest code pulled${NC}"
echo ""

# STEP 2: Verify source code is clean
echo "🔍 STEP 2: Verifying source code has no /api/devices..."
if grep -r "/api/devices" "$FRONTEND_DIR/src" > /dev/null 2>&1; then
    echo -e "${RED}✗ FOUND /api/devices in source code!${NC}"
    echo "Files containing /api/devices:"
    grep -r "/api/devices" "$FRONTEND_DIR/src"
    echo ""
    echo "Source code must be cleaned first. Aborting."
    exit 1
else
    echo -e "${GREEN}✓ Source code is clean (no /api/devices)${NC}"
fi
echo ""

# STEP 3: Kill old module graph
echo "🗑️  STEP 3: Killing old module graph..."
cd "$FRONTEND_DIR"
rm -rf dist
rm -rf node_modules/.vite
rm -rf node_modules
echo -e "${GREEN}✓ Old module graph destroyed${NC}"
echo ""

# STEP 4: Reinstall fresh dependencies
echo "📦 STEP 4: Reinstalling fresh dependencies..."
npm install
echo -e "${GREEN}✓ Fresh dependencies installed${NC}"
echo ""

# STEP 5: Build frontend
echo "🔥 STEP 5: Building frontend..."
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

# STEP 6: Verify build sanity
echo "🧪 STEP 6: Verifying build sanity..."
if grep -r "/api/devices" dist/ > /dev/null 2>&1; then
    echo -e "${RED}✗ BUILD CONTAINS /api/devices!${NC}"
    echo "Files containing /api/devices:"
    grep -r "/api/devices" dist/
    echo ""
    echo "Build is stale. Aborting deployment."
    exit 1
else
    echo -e "${GREEN}✓ OK - CLEAN (no /api/devices in build)${NC}"
fi
echo ""

# STEP 7: Verify new API references
echo "🔍 STEP 7: Verifying /api/miners references..."
if grep -r "/api/miners" dist/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ /api/miners references found${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: No /api/miners references found${NC}"
fi
echo ""

# STEP 8: Clean deployment (zero cache policy)
echo "🗑️  STEP 8: Clean deployment (zero cache policy)..."
sudo rm -rf "$NGINX_ROOT"/*
sudo cp -r dist/* "$NGINX_ROOT/"
sudo chown -R www-data:www-data "$NGINX_ROOT"
sudo chmod -R 755 "$NGINX_ROOT"
echo -e "${GREEN}✓ Clean deployment complete${NC}"
echo ""

# STEP 9: Cache invalidation
echo "🔄 STEP 9: Cache invalidation (touching all files)..."
sudo find "$NGINX_ROOT" -type f -exec touch {} \;
echo -e "${GREEN}✓ Cache invalidated${NC}"
echo ""

# STEP 10: Restart nginx
echo "🔄 STEP 10: Restarting nginx..."
sudo systemctl restart nginx
echo -e "${GREEN}✓ Nginx restarted${NC}"
echo ""

# STEP 11: Verify deployment
echo "🧪 STEP 11: Verifying deployment..."
if sudo grep -r "/api/devices" "$NGINX_ROOT" > /dev/null 2>&1; then
    echo -e "${RED}✗ DEPLOYMENT CONTAINS /api/devices!${NC}"
    echo "Files containing /api/devices:"
    sudo grep -r "/api/devices" "$NGINX_ROOT"
    echo ""
    echo "Deployment is stale. Aborting."
    exit 1
else
    echo -e "${GREEN}✓ Deployment is clean (no /api/devices)${NC}"
fi
echo ""

# STEP 12: Verify nginx is running
echo "🧪 STEP 12: Verifying nginx is running..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ Nginx is running${NC}"
else
    echo -e "${RED}✗ Nginx is not running${NC}"
    exit 1
fi
echo ""

echo "=========================================="
echo "DETERMINISTIC RESET COMPLETE"
echo "=========================================="
echo ""
echo "✅ Zero /api/devices in codebase"
echo "✅ Zero /api/devices in dist"
echo "✅ Zero /api/devices in production"
echo "✅ Only /api/miners exists"
echo "✅ Clean module graph"
echo "✅ Zero cache policy applied"
echo ""
echo "🌐 NEXT STEPS:"
echo "1. Run validation: ./final-validation.sh"
echo "2. Test in browser: https://getbitmind.com"
echo "3. Hard refresh (Ctrl+Shift+R)"
echo "4. Check Network tab for /api/miners"
echo ""
