#!/bin/bash
# BITMIND CANONICAL DEPLOY SCRIPT
# Single deterministic deployment - no manual steps
# Usage: cd /opt/Bitmind && bash deploy.sh

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO_DIR="/opt/Bitmind"
FRONTEND_DIR="$REPO_DIR/bitmind-ui"
NGINX_ROOT="/usr/share/nginx/html"
BACKEND_URL="http://localhost:3001"

echo "=========================================="
echo "BITMIND CANONICAL DEPLOY"
echo "=========================================="

# ── STEP 1: Pull latest code ─────────────────
echo "[1/7] Pulling latest code..."
cd "$REPO_DIR"
git fetch origin
git reset --hard origin/main
echo -e "${GREEN}✓ Code synced${NC}"

# ── STEP 2: Ensure .env exists ───────────────
echo "[2/7] Ensuring .env file..."
if [ ! -f "$REPO_DIR/.env" ]; then
  cat > "$REPO_DIR/.env" << 'ENVEOF'
PORT=3001
STRATUM_PORT=3333
RPC_HOST=127.0.0.1
RPC_PORT=8332
RPC_USER=Global
RPC_PASSWORD=BITMIND400K@Hot$$$
ENVEOF
  echo -e "${YELLOW}⚠ Created default .env (update RPC_HOST for Tailscale)${NC}"
else
  echo -e "${GREEN}✓ .env exists${NC}"
fi

# ── STEP 3: Install backend deps ─────────────
echo "[3/7] Installing backend dependencies..."
cd "$REPO_DIR/server"
npm ci
echo -e "${GREEN}✓ Backend dependencies installed${NC}"

# ── STEP 4: Build frontend ───────────────────
echo "[4/7] Building frontend..."
cd "$FRONTEND_DIR"
rm -rf dist node_modules/.vite
npm ci
npm run build
if grep -r "/api/devices" dist/ > /dev/null 2>&1; then
  echo -e "${RED}✗ FAIL: Legacy /api/devices found in build - aborting${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Frontend built and validated${NC}"

# ── STEP 5: Deploy frontend to nginx ─────────
echo "[5/7] Deploying frontend to nginx..."
sudo rm -rf "$NGINX_ROOT"/*
sudo cp -r dist/* "$NGINX_ROOT/"
sudo chown -R www-data:www-data "$NGINX_ROOT"
sudo chmod -R 755 "$NGINX_ROOT"
sudo nginx -t && sudo systemctl reload nginx
echo -e "${GREEN}✓ Frontend deployed${NC}"

# ── STEP 6: Create logs dir and restart backend
echo "[6/7] Restarting backend..."
mkdir -p "$REPO_DIR/logs"
pm2 delete bitmind 2>/dev/null || true
pm2 start "$REPO_DIR/deployment/ecosystem.config.js" --env production
pm2 save
echo -e "${GREEN}✓ Backend started${NC}"

# ── STEP 7: Verify ───────────────────────────
echo "[7/7] Verifying backend health..."
sleep 4
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
MINERS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/miners")
if [ "$HEALTH" = "200" ] && [ "$MINERS" = "200" ]; then
  echo -e "${GREEN}✓ /health = 200, /api/miners = 200${NC}"
else
  echo -e "${RED}✗ /health=$HEALTH /api/miners=$MINERS - check: pm2 logs bitmind${NC}"
  pm2 logs bitmind --lines 20 --nostream
  exit 1
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}==========================================${NC}"
pm2 status
echo ""
echo "Verify: https://getbitmind.com"
