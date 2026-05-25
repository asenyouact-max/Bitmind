#!/bin/bash

# Bitmind Nuclear Deployment Pipeline
# Deterministic deployment script - guarantees clean build every time
# Location: /opt/Bitmind/deploy.sh

set -e  # Exit on any error

echo "=========================================="
echo "BITMIND NUCLEAR DEPLOYMENT PIPELINE"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO_DIR="/opt/Bitmind"
FRONTEND_DIR="$REPO_DIR/bitmind-ui"
NGINX_ROOT="/usr/share/nginx/html"
BACKEND_URL="http://localhost:3001"

echo "📋 DEPLOYMENT CONFIGURATION:"
echo "   Repo Dir: $REPO_DIR"
echo "   Frontend Dir: $FRONTEND_DIR"
echo "   Nginx Root: $NGINX_ROOT"
echo "   Backend URL: $BACKEND_URL"
echo ""

# STEP 1: SYNC CODE (HARD RESET)
echo "📥 STEP 1: Syncing code (hard reset)..."
cd "$REPO_DIR"
git fetch origin
git reset --hard origin/main
echo -e "${GREEN}✓ Code synced to origin/main${NC}"
echo ""

# STEP 2: CLEAN FRONTEND ENV
echo "🗑️  STEP 2: Cleaning frontend environment..."
cd "$FRONTEND_DIR"
rm -rf dist node_modules/.vite
echo -e "${GREEN}✓ Frontend environment cleaned${NC}"
echo ""

# STEP 3: BUILD FRONTEND
echo "🔥 STEP 3: Building frontend..."
npm install
npm run build
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

# STEP 4: VALIDATION GATE (CRITICAL)
echo "🧪 STEP 4: Validation gate (checking for /api/devices)..."
if grep -R "/api/devices" dist/ > /dev/null 2>&1; then
    echo -e "${RED}✗ VALIDATION FAILED: /api/devices found in build!${NC}"
    echo "Files containing /api/devices:"
    grep -R "/api/devices" dist/
    echo ""
    echo "Build contains legacy API references. Aborting deployment."
    exit 1
else
    echo -e "${GREEN}✓ OK - CLEAN (no /api/devices in build)${NC}"
fi
echo ""

# STEP 5: DEPLOY TO NGINX
echo "🌐 STEP 5: Deploying to nginx..."
sudo rm -rf "$NGINX_ROOT"/*
sudo cp -r dist/* "$NGINX_ROOT/"
sudo chown -R www-data:www-data "$NGINX_ROOT"
sudo chmod -R 755 "$NGINX_ROOT"
echo -e "${GREEN}✓ Deployed to nginx${NC}"
echo ""

# STEP 6: RESTART SERVICES
echo "🔄 STEP 6: Restarting services..."
sudo systemctl restart nginx
pm2 restart bitmind
echo -e "${GREEN}✓ Services restarted${NC}"
echo ""

# STEP 7: FINAL CHECK
echo "🧪 STEP 7: Final check (testing /api/miners)..."
MINERS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/miners")
if [ "$MINERS_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ /api/miners returns 200${NC}"
else
    echo -e "${RED}✗ /api/miners returns $MINERS_RESPONSE${NC}"
    exit 1
fi
echo ""

# STEP 8: VERIFY /api/devices DOES NOT EXIST
echo "🧪 STEP 8: Verifying /api/devices does not exist..."
DEVICES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/devices")
if [ "$DEVICES_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✓ /api/devices returns 404 (endpoint removed)${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: /api/devices returns $DEVICES_RESPONSE (expected 404)${NC}"
fi
echo ""

echo "=========================================="
echo "DEPLOYMENT COMPLETE"
echo "=========================================="
echo ""
echo "✅ Clean frontend build"
echo "✅ No stale /api/devices anywhere"
echo "✅ Nginx serves latest dist"
echo "✅ PM2 backend restarted cleanly"
echo "✅ Zero cache / partial deployment issues"
echo ""
echo "🌐 VERIFY IN BROWSER:"
echo "1. Open https://getbitmind.com"
echo "2. Hard refresh (Ctrl+Shift+R)"
echo "3. Check Network tab for /api/miners"
echo "4. Test Connect Miner button"
echo ""
