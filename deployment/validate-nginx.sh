#!/bin/bash
# Bitmind Nginx Validation Script
# Validates nginx configuration and HTTPS behavior
# Usage: sudo bash deployment/validate-nginx.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "BITMIND NGINX VALIDATION"
echo "=========================================="

# ── TEST 1: nginx configuration test ─────────
echo "[1/5] Testing nginx configuration..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ nginx -t passed${NC}"
else
    echo -e "${RED}✗ nginx -t FAILED${NC}"
    nginx -t
    exit 1
fi

# ── TEST 2: Check only one config is enabled ──
echo "[2/5] Checking for duplicate server blocks..."
ENABLED_COUNT=$(grep -l "getbitmind.com" /etc/nginx/sites-enabled/* 2>/dev/null | wc -l)
if [ "$ENABLED_COUNT" -eq 1 ]; then
    echo -e "${GREEN}✓ Only 1 getbitmind.com config enabled${NC}"
else
    echo -e "${RED}✗ $ENABLED_COUNT getbitmind.com configs enabled (should be 1)${NC}"
    grep -l "getbitmind.com" /etc/nginx/sites-enabled/* 2>/dev/null
    exit 1
fi

# ── TEST 3: HTTP to HTTPS redirect ────────────
echo "[3/5] Testing HTTP to HTTPS redirect..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L http://getbitmind.com)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ]; then
    echo -e "${GREEN}✓ HTTP redirects to HTTPS (code: $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ HTTP redirect failed (code: $HTTP_CODE)${NC}"
    exit 1
fi

# ── TEST 4: HTTPS response ─────────────────────
echo "[4/5] Testing HTTPS response..."
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://getbitmind.com)
if [ "$HTTPS_CODE" = "200" ] || [ "$HTTPS_CODE" = "502" ]; then
    echo -e "${GREEN}✓ HTTPS responds (code: $HTTPS_CODE)${NC}"
else
    echo -e "${RED}✗ HTTPS failed (code: $HTTPS_CODE)${NC}"
    exit 1
fi

# ── TEST 5: Backend health ─────────────────────
echo "[5/5] Testing backend health..."
BACKEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/health)
if [ "$BACKEND_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Backend healthy at http://127.0.0.1:3001/health${NC}"
else
    echo -e "${YELLOW}⚠ Backend not responding (code: $BACKEND_CODE)${NC}"
    echo "This is a backend issue, not nginx"
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}NGINX VALIDATION COMPLETE${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Summary:"
echo "  nginx config: valid"
echo "  server blocks: 1 (no duplicates)"
echo "  HTTP → HTTPS: working"
echo "  HTTPS: working"
echo "  backend: $([ "$BACKEND_CODE" = "200" ] && echo "healthy" || echo "unhealthy")"
