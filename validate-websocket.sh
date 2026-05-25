#!/bin/bash

# Bitmind WebSocket Validation Script
# Tests WebSocket connectivity on VPS
# CRITICAL: Run this to debug WebSocket issues

echo "=========================================="
echo "BITMIND WEBSOCKET VALIDATION"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://127.0.0.1:3001"
WS_URL="ws://127.0.0.1:3001/ws"

echo "📋 VALIDATION CONFIGURATION:"
echo "   Backend URL: $BACKEND_URL"
echo "   WebSocket URL: $WS_URL"
echo ""

# TEST 1: Check if backend is listening on port 3001
echo "🧪 TEST 1: Check if backend is listening on port 3001..."
if sudo ss -tulpn | grep 3001 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS: Backend is listening on port 3001${NC}"
    sudo ss -tulpn | grep 3001
else
    echo -e "${RED}✗ FAIL: Backend is NOT listening on port 3001${NC}"
    echo "PM2 status:"
    pm2 status
    exit 1
fi
echo ""

# TEST 2: Test API endpoint
echo "🧪 TEST 2: Test API endpoint /api/miners..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/miners")
if [ "$API_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ PASS: /api/miners returns 200${NC}"
else
    echo -e "${RED}✗ FAIL: /api/miners returns $API_RESPONSE${NC}"
    exit 1
fi
echo ""

# TEST 3: Test WebSocket connection locally
echo "🧪 TEST 3: Test WebSocket connection locally..."
echo "Creating temporary WebSocket test script..."
cat > /tmp/ws-test.js << 'EOF'
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:3001/ws');

ws.on('open', () => {
  console.log('✅ WS CONNECTED');
  ws.close();
});

ws.on('error', (error) => {
  console.error('❌ WS ERROR:', error.message);
  process.exit(1);
});

ws.on('close', () => {
  console.log('✅ WS CLOSED');
  process.exit(0);
});

setTimeout(() => {
  console.error('❌ WS TIMEOUT');
  process.exit(1);
}, 5000);
EOF

cd /opt/Bitmind
node /tmp/ws-test.js
WS_EXIT_CODE=$?

if [ $WS_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ PASS: Local WebSocket connection works${NC}"
else
    echo -e "${RED}✗ FAIL: Local WebSocket connection failed${NC}"
    echo "This indicates a backend WebSocket server issue."
    echo "Check PM2 logs: pm2 logs bitmind"
    exit 1
fi
echo ""

# TEST 4: Check PM2 logs for WebSocket errors
echo "🧪 TEST 4: Check PM2 logs for WebSocket errors..."
echo "Recent PM2 logs (last 20 lines):"
pm2 logs bitmind --lines 20 --nostream
echo ""

# TEST 5: Check nginx WebSocket proxy configuration
echo "🧪 TEST 5: Check nginx WebSocket proxy configuration..."
if sudo nginx -T 2>/dev/null | grep -A 10 "location /ws" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS: Nginx WebSocket proxy configuration exists${NC}"
    echo "Nginx WebSocket proxy config:"
    sudo nginx -T 2>/dev/null | grep -A 10 "location /ws"
else
    echo -e "${RED}✗ FAIL: Nginx WebSocket proxy configuration missing${NC}"
    echo "Add WebSocket proxy to nginx config:"
    echo ""
    echo "location /ws {"
    echo "    proxy_pass http://localhost:3001;"
    echo "    proxy_http_version 1.1;"
    echo "    proxy_set_header Upgrade \$http_upgrade;"
    echo "    proxy_set_header Connection \"Upgrade\";"
    echo "    proxy_set_header Host \$host;"
    echo "}"
fi
echo ""

# TEST 6: Test nginx configuration syntax
echo "🧪 TEST 6: Test nginx configuration syntax..."
if sudo nginx -t > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS: Nginx configuration syntax is valid${NC}"
else
    echo -e "${RED}✗ FAIL: Nginx configuration syntax error${NC}"
    sudo nginx -t
    exit 1
fi
echo ""

echo "=========================================="
echo "VALIDATION COMPLETE"
echo "=========================================="
echo ""
echo "📊 SUMMARY:"
echo "✅ Backend listening on port 3001"
echo "✅ API endpoint works"
echo "✅ Local WebSocket connection works"
echo "✅ Nginx configuration valid"
echo ""
echo "🌐 NEXT STEPS:"
echo "1. If all tests pass: WebSocket server is working locally"
echo "2. Check nginx WebSocket proxy configuration"
echo "3. Test from browser: https://getbitmind.com"
echo "4. Check browser DevTools Console for WebSocket errors"
echo ""
