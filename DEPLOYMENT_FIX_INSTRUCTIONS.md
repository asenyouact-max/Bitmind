# Bitmind Frontend Deployment Fix Instructions
**Production Deployment Fix - JavaScript Not Executing on getbitmind.com**
Generated: 2026-05-25

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ISSUE SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Problem:**
Connect Miner button on https://getbitmind.com does nothing at all (no logs, no alerts, no modal reaction).

**Root Cause:**
JavaScript is NOT executing OR wrong bundle is being served by nginx.

**Most Likely Issues (ranked):**
1. Old dist folder still served by nginx
2. Wrong nginx root path
3. JS bundle not loading (404 or HTML fallback)
4. Vite build not deployed at all
5. Browser caching stale index.html

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-DEPLOYMENT CHECKS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 1: Verify Nginx Configuration

On VPS, run:
```bash
sudo nginx -T | grep root
```

**Expected output:**
```
root /usr/share/nginx/html;
```

**OR:**
```
root /var/www/html;
```

**Note the path** - this is where you need to deploy the build.

### STEP 2: Check Current Deployed Files

Replace with your nginx root path:
```bash
ls -la /usr/share/nginx/html
```

**Check:**
- index.html timestamp (is it old?)
- assets/ folder exists?
- JS bundle exists (main.*.js or index.*.js)?

**If files are OLD → This is the bug**

### STEP 3: Check JS Bundle Loading

