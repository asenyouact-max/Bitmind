#!/bin/bash

# Bitmind VPS Deployment Recovery Script
# Clones repository, builds frontend, deploys to nginx
# CRITICAL: Run this on VPS to fix empty nginx root

set -e  # Exit on any error

echo "=========================================="
echo "BITMIND VPS DEPLOYMENT RECOVERY"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/asenyouact-max/Bitmind.git"
INSTALL_DIR="/opt/Bitmind"
NGINX_ROOT="/usr/share/nginx/html"

echo "📋 DEPLOYMENT CONFIGURATION:"
echo "   Repository: $REPO_URL"
echo "   Install Dir: $INSTALL_DIR"
echo "   Nginx Root: $NGINX_ROOT"
echo ""

# Step 1: Clone repository
echo "📥 STEP 1: Cloning repository..."
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠ Directory already exists, removing...${NC}"
    sudo rm -rf "$INSTALL_DIR"
fi

cd /opt
sudo git clone "$REPO_URL"
echo -e "${GREEN}✓ Repository cloned${NC}"
echo ""

# Step 2: Install frontend dependencies
echo "📦 STEP 2: Installing frontend dependencies..."
cd "$INSTALL_DIR/bitmind-ui"
sudo npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Step 3: Build frontend
echo "🔥 STEP 3: Building frontend..."
sudo npm run build
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

# Step 4: Verify build
echo "🧪 STEP 4: Verifying build..."
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

# Step 5: Deploy to nginx
echo "🌐 STEP 5: Deploying to nginx..."
sudo rm -rf "$NGINX_ROOT/*"
sudo cp -r dist/* "$NGINX_ROOT/"
sudo chown -R www-data:www-data "$NGINX_ROOT"
sudo chmod -R 755 "$NGINX_ROOT"
echo -e "${GREEN}✓ Deployed to nginx${NC}"
echo ""

# Step 6: Verify deployment
echo "🧪 STEP 6: Verifying deployment..."
if [ ! -f "$NGINX_ROOT/index.html" ]; then
    echo -e "${RED}✗ Deployment failed - index.html not in nginx root${NC}"
    exit 1
fi
if [ ! -d "$NGINX_ROOT/assets" ]; then
    echo -e "${RED}✗ Deployment failed - assets folder not in nginx root${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Deployment verified${NC}"
echo ""

# Step 7: Restart nginx
echo "🔄 STEP 7: Restarting nginx..."
sudo systemctl restart nginx
echo -e "${GREEN}✓ Nginx restarted${NC}"
echo ""

# Step 8: Final verification
echo "🧪 STEP 8: Final verification..."
echo "   Files in nginx root:"
ls -la "$NGINX_ROOT"
echo ""
echo "   Assets folder:"
ls -la "$NGINX_ROOT/assets" | head -10
echo ""

echo "=========================================="
echo "DEPLOYMENT RECOVERY COMPLETE"
echo "=========================================="
echo ""
echo "🌐 NEXT STEPS:"
echo "1. Open https://getbitmind.com in browser"
echo "2. Open DevTools (F12)"
echo "3. Check Console for: 🔥 BITMIND FRONTEND EXECUTING"
echo "4. Check: window.__BITMIND_RUNTIME (should be true)"
echo "5. Click 'Connect Miner' button (should show alert)"
echo ""
