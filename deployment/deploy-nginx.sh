#!/bin/bash
# Bitmind Nginx Canonical Deployment Script
# Deploys single-source-of-truth nginx configuration for getbitmind.com
# Usage: sudo bash deployment/deploy-nginx.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

REPO_DIR="/opt/Bitmind"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"
CANONICAL_CONFIG="$REPO_DIR/deployment/nginx-canonical.conf"
TARGET_CONFIG="$NGINX_SITES_AVAILABLE/getbitmind.com"

echo "=========================================="
echo "BITMIND NGINX CANONICAL DEPLOY"
echo "=========================================="

# ── STEP 1: Backup existing configs ─────────────
echo "[1/6] Backing up existing nginx configs..."
mkdir -p /tmp/nginx-backup-$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/tmp/nginx-backup-$(date +%Y%m%d-%H%M%S)"

# Backup all existing configs for getbitmind.com
for file in "$NGINX_SITES_AVAILABLE"/*; do
    if grep -q "getbitmind.com" "$file" 2>/dev/null; then
        echo "  Backing up: $(basename $file)"
        cp "$file" "$BACKUP_DIR/"
    fi
done

for file in "$NGINX_SITES_ENABLED"/*; do
    if grep -q "getbitmind.com" "$file" 2>/dev/null; then
        echo "  Backing up enabled: $(basename $file)"
        cp "$file" "$BACKUP_DIR/"
    fi
done

echo -e "${GREEN}✓ Backups saved to $BACKUP_DIR${NC}"

# ── STEP 2: Disable all getbitmind.com configs ──
echo "[2/6] Disabling all getbitmind.com configs..."
for file in "$NGINX_SITES_ENABLED"/*; do
    if [ -f "$file" ] && grep -q "getbitmind.com" "$file" 2>/dev/null; then
        echo "  Disabling: $(basename $file)"
        rm -f "$file"
    fi
done
echo -e "${GREEN}✓ All getbitmind.com configs disabled${NC}"

# ── STEP 3: Remove duplicate configs from sites-available
echo "[3/6] Removing duplicate configs from sites-available..."
for file in "$NGINX_SITES_AVAILABLE"/*; do
    if [ -f "$file" ] && grep -q "getbitmind.com" "$file" 2>/dev/null; then
        if [ "$(basename $file)" != "getbitmind.com" ]; then
            echo "  Removing duplicate: $(basename $file)"
            rm -f "$file"
        fi
    fi
done
echo -e "${GREEN}✓ Duplicate configs removed${NC}"

# ── STEP 4: Deploy canonical config ───────────────
echo "[4/6] Deploying canonical nginx config..."
if [ ! -f "$CANONICAL_CONFIG" ]; then
    echo -e "${RED}✗ ERROR: Canonical config not found at $CANONICAL_CONFIG${NC}"
    exit 1
fi

cp "$CANONICAL_CONFIG" "$TARGET_CONFIG"
echo -e "${GREEN}✓ Canonical config deployed to $TARGET_CONFIG${NC}"

# ── STEP 5: HARD CLEAN - remove ALL from sites-enabled ──
echo "[5/7] HARD CLEAN: removing all configs from sites-enabled..."
echo "  Current getbitmind.com references:"
grep -R "getbitmind.com" /etc/nginx/sites-enabled /etc/nginx/sites-available 2>/dev/null || echo "  (none found)"
rm -f /etc/nginx/sites-enabled/*
echo -e "${GREEN}✓ All configs removed from sites-enabled${NC}"

# ── STEP 6: Enable ONLY canonical config ──────────
echo "[6/7] Enabling ONLY canonical config..."
ln -sf "$TARGET_CONFIG" "$NGINX_SITES_ENABLED/getbitmind.com"
echo -e "${GREEN}✓ Canonical config enabled (only config in sites-enabled)${NC}"

# ── STEP 7: Test and reload nginx ────────────────
echo "[7/7] Testing nginx configuration..."
if nginx -t; then
    echo -e "${GREEN}✓ nginx configuration test passed${NC}"
    echo "Reloading nginx..."
    systemctl reload nginx
    echo -e "${GREEN}✓ nginx reloaded${NC}"
else
    echo -e "${RED}✗ nginx configuration test FAILED${NC}"
    echo "Restoring from backup..."
    cp -r "$BACKUP_DIR"/* "$NGINX_SITES_AVAILABLE/" 2>/dev/null || true
    systemctl reload nginx 2>/dev/null || true
    exit 1
fi

echo ""
echo -e "${GREEN}==========================================${NC}"
echo -e "${GREEN}NGINX DEPLOYMENT COMPLETE${NC}"
echo -e "${GREEN}==========================================${NC}"
echo ""
echo "Backup location: $BACKUP_DIR"
echo "Active config: $TARGET_CONFIG"
echo ""
echo "Run validation:"
echo "  nginx -t"
echo "  systemctl status nginx"
echo "  curl -I http://getbitmind.com"
echo "  curl -I https://getbitmind.com"