In browser (https://getbitmind.com):
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh page
4. Look for JS files in /assets/

**If JS files show 404 or return HTML instead of JS → This is the bug**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOYMENT FIX STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 1: Commit Latest Changes

On your local machine:
```bash
cd c:\Users\ashen\Documents\Bitmind
git add .
git commit -m "Fix Vite config for production deployment"
git push
```

### STEP 2: Pull Latest Code on VPS

On VPS:
```bash
cd /opt/bitmind-backend
git pull
```

### STEP 3: Clean Rebuild Frontend

On VPS (or CI machine):
```bash
cd /opt/bitmind-backend/bitmind-ui
rm -rf dist
rm -rf node_modules
npm install
npm run build
```

**Verify build succeeded:**
```bash
ls -la dist/
```

**Should show:**
- index.html
- assets/ folder
- JS files in assets/

### STEP 4: Deploy New Build to Nginx

**IMPORTANT: Replace /usr/share/nginx/html with your actual nginx root path**

```bash
# Backup current deployment
sudo cp -r /usr/share/nginx/html /usr/share/nginx/html.backup

# Remove old files
sudo rm -rf /usr/share/nginx/html/*

# Copy new build
sudo cp -r /opt/bitmind-backend/bitmind-ui/dist/* /usr/share/nginx/html/

# Set correct permissions
sudo chown -R www-data:www-data /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html
```

### STEP 5: Verify Nginx Configuration

Check nginx config for static file serving:
```bash
sudo nginx -T | grep -A 10 "location /"
```

**Should include:**
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

**For API proxy:**
```nginx
location /api {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

**For WebSocket proxy:**
```nginx
location /ws {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

### STEP 6: Reload Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### STEP 7: Clear Browser Cache

In browser:
1. Open DevTools (F12)
2. Right-click refresh button
3. Select "Empty Cache and Hard Reload"

**OR use incognito/private mode**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 1: Verify Files Are Served

```bash
curl -I https://getbitmind.com
```

**Expected:**
```
HTTP/2 200
content-type: text/html
```

```bash
curl -I https://getbitmind.com/assets/index-*.js
```

**Expected:**
```
HTTP/2 200
content-type: application/javascript
```

**If content-type is text/html → JS not loading correctly**

### STEP 2: Verify JavaScript Execution

In browser (https://getbitmind.com):
1. Open DevTools Console
2. Refresh page
3. Check for logs

**Expected:**
- No "Failed to load module" errors
- No "MIME type text/html" errors
- No "Uncaught error" messages

### STEP 3: Test Button Click

1. Click "Connect Bitminer" button
2. **Expected:** Alert "CLICK WORKS"
3. **Expected:** Console log "🔥 CONNECT MINER BUTTON CLICKED"
4. **Expected:** Modal opens

### STEP 4: Test Modal Submit

1. Fill form (wallet, worker name, device type)
2. Click "Connect Miner" in modal
3. **Expected:** Alert "SUBMIT WORKS"
4. **Expected:** Console log "🚀 MODAL SUBMIT FIRED"
5. **Expected:** Console log "FORM DATA: {...}"

### STEP 5: Test API Call

1. Check Network tab
2. **Expected:** POST /api/miners/connect request
3. **Expected:** 200 status
4. **Expected:** Response with miner data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### ISSUE: JS Files Return 404

**Cause:** Nginx not serving assets correctly

**Fix:**
```bash
# Check if assets folder exists
ls -la /usr/share/nginx/html/assets/

# If not, rebuild and redeploy
cd /opt/bitmind-backend/bitmind-ui
npm run build
sudo cp -r dist/* /usr/share/nginx/html/
```

### ISSUE: JS Files Return HTML Instead of JS

**Cause:** Nginx try_files redirecting to index.html

**Fix:**
Add to nginx config:
```nginx
location /assets/ {
    try_files $uri =404;
}
```

### ISSUE: Browser Caching Old Files

**Fix:**
```bash
# Add cache busting to nginx config
location ~* \.(js|css)$ {
    expires 1h;
    add_header Cache-Control "public, immutable";
}
```

**OR use incognito/private mode for testing**

### ISSUE: Build Fails

**Fix:**
```bash
cd /opt/bitmind-backend/bitmind-ui
rm -rf node_modules package-lock.json
npm install
npm run build
```

### ISSUE: Nginx Config Wrong

**Fix:**
```bash
# Check nginx config
sudo nginx -t

# If error, fix config and reload
sudo nano /etc/nginx/sites-available/default
sudo nginx -t
sudo systemctl reload nginx
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTOMATED DEPLOYMENT SCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create script: `/opt/bitmind-backend/deploy-frontend.sh`

```bash
#!/bin/bash

# Bitmind Frontend Deployment Script
echo "Starting frontend deployment..."

# Navigate to project
cd /opt/bitmind-backend

# Pull latest code
echo "Pulling latest code..."
git pull

# Navigate to frontend
cd bitmind-ui

# Clean build
echo "Cleaning build..."
rm -rf dist

# Install dependencies
echo "Installing dependencies..."
npm install

# Build
echo "Building frontend..."
npm run build

# Check build
if [ ! -d "dist" ]; then
    echo "ERROR: Build failed - dist folder not created"
    exit 1
fi

# Backup current deployment
echo "Backing up current deployment..."
sudo cp -r /usr/share/nginx/html /usr/share/nginx/html.backup

# Deploy new build
echo "Deploying new build..."
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/

# Set permissions
echo "Setting permissions..."
sudo chown -R www-data:www-data /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html

# Reload nginx
echo "Reloading nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "Deployment complete!"
echo "Please clear browser cache and test."
```

**Make executable:**
```bash
chmod +x /opt/bitmind-backend/deploy-frontend.sh
```

**Run:**
```bash
sudo /opt/bitmind-backend/deploy-frontend.sh
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VITE CONFIG CHANGES MADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**File:** bitmind-ui/vite.config.js

**Changes:**
- Added `base: '/'` to ensure assets served from root
- Added explicit build configuration
- Set `outDir: 'dist'`
- Set `assetsDir: 'assets'`
- Disabled sourcemaps for production
- Set minify to 'terser'
- Configured server port and host

**Why This Fixes It:**
- Ensures JS bundles load from correct path
- Prevents 404 errors on assets
- Ensures nginx serves files correctly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Button responds instantly
✅ Console logs appear
✅ Modal opens
✅ JS bundle loads correctly
✅ No 404 in /assets/*.js
✅ getbitmind.com fully interactive
✅ API calls work
✅ WebSocket connects

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
