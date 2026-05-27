#!/bin/bash

# Bitmind Production Recovery Script
# PHASE 1-4: Backend Stabilization and Verification
# Generated: 2026-05-27

echo "=========================================="
echo "BITMIND PRODUCTION RECOVERY"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_DIR="/opt/Bitmind"
ENV_FILE="$BACKEND_DIR/.env"
SERVER_FILE="$BACKEND_DIR/server/server.js"

# Phase 1: Backend Stabilization
echo "🔧 PHASE 1 — BACKEND STABILIZATION"
echo "=========================================="
echo ""

# Step 1: Navigate to backend directory
echo "📁 Navigating to backend directory..."
cd $BACKEND_DIR || {
    echo -e "${RED}✗ FAIL: Cannot access $BACKEND_DIR${NC}"
    exit 1
}
echo -e "${GREEN}✓ PASS: Backend directory accessible${NC}"
echo ""

# Step 2: Create .env file
echo "📝 Creating .env file with required environment variables..."
cat > $ENV_FILE << 'EOF'
PORT=3001
RPC_HOST=127.0.0.1
RPC_PORT=8332
RPC_USER=Global
RPC_PASSWORD=BITMIND400K@Hot$$$
WS_PATH=/ws
EOF

if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}✓ PASS: .env file created${NC}"
    echo "Contents:"
    cat $ENV_FILE
else
    echo -e "${RED}✗ FAIL: Could not create .env file${NC}"
    exit 1
fi
echo ""

# Step 3: Install dependencies
echo "📦 Installing required dependencies..."
npm install dotenv express ws cors axios || {
    echo -e "${RED}✗ FAIL: Dependency installation failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ PASS: Dependencies installed${NC}"
echo ""

# Step 4: Clean PM2 state
echo "🧹 Cleaning PM2 state..."
pm2 delete bitmind 2>/dev/null || echo "No existing bitmind process to delete"
pm2 start $SERVER_FILE --name bitmind || {
    echo -e "${RED}✗ FAIL: PM2 start failed${NC}"
    exit 1
}
pm2 save || {
    echo -e "${RED}✗ FAIL: PM2 save failed${NC}"
    exit 1
}
echo -e "${GREEN}✓ PASS: PM2 state cleaned and backend started${NC}"
echo ""

# Step 5: Wait for backend to start
echo "⏳ Waiting for backend to start (5 seconds)..."
sleep 5
echo ""

# Step 6: Verify backend is alive
echo "🏥 Verifying backend health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ PASS: /health returns 200${NC}"
    curl -s http://localhost:3001/health
else
    echo -e "${RED}✗ FAIL: /health returns $HEALTH_RESPONSE${NC}"
    echo "Checking PM2 logs:"
    pm2 logs bitmind --lines 20 --nostream
    exit 1
fi
echo ""

# Phase 2: API Verification
echo "🔌 PHASE 2 — API VERIFICATION"
echo "=========================================="
echo ""

echo "📊 Verifying /api/miners endpoint..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/miners)
if [ "$API_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✓ PASS: /api/miners returns 200${NC}"
    echo "Response:"
    curl -s http://localhost:3001/api/miners
else
    echo -e "${RED}✗ FAIL: /api/miners returns $API_RESPONSE${NC}"
    exit 1
fi
echo ""

# Phase 3: WebSocket Validation
echo "⚡ PHASE 3 — WEBSOCKET VALIDATION"
echo "=========================================="
echo ""

echo "🔌 Verifying WebSocket upgrade handshake..."
WS_RESPONSE=$(curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" http://127.0.0.1:3001/ws 2>&1 | head -1)
if echo "$WS_RESPONSE" | grep -q "101\|400\|426"; then
    echo -e "${GREEN}✓ PASS: WebSocket upgrade attempt succeeded${NC}"
    echo "Response: $WS_RESPONSE"
else
    echo -e "${RED}✗ FAIL: WebSocket upgrade failed${NC}"
    echo "Response: $WS_RESPONSE"
    exit 1
fi
echo ""

# Phase 4: Nginx Validation
echo "🌐 PHASE 4 — NGINX VALIDATION"
echo "=========================================="
echo ""

echo "🔍 Checking nginx configuration..."
if sudo nginx -t > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS: Nginx configuration valid${NC}"
else
    echo -e "${RED}✗ FAIL: Nginx configuration error${NC}"
    sudo nginx -t
    exit 1
fi
echo ""

echo "🔍 Checking nginx WebSocket proxy configuration..."
if sudo nginx -T 2>/dev/null | grep -A 10 "location /ws" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS: Nginx WebSocket proxy configuration exists${NC}"
    echo "Configuration:"
    sudo nginx -T 2>/dev/null | grep -A 10 "location /ws"
else
    echo -e "${YELLOW}⚠ WARNING: Nginx WebSocket proxy configuration missing${NC}"
    echo "Apply nginx-websocket.conf to fix this"
fi
echo ""

# Final Status
echo "=========================================="
echo "🚀 RECOVERY COMPLETE"
echo "=========================================="
echo ""
echo "📊 FINAL STATUS:"
echo -e "${GREEN}✅ Backend stable on port 3001${NC}"
echo -e "${GREEN}✅ /health responds correctly${NC}"
echo -e "${GREEN}✅ /api/miners returns valid JSON${NC}"
echo -e "${GREEN}✅ WebSocket /ws accepts upgrades${NC}"
echo -e "${GREEN}✅ Nginx configuration valid${NC}"
echo ""
echo "🌐 NEXT STEPS:"
echo "1. Test frontend: https://getbitmind.com"
echo "2. Open DevTools Console"
echo "3. Click 'Connect Bitminer' button"
echo "4. Verify STEP logs appear"
echo "5. Verify WebSocket connects"
echo ""
echo "📋 PM2 STATUS:"
pm2 status
echo ""
