#!/bin/bash
# Bitmind Nginx Canonical Deployment Script
# Production-grade idempotent deployment with automatic rollback
# Usage: sudo bash deployment/deploy-nginx.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO_DIR="/opt/Bitmind"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
NGINX_CONF="/etc/nginx/nginx.conf"
CANONICAL_CONFIG="$REPO_DIR/deployment/nginx-canonical.conf"
TARGET_CONFIG="$NGINX_SITES_AVAILABLE/getbitmind.com"
BACKUP_DIR="/tmp/nginx-backup-$(date +%Y%m%d-%H%M%S)"

echo "=========================================="
echo "BITMIND NGINX CANONICAL DEPLOY"
echo "=========================================="

# ── STEP 0: Pre-flight checks ─────────────────
echo "[0/9] Pre-flight checks..."
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}✗ ERROR: This script must be run as root (sudo)${NC}"
    exit 1
fi

if [ ! -f "$CANONICAL_CONFIG" ]; then
    echo -e "${RED}✗ ERROR: Canonical config not found at $CANONICAL_CONFIG${NC}"
    exit 1
fi

if [ ! -d "$NGINX_SITES_AVAILABLE" ] || [ ! -d "$NGINX_SITES_ENABLED" ]; then
    echo -e "${RED}✗ ERROR: nginx directories not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Pre-flight checks passed${NC}"

# ── STEP 1: Backup existing configs ─────────────
echo "[1/9] Backing up existing nginx configs..."
mkdir -p "$BACKUP_DIR"

# Backup all nginx configs
cp -r "$NGINX_SITES_AVAILABLE" "$BACKUP_DIR/" 2>/dev/null || true
cp -r "$NGINX_SITES_ENABLED" "$BACKUP_DIR/" 2>/dev/null || true
cp "$NGINX_CONF" "$BACKUP_DIR/nginx.conf" 2>/dev/null || true

echo -e "${GREEN}✓ Backups saved to $BACKUP_DIR${NC}"

# ── STEP 2: Verify nginx.conf includes sites-enabled ──
echo "[2/9] Verifying nginx.conf include chain..."
if ! grep -q "include.*sites-enabled" "$NGINX_CONF"; then
    echo -e "${YELLOW}⚠ WARNING: nginx.conf may not include sites-enabled${NC}"
    echo "  Checking for include directives..."
    grep -n "include" "$NGINX_CONF" || echo "  No include directives found"
    echo -e "${YELLOW}⚠ This may cause configs to not load${NC}"
else
    echo -e "${GREEN}✓ nginx.conf includes sites-enabled${NC}"
fi

# ── STEP 3: HARD CLEAN - wipe sites-enabled ───────
echo "[3/9] HARD CLEAN: wiping sites-enabled..."
echo "  Current configs in sites-enabled:"
ls -la "$NGINX_SITES_ENABLED/" 2>/dev/null || echo "  (empty or missing)"
rm -f "$NGINX_SITES_ENABLED"/*
echo -e "${GREEN}✓ sites-enabled wiped${NC}"

# ── STEP 4: Remove old conflicting configs ─────────
echo "[4/9] Removing old conflicting configs from sites-available..."
for file in "$NGINX_SITES_AVAILABLE"/*; do
    if [ -f "$file" ] && grep -q "getbitmind.com" "$file" 2>/dev/null; then
        if [ "$(basename $file)" != "getbitmind.com" ]; then
            echo "  Removing old config: $(basename $file)"
            rm -f "$file"
        fi
    fi
done
echo -e "${GREEN}✓ Old configs removed${NC}"

# ── STEP 5: Deploy canonical config ───────────────
echo "[5/9] Deploying canonical nginx config..."
cp "$CANONICAL_CONFIG" "$TARGET_CONFIG"
echo -e "${GREEN}✓ Canonical config deployed to $TARGET_CONFIG${NC}"

# ── STEP 6: Enable ONLY canonical config ──────────
echo "[6/9] Enabling ONLY canonical config..."
ln -sf "$TARGET_CONFIG" "$NGINX_SITES_ENABLED/getbitmind.com"
echo -e "${GREEN}✓ Canonical config enabled${NC}"

# ── STEP 7: Test nginx configuration ───────────────
echo "[7/9] Testing nginx configuration..."
if nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${GREEN}✓ nginx -t passed${NC}"
else
    echo -e "${RED}✗ nginx -t FAILED${NC}"
    nginx -t
    echo "Rolling back..."
    cp -r "$BACKUP_DIR/sites-available"/* "$NGINX_SITES_AVAILABLE/" 2>/dev/null || true
    cp -r "$BACKUP_DIR/sites-enabled"/* "$NGINX_SITES_ENABLED/" 2>/dev/null || true
    systemctl reload nginx 2>/dev/null || true
    exit 1
fi

# ── STEP 8: Restart nginx ─────────────────────────
echo "[8/9] Restarting nginx..."
systemctl restart nginx
sleep 2

if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✓ nginx restarted successfully${NC}"
else
    echo -e "${RED}✗ nginx failed to start${NC}"
    systemctl status nginx
    echo "Rolling back..."
    cp -r "$BACKUP_DIR/sites-available"/* "$NGINX_SITES_AVAILABLE/" 2>/dev/null || true
    cp -r "$BACKUP_DIR/sites-enabled"/* "$NGINX_SITES_ENABLED/" 2>/dev/null || true
    systemctl restart nginx 2>/dev/null || true
    exit 1
fi

# ── STEP 9: Verify port bindings ───────────────────
echo "[9/9] Verifying port bindings..."
PORT_80=$(ss -tulpn | grep ":80 " | grep nginx || echo "")
PORT_443=$(ss -tulpn | grep ":443 " | grep nginx || echo "")

if [ -n "$PORT_80" ]; then
    echo -e "${GREEN}✓ nginx listening on port 80${NC}"
else
    echo -e "${RED}✗ nginx NOT listening on port 80${NC}"
    ss -tulpn | grep ":80 " || echo "  Nothing listening on 80"
fi

if [ -n "$PORT_443" ]; then
    echo -e "${GREEN}✓ nginx listening on port 443${NC}"
else
    echo -e "${RED}✗ nginx NOT listening on port 443${NC}"
    ss -tulpn | grep ":443 " || echo "  Nothing listening on 443"
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}NGINX DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Backup location: $BACKUP_DIR"
echo "Active config: $TARGET_CONFIG"
echo "Enabled symlink: $NGINX_SITES_ENABLED/getbitmind.com"
echo ""
echo "Run validation:"
echo "  sudo bash deployment/validate-nginx.sh"
