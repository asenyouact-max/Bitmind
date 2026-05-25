# Bitmind Stale Frontend Bundle Fix
**Critical Production Issue - Stale JavaScript Bundle**
Generated: 2026-05-25

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROOT CAUSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Problem:** Production still serves frontend bundle referencing deprecated endpoint `/api/devices` even after API unification to `/api/miners`.

**Root Cause:**
- Old Vite build artifacts still deployed
- Browser cache + nginx serving stale JS bundle
- `/dist` not fully cleaned before build
- File timestamps not updated (cache not invalidated)

**This is NOT backend. This is NOT routing.**
**This is: stale production JavaScript bundle still deployed.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOLUTION - CLEAN REBUILD + DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### STEP 1: Pull Latest Code on VPS

```bash
cd /opt/Bitmind
git pull
```

### STEP 2: Clean Rebuild Frontend

```bash
cd bitmind-ui
rm -rf dist node_modules/.vite
npm install
npm run build
```

### STEP 3: Verify Build Content

```bash
# Check for deprecated API references
grep -R "/api/devices" dist/
# MUST RETURN: NO RESULTS

# Check for new API references
grep -R "/api/miners" dist/
# MUST RETURN: Results found
```

### STEP 4: Force Clean Nginx Deployment

```bash
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
sudo chown -R www-data:www-data /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html
```

### STEP 5: Cache Invalidation

```bash
# Touch all files to update timestamps
sudo find /usr/share/nginx/html -type f -exec touch {} \;
```

### STEP 6: Restart Nginx

```bash
sudo systemctl restart nginx
```

### STEP 7: Verify Production Bundle

**In browser:**
1. Open https://getbitmind.com/assets/index-*.js
2. Search inside for `/api/devices`
3. **MUST NOT contain `/api/devices`**
4. **MUST contain `/api/miners`**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTOMATED SCRIPTS CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. clean-rebuild-frontend.sh**
- Removes dist folder
- Removes Vite cache
- Reinstalls dependencies
- Builds frontend
- Verifies build content
- Checks for deprecated API references

**Usage:**
```bash
chmod +x clean-rebuild-frontend.sh
./clean-rebuild-frontend.sh
```

**2. deploy-clean-build.sh**
- Verifies build exists
- Backs up current deployment
- Removes old deployment
- Copies new build
- Sets permissions
- Invalidates cache (touches files)
- Verifies deployment content
- Checks for deprecated API references
- Restarts nginx

**Usage:**
```bash
chmod +x deploy-clean-build.sh
sudo ./deploy-clean-build.sh
```

**3. verify-build.sh**
- Verifies build folder exists
- Checks for `/api/devices` in build
- Checks for `/api/miners` in build
- Checks deployment (if exists)
- Shows file timestamps

**Usage:**
```bash
chmod +x verify-build.sh
./verify-build.sh
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONE-LINE DEPLOYMENT COMMAND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

```bash
cd /opt/Bitmind && git pull && cd bitmind-ui && rm -rf dist node_modules/.vite && npm install && npm run build && sudo rm -rf /usr/share/nginx/html/* && sudo cp -r dist/* /usr/share/nginx/html/ && sudo chown -R www-data:www-data /usr/share/nginx/html && sudo chmod -R 755 /usr/share/nginx/html && sudo find /usr/share/nginx/html -type f -exec touch {} \; && sudo systemctl restart nginx
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION AFTER DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### On VPS:

```bash
# Verify build
./verify-build.sh

# Check nginx root
ls -la /usr/share/nginx/html

# Check for deprecated references
sudo grep -r "/api/devices" /usr/share/nginx/html
# Should return nothing
```

### In Browser:

1. Open https://getbitmind.com
2. Open DevTools (F12)
3. Hard refresh (Ctrl+Shift+R)
4. Check Network tab
5. Verify `/api/miners` calls (not `/api/devices`)
6. Check Console for errors
7. Test Connect Miner button

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ No `/api/devices` in dist folder
✅ No `/api/devices` in nginx deployment
✅ No `/api/devices` in browser network tab
✅ `/api/miners` references present in build
✅ Button triggers API call to `/api/miners`
✅ `/api/miners` returns 200
✅ Miner onboarding flow works end-to-end
✅ No stale cache issues

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Issue: /api/devices still found after rebuild

**Cause:** Source code still has old references

**Fix:**
```bash
# Check source code
grep -r "/api/devices" src/

# Update source code first
git pull
# Then rebuild
./clean-rebuild-frontend.sh
```

### Issue: Browser still shows old bundle

**Cause:** Browser cache

**Fix:**
- Hard refresh (Ctrl+Shift+R)
- Use incognito/private mode
- Clear browser cache
- Disable cache in DevTools Network tab

### Issue: Nginx serving old files

**Cause:** File timestamps not updated

**Fix:**
```bash
# Touch all files
sudo find /usr/share/nginx/html -type f -exec touch {} \;

# Restart nginx
sudo systemctl restart nginx
```

### Issue: Build fails

**Cause:** Dependencies or configuration issue

**Fix:**
```bash
cd bitmind-ui
rm -rf node_modules package-lock.json
npm install
npm run build
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
