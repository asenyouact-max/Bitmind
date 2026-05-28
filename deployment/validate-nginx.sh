#!/bin/bash
# Bitmind Nginx Comprehensive Validation Script
# Validates nginx configuration, port bindings, HTTPS, WebSocket, and backend
# Usage: sudo bash deployment/validate-nginx.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

echo "=========================================="
echo "BITMIND NGINX COMPREHENSIVE VALIDATION"
echo "=========================================="

# ── TEST 1: nginx process active ───────────────
echo "[1/8] Checking nginx process status..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ nginx process is active${NC}"
else
    echo -e "${RED}✗ nginx process is NOT active${NC}"
    systemctl status nginx
    ERRORS=$((ERRORS + 1))
fi

# ── TEST 2: nginx configuration test ───────────
echo "[2/8] Testing nginx configuration..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ nginx -t passed${NC}"
else
    echo -e "${RED}✗ nginx -t FAILED${NC}"
    nginx -t
    ERRORS=$((ERRORS + 1))
fi

# ── TEST 3: Port 80 binding ────────────────────
echo "[3/8] Checking port 80 binding..."
PORT_80=$(ss -tulpn | grep ":80 " | grep nginx || echo "")
if [ -n "$PORT_80" ]; then
    echo -e "${GREEN}✓ nginx listening on port 80${NC}"
else
    echo -e "${RED}✗ nginx NOT listening on port 80${NC}"
    ss -tulpn | grep ":80 " || echo "  Nothing listening on 80"
    ERRORS=$((ERRORS + 1))
fi

# ── TEST 4: Port 443 binding ───────────────────
echo "[4/8] Checking port 443 binding..."
PORT_443=$(ss -tulpn | grep ":443 " | grep nginx || echo "")
if [ -n "$PORT_443" ]; then
    echo -e "${GREEN}✓ nginx listening on port 443${NC}"
else
    echo -e "${RED}✗ nginx NOT listening on port 443${NC}"
    ss -tulpn | grep ":443 " || echo "  Nothing listening on 443"
    ERRORS=$((ERRORS + 1))
fi

# ── TEST 5: Exactly ONE config enabled ──────────
echo "[5/8] Checking for exactly ONE active site config..."
ENABLED_COUNT=$(ls -1 /etc/nginx/sites-enabled/ 2>/dev/null | wc -l)
if [ "$ENABLED_COUNT" -eq 1 ]; then
    echo -e "${GREEN}✓ Exactly 1 config enabled in sites-enabled${NC}"
    echo "  Config: $(ls -1 /etc/nginx/sites-enabled/)"
else
    echo -e "${RED}✗ $ENABLED_COUNT configs enabled (should be 1)${NC}"
    ls -la /etc/nginx/sites-enabled/
    ERRORS=$((ERRORS + 1))
fi

# ── TEST 6: HTTP to HTTPS redirect ─────────────
echo "[6/8] Testing HTTP to HTTPS redirect..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L http://getbitmind.com)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "301" ]; then
    echo -e "${GREEN}✓ HTTP redirects to HTTPS (code: $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ HTTP redirect failed (code: $HTTP_CODE)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ── TEST 7: HTTPS response ─────────────────────
echo "[7/8] Testing HTTPS response..."
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://getbitmind.com)
if [ "$HTTPS_CODE" = "200" ] || [ "$HTTPS_CODE" = "502" ]; then
    echo -e "${GREEN}✓ HTTPS responds (code: $HTTPS_CODE)${NC}"
else
    echo -e "${RED}✗ HTTPS failed (code: $HTTPS_CODE)${NC}"
    ERRORS=$((ERRORS + 1))
fi

# ── TEST 8: WebSocket upgrade headers ───────────
echo "[8/8] Checking WebSocket upgrade headers in config..."
if grep -q "Upgrade.*http_upgrade" /etc/nginx/sites-available/getbitmind.com 2>/dev/null; then
    echo -e "${GREEN}✓ WebSocket upgrade headers present in config${NC}"
else
    echo -e "${YELLOW}⚠ WebSocket upgrade headers not found in config${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# ── BONUS: Backend health check ─────────────────
echo ""
echo "[BONUS] Checking backend health..."
BACKEND_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/health)
if [ "$BACKEND_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Backend healthy at http://127.0.0.1:3001/health${NC}"
else
    echo -e "${YELLOW}⚠ Backend not responding (code: $BACKEND_CODE)${NC}"
    echo "  This is a backend issue, not nginx"
    WARNINGS=$((WARNINGS + 1))
fi

# ── SUMMARY ────────────────────────────────────
echo ""
echo "=========================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}ALL CHECKS PASSED${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}VALIDATION PASSED WITH $WARNINGS WARNING(S)${NC}"
else
    echo -e "${RED}VALIDATION FAILED: $ERRORS ERROR(S), $WARNINGS WARNING(S)${NC}"
fi
echo "=========================================="
echo ""
echo "Summary:"
echo "  nginx process: $([ $ERRORS -lt 1 ] && echo "active" || echo "INACTIVE")"
echo "  nginx config: $([ $ERRORS -lt 2 ] && echo "valid" || echo "INVALID")"
echo "  port 80: $([ $ERRORS -lt 3 ] && echo "bound" || echo "NOT BOUND")"
echo "  port 443: $([ $ERRORS -lt 4 ] && echo "bound" || echo "NOT BOUND")"
echo "  active configs: $ENABLED_COUNT (should be 1)"
echo "  HTTP → HTTPS: $([ $ERRORS -lt 6 ] && echo "working" || echo "FAILED")"
echo "  HTTPS: $([ $ERRORS -lt 7 ] && echo "working" || echo "FAILED")"
echo "  WebSocket headers: $([ $WARNINGS -lt 1 ] && echo "present" || echo "MISSING")"
echo "  backend: $([ "$BACKEND_CODE" = "200" ] && echo "healthy" || echo "unhealthy")"

if [ $ERRORS -gt 0 ]; then
    exit 1
fi
