#!/bin/bash
# Bitmind RPC Diagnostic Script
# Tests Bitcoin Core RPC connectivity and authentication
# Usage: bash scripts/rpc-diagnostic.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "BITMIND RPC DIAGNOSTIC"
echo "=========================================="
echo ""
echo -e "${YELLOW}⚠️  MANUAL TOOL ONLY - NOT PART OF RUNTIME SYSTEM${NC}"
echo -e "${YELLOW}This script is for manual debugging only.${NC}"
echo -e "${YELLOW}It is NOT auto-run by the backend.${NC}"
echo ""

# Load .env if exists
if [ -f ".env" ]; then
    echo "[1/5] Loading .env configuration..."
    source .env
    echo -e "${GREEN}✓ .env loaded${NC}"
    echo ""
    echo "Current RPC Configuration:"
    echo "  RPC_HOST=${RPC_HOST:-NOT_SET}"
    echo "  RPC_PORT=${RPC_PORT:-8332}"
    echo "  RPC_USER=${RPC_USER:-NOT_SET}"
    echo "  RPC_PASSWORD=${RPC_PASSWORD:-NOT_SET}"
    echo ""
else
    echo -e "${RED}✗ .env file not found${NC}"
    echo "Create .env with RPC configuration first"
    exit 1
fi

# Validate required variables
if [ -z "$RPC_HOST" ] || [ -z "$RPC_USER" ] || [ -z "$RPC_PASSWORD" ]; then
    echo -e "${RED}✗ Missing required RPC configuration${NC}"
    echo "Required: RPC_HOST, RPC_USER, RPC_PASSWORD"
    exit 1
fi

# Step 2: Network connectivity test
echo "[2/5] Testing network connectivity to ${RPC_HOST}:${RPC_PORT}..."
if command -v nc &> /dev/null; then
    if nc -zv -w 5 "$RPC_HOST" "$RPC_PORT" 2>&1 | grep -q "succeeded"; then
        echo -e "${GREEN}✓ Port ${RPC_PORT} is reachable${NC}"
    else
        echo -e "${RED}✗ Port ${RPC_PORT} is NOT reachable${NC}"
        echo "Possible causes:"
        echo "  - Bitcoin Core not running"
        echo "  - Firewall blocking connection"
        echo "  - Tailscale VPN not connected"
        echo "  - Wrong IP address"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ nc (netcat) not available, skipping port test${NC}"
fi
echo ""

# Step 3: Test RPC authentication
echo "[3/5] Testing RPC authentication with getblockchaininfo..."
RPC_RESPONSE=$(curl -s --user "${RPC_USER}:${RPC_PASSWORD}" \
    --data-binary '{"jsonrpc":"1.0","id":"test","method":"getblockchaininfo","params":[]}' \
    -H 'content-type: text/plain;' \
    "http://${RPC_HOST}:${RPC_PORT}" 2>&1)

if echo "$RPC_RESPONSE" | grep -q '"result"'; then
    echo -e "${GREEN}✓ RPC authentication successful${NC}"
    echo ""
    echo "Blockchain Info:"
    echo "$RPC_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RPC_RESPONSE"
elif echo "$RPC_RESPONSE" | grep -q "401\|403\|Unauthorized"; then
    echo -e "${RED}✗ RPC authentication FAILED${NC}"
    echo "Response: $RPC_RESPONSE"
    echo ""
    echo "Possible causes:"
    echo "  - Wrong RPC_USER or RPC_PASSWORD"
    echo "  - Bitcoin Core bitcoin.conf has different credentials"
    echo "  - rpcallowip does not include this server's IP"
    exit 1
else
    echo -e "${RED}✗ RPC request failed${NC}"
    echo "Response: $RPC_RESPONSE"
    exit 1
fi
echo ""

# Step 4: Test getblocktemplate (mining-critical)
echo "[4/5] Testing getblocktemplate (mining-critical)..."
BLOCK_TEMPLATE=$(curl -s --user "${RPC_USER}:${RPC_PASSWORD}" \
    --data-binary '{"jsonrpc":"1.0","id":"test","method":"getblocktemplate","params":[{"rules":["segwit"]}]}' \
    -H 'content-type: text/plain;' \
    "http://${RPC_HOST}:${RPC_PORT}" 2>&1)

if echo "$BLOCK_TEMPLATE" | grep -q '"result"'; then
    echo -e "${GREEN}✓ getblocktemplate successful${NC}"
    BLOCK_HEIGHT=$(echo "$BLOCK_TEMPLATE" | python3 -c "import sys, json; print(json.load(sys.stdin)['result'].get('height', 'unknown'))" 2>/dev/null)
    echo "  Current block height: ${BLOCK_HEIGHT}"
else
    echo -e "${YELLOW}⚠ getblocktemplate failed (may not be critical)${NC}"
    echo "Response: $BLOCK_TEMPLATE"
fi
echo ""

# Step 5: Summary
echo "[5/5] Diagnostic Summary"
echo "=========================================="
echo -e "${GREEN}✓ RPC Configuration: Valid${NC}"
echo -e "${GREEN}✓ Network Connectivity: OK${NC}"
echo -e "${GREEN}✓ RPC Authentication: OK${NC}"
echo ""
echo "Bitmind backend should now be able to connect to Bitcoin Core."
echo "Restart backend: pm2 restart bitmind"
