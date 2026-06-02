#!/bin/bash

# Bitmind Production Verification Script
# Checks deployment integrity and frontend execution

echo "=========================================="
echo "BITMIND PRODUCTION VERIFICATION"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
NGINX_ROOT="/usr/share/nginx/html"
FRONTEND_DIR="/opt/Bitmind/bitmind-ui"

echo "📋 CHECKING DEPLOYMENT INTEGRITY..."
echo ""

# Check 1: Nginx root exists
echo -n "1. Nginx root directory exists... "
if [ -d "$NGINX_ROOT" ]; then
    echo -e "${GREEN}✓${NC} ($NGINX_ROOT)"
else
    echo -e "${RED}✗${NC} (not found: $NGINX_ROOT)"
    echo "Please check nginx configuration: sudo nginx -T | grep root"
    exit 1
fi

# Check 2: index.html exists
echo -n "2. index.html exists... "
if [ -f "$NGINX_ROOT/index.html" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC} (missing)"
    echo "Frontend not deployed to nginx root"
    exit 1
fi

# Check 3: assets folder exists
echo -n "3. assets folder exists... "
if [ -d "$NGINX_ROOT/assets" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC} (missing)"
    echo "Assets folder not deployed"
    exit 1
fi

# Check 4: JS bundle exists
echo -n "4. JS bundle exists... "
JS_BUNDLE=$(ls $NGINX_ROOT/assets/index-*.js 2>/dev/null | head -1)
if [ -f "$JS_BUNDLE" ]; then
    echo -e "${GREEN}✓${NC} ($(basename $JS_BUNDLE))"
else
    echo -e "${RED}✗${NC} (not found)"
    echo "JS bundle not found in assets folder"
    exit 1
fi

# Check 5: JS bundle size
echo -n "5. JS bundle size... "
JS_SIZE=$(stat -f%z "$JS_BUNDLE" 2>/dev/null || stat -c%s "$JS_BUNDLE" 2>/dev/null)
if [ "$JS_SIZE" -gt 1000 ]; then
    echo -e "${GREEN}✓${NC} ($((JS_SIZE / 1024))KB)"
else
    echo -e "${RED}✗${NC} ($(JS_SIZE) bytes - too small)"
    echo "JS bundle appears to be empty or corrupted"
    exit 1
fi

# Check 6: index.html contains __BITMIND_DEBUG
echo -n "6. index.html contains debug flag... "
if grep -q "__BITMIND_DEBUG" "$NGINX_ROOT/index.html"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC} (not found - may be old build)"
    echo "index.html may not contain latest code"
fi

# Check 7: index.html contains alert("CLICK WORKS")
echo -n "7. index.html contains debug alerts... "
if grep -q "CLICK WORKS" "$NGINX_ROOT/index.html"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC} (not found - may be old build)"
    echo "index.html may not contain latest debug code"
fi

# Check 8: Nginx is running
echo -n "8. Nginx is running... "
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC} (not running)"
    echo "Nginx is not running"
    exit 1
fi

# Check 9: Nginx configuration is valid
echo -n "9. Nginx configuration valid... "
if sudo nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC} (configuration error)"
    echo "Nginx configuration has errors"
    sudo nginx -t
    exit 1
fi

# Check 10: File timestamps
echo ""
echo "📅 FILE TIMESTAMPS:"
echo "   index.html: $(stat -f%m "$NGINX_ROOT/index.html" 2>/dev/null || stat -c%Y "$NGINX_ROOT/index.html" 2>/dev/null | xargs -I{} date -r {} '+%Y-%m-%d %H:%M:%S')"
echo "   JS bundle:   $(stat -f%m "$JS_BUNDLE" 2>/dev/null || stat -c%Y "$JS_BUNDLE" 2>/dev/null | xargs -I{} date -r {} '+%Y-%m-%d %H:%M:%S')"

# Check 11: Source dist folder
echo ""
echo -n "11. Source dist folder exists... "
if [ -d "$FRONTEND_DIR/dist" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${YELLOW}⚠${NC} (not found - build may not exist)"
fi

# Check 12: Compare source and deployed
if [ -d "$FRONTEND_DIR/dist" ]; then
    echo -n "12. Source and deployed match... "
    SOURCE_HASH=$(find "$FRONTEND_DIR/dist" -type f -exec md5sum {} \; | sort | md5sum | cut -d' ' -f1)
    DEPLOYED_HASH=$(find "$NGINX_ROOT" -type f -exec md5sum {} \; | sort | md5sum | cut -d' ' -f1)
    
    if [ "$SOURCE_HASH" = "$DEPLOYED_HASH" ]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠${NC} (mismatch - redeploy needed)"
    fi
fi

echo ""
echo "=========================================="
echo "VERIFICATION COMPLETE"
echo "=========================================="
echo ""
echo "🌐 NEXT STEPS:"
echo "1. Open https://getbitmind.com in browser"
echo "2. Open DevTools (F12)"
echo "3. Check Network tab for JS bundle (should be 200 OK)"
echo "4. Check Console for errors"
echo "5. Run: window.__BITMIND_DEBUG (should return true)"
echo "6. Click 'Connect Miner' button (should show alert)"
echo ""
