#!/bin/bash
set -e

echo "[DEPLOY] Bitmind clean deploy starting"

cd /opt/Bitmind

echo "[DEPLOY] Sync code"
git reset --hard origin/main
git pull origin main

echo "[DEPLOY] Backend install"
npm install --prefix server

echo "[DEPLOY] Frontend install"
npm install --prefix bitmind-ui
npm install terser --prefix bitmind-ui

echo "[DEPLOY] Frontend build"
npm run build --prefix bitmind-ui || echo "[DEPLOY] Frontend build failed (non-blocking)"

echo "[DEPLOY] Restart PM2 with environment reload"
pm2 restart bitmind --update-env

echo "[DEPLOY] DONE"
