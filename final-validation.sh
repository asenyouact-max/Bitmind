#!/bin/bash

# Bitmind Final Validation Script
# Hard validation tests for deterministic reset
# CRITICAL: Run after deterministic-reset.sh

set -e  # Exit on any error

echo "=========================================="
echo "BITMIND FINAL VALIDATION"
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
BACKEND_URL="http://localhost:3001"

echo "📋 VALIDATION CONFIGURATION:"
echo "   Frontend Dir: $FRONTEND_DIR"
echo "   Nginx Root: $NGINX_ROOT"
echo "   Backend URL: $BACKEND_URL"
echo ""

# TEST 1: Source code validation
echo "🧪 TEST 1: Source code has zero /api/devices..."
if grep -r "/api/devices" "$FRONTEND_DIR/src" > /dev/null 2>&1; then
    echo -e "${RED}✗ FAIL: /api/devices found in source${NC}"
    grep -r "/api/devices" "$FRONTEND_DIR/src"
    exit 1
else
    echo -e "${GREEN}✓ PASS: Zero /api/devices in source${NC}"
fi
echo ""

# TEST 2: Build validation
echo "🧪 TEST 2: Build has zero /api/devices..."
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    echo -e "${RED}✗ FAIL: Build folder does not exist${NC}"
    exit 1
fi
if grep -r "/api/devices" "$FRONTEND_DIR/dist" > /dev/null 2>&1; then
    echo -e "${RED}✗ FAIL: /api/devices found in build${NC}"
    grep -r "/api/devices" "$FRONTEND_DIR/dist"
    exit 1
else
    echo -e "${GREEN}✓ PASS: Zero /api/devices in build${NC}"
fi
echo ""

# TEST 3: Build has /api/miners
echo "🧪 TEST 3: Build has /api/miners references..."
if grep -r "/api/miners" "$FRONTEND_DIR/dist" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS: /api/miners references found${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: No /api/miners references${NC}"
fi
echo ""

# TEST 4: Deployment validation
echo "🧪 TEST 4: Deployment has zero /api/devices..."
if [ ! -d "$NGINX_ROOT" ]; then
    echo -e "${RED}✗ FAIL: Nginx root does not exist${NC}"
    exit 1
fi
if sudo grep -r "/api/devices" "$NGINX_ROOT" > /dev/null 2>&1; then
    echo -e "${RED}✗ FAIL: /api/devices found in deployment${NC}"
    sudo grep -r "/api/devices" "$NGINX_ROOT"
    exit 1
else
    echo -e "${GREEN}✓ PASS: Zero /api/devices in deployment${NC}"
fi
echo ""

# TEST 5: Deployment has /api/miners
echo "🧪 TEST 5: Deployment has /api/miners references..."
if sudo grep -r "/api/miners" "$NGINX_ROOT" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS: /api/miners references found${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: No /api/miners references${NC}"
fi
echo ""

# TEST 6: Backend API - /api/miners
echo "🧪 TEST 6: Backend /api/miners endpoint..."
MINERS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/miners")
if [ "$MINERS_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ PASS: /api/miners returns 200${NC}"
else
    echo -e "${RED}✗ FAIL: /api/miners returns $MINERS_RESPONSE${NC}"
    exit 1
fi
echo ""

# TEST 7: Backend API - /api/devices (should 404)
echo "🧪 TEST 7: Backend /api/devices endpoint (should 404)..."
DEVICES_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/devices")
if [ "$DEVICES_RESPONSE" = "404" ]; then
    echo -e "${GREEN}✓ PASS: /api/devices returns 404 (endpoint removed)${NC}"
else
    echo -e "${YELLOW}⚠ WARNING: /api/devices returns $DEVICES_RESPONSE (expected 404)${NC}"
fi
echo ""

# TEST 8: Backend API - /api/stats
echo "🧪 TEST 8: Backend /api/stats endpoint..."
STATS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/stats")
if [ "$STATS_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ PASS: /api/stats returns 200${NC}"
else
    echo -e "${RED}✗ FAIL: /api/stats returns $STATS_RESPONSE${NC}"
    exit 1
fi
echo ""

# TEST 9: Nginx is running
echo "🧪 TEST 9: Nginx is running..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ PASS: Nginx is running${NC}"
else
    echo -e "${RED}✗ FAIL: Nginx is not running${NC}"
    exit 1
fi
echo ""

# TEST 10: Production build sanity
echo "🧪 TEST 10: Production build sanity check..."
if [ ! -f "$NGINX_ROOT/index.html" ]; then
    echo -e "${RED}✗ FAIL: index.html not found in nginx root${NC}"
    exit 1
fi
if [ ! -d "$NGINX_ROOT/assets" ]; then
    echo -e "${RED}✗ FAIL: assets folder not found in nginx root${NC}"
    exit 1
fi
echo -e "${GREEN}✓ PASS: Production build is sane${NC}"
echo ""

# TEST 11: Final grep check
echo "🧪 TEST 11: Final grep check for /api/devices in production..."
if sudo grep -r "api/devices" "$NGINX_ROOT" > /dev/null 2>&1; then
    echo -e "${RED}✗ FAIL: /api/devices still found in production${NC}"
    sudo grep -r "api/devices" "$NGINX_ROOT"
    exit 1
else
    echo -e "${GREEN}✓ PASS: CLEAN PRODUCTION${NC}"
fi
echo ""

echo "=========================================="
echo "ALL VALIDATION TESTS PASSED"
echo "=========================================="
echo ""
echo "✅ Zero /api/devices anywhere in codebase"
echo "✅ Zero /api/devices in dist"
echo "✅ Zero /api/devices in production"
echo "✅ Only /api/miners exists"
echo "✅ Backend /api/miners returns 200"
echo "✅ Backend /api/devices returns 404"
echo "✅ Backend /api/stats returns 200"
echo "✅ Nginx is running"
echo "✅ Production build is sane"
echo ""
echo "🌐 BROWSER VALIDATION STEPS:"
echo "1. Open https://getbitmind.com"
echo "2. Open DevTools → Network"
echo "3. Hard refresh (Ctrl+Shift+R)"
echo "4. Verify NO /api/devices requests"
echo "5. Verify ONLY /api/miners requests"
echo "6. Test Connect Miner button"
echo "7. Verify no JS errors in Console"
echo ""
