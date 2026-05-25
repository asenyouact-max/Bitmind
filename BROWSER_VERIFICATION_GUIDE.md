# Bitmind Browser Verification Guide
**Step-by-Step Browser-Based Verification**
Generated: 2026-05-25

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PREREQUISITES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- Browser: Chrome, Firefox, Safari, or Edge
- URL: https://getbitmind.com
- DevTools enabled (F12)
- Incognito/Private mode recommended (to avoid cache)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1: OPEN DEVTOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Windows/Linux:**
- Press F12
- OR Ctrl+Shift+I
- OR Right-click → Inspect

**Mac:**
- Press Cmd+Option+I
- OR Right-click → Inspect

**Recommended:**
- Use Incognito/Private mode to avoid cache
- Open DevTools before navigating to site

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2: CHECK NETWORK TAB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Click "Network" tab in DevTools
2. Check "Disable cache" checkbox
3. Refresh page (F5 or Ctrl+R)
4. Look for files loading

**What to check:**

**JS Bundle:**
- Look for: `assets/index-*.js`
- Status: Should be **200 OK**
- Type: Should be **application/javascript**
- Size: Should be > 1KB (not 0 bytes)

**If JS bundle shows:**
- **404** → nginx not serving assets correctly
- **HTML** instead of JS → nginx try_files misconfiguration
- **0 bytes** → build failed or corrupted
- **Redirect** → nginx routing issue

**Screenshot example:**
```
Name              Status    Type          Size
index.html        200       document      2.5 KB
index-abc123.js   200       script        150 KB
assets/           200       -             -
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3: CHECK CONSOLE TAB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Click "Console" tab in DevTools
2. Look for any red errors
3. Look for any logs

**Expected:**
- No red errors
- No "Failed to load module"
- No "MIME type text/html"
- No "Uncaught error"
- No "React hydration failed"

**If errors exist:**
- Screenshot the error
- Note the error message
- Note the file causing the error

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4: VERIFY DEBUG FLAG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In Console, type:

```javascript
window.__BITMIND_DEBUG
```

**Expected result:**
```
true
```

**If result is:**
- `undefined` → Old bundle being served
- `error` → JS crashed before initialization
- `false` → Debug flag not set

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5: CHECK FOR EXECUTION LOGS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

In Console, look for:

**On page load:**
- `BITMIND FRONTEND LIVE` (if added)
- Any React-related logs

**On button click:**
- `🔥 CONNECT MINER BUTTON CLICKED`
- `LANDING: handleMinerConnect called`

**On modal submit:**
- `🚀 MODAL SUBMIT FIRED`
- `FORM DATA: {...}`

**If NO logs appear:**
- JavaScript is not executing
- Or code crashed before reaching logs
- Or old bundle without debug code

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6: TEST BUTTON CLICK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Click "Connect Bitminer" button
2. Watch for alert
3. Watch Console for logs

**Expected:**
- Alert: "CLICK WORKS"
- Console: "🔥 CONNECT MINER BUTTON CLICKED"
- Modal opens

**If NOTHING happens:**
- Event system not running
- Button not wired correctly
- React not mounted
- JavaScript crashed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7: TEST MODAL SUBMIT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Fill form fields:
   - Bitcoin Wallet Address: `bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh`
   - Worker Name: `test-miner-01`
   - Device Type: `ESP32 Bitminer`
2. Click "Connect Miner" button in modal
3. Watch for alert
4. Watch Console for logs

**Expected:**
- Alert: "SUBMIT WORKS"
- Console: "🚀 MODAL SUBMIT FIRED"
- Console: "FORM DATA: {walletAddress: "...", workerName: "...", deviceType: "...", miningMode: "..."}"

**If NOTHING happens:**
- Form submit not wired
- Button type incorrect
- Form validation blocking
- JavaScript crashed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 8: CHECK NETWORK TAB FOR API CALL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After modal submit, check Network tab:

**Look for:**
- POST /api/miners/connect
- Status: 200 OK
- Response: JSON with miner data

**If API call not appearing:**
- JavaScript crashed before fetch
- Fetch not called
- URL incorrect
- Network error

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING COMMON ISSUES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Issue: JS Bundle Returns 404

**Symptoms:**
- Network tab shows 404 for assets/index-*.js
- Console shows "Failed to load module"

**Cause:**
- nginx not serving assets correctly
- Assets folder missing
- Wrong nginx root path

**Fix:**
Run on VPS:
```bash
ls -la /usr/share/nginx/html/assets/
```

If missing, redeploy:
```bash
cd /opt/bitmind-backend/bitmind-ui
npm run build
sudo cp -r dist/* /usr/share/nginx/html/
```

### Issue: JS Bundle Returns HTML Instead of JS

**Symptoms:**
- Network tab shows 200 but content-type is text/html
- Console shows "MIME type text/html"

**Cause:**
- nginx try_files redirecting to index.html
- Assets folder missing
- Path routing issue

**Fix:**
Add to nginx config:
```nginx
location /assets/ {
    try_files $uri =404;
}
```

### Issue: window.__BITMIND_DEBUG is undefined

**Symptoms:**
- Console returns undefined
- No debug logs appear

**Cause:**
- Old bundle being served
- Build not deployed
- Browser cache

**Fix:**
1. Hard refresh (Ctrl+Shift+R)
2. Try incognito mode
3. Redeploy on VPS:
```bash
cd /opt/bitmind-backend/bitmind-ui
rm -rf dist
npm run build
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
```

### Issue: Button Click Does Nothing

**Symptoms:**
- No alert
- No console log
- No modal

**Cause:**
- JavaScript not executing
- React not mounted
- Event system not running
- Old bundle

**Fix:**
1. Check Console for errors
2. Check window.__BITMIND_DEBUG
3. Check JS bundle loading
4. Redeploy if needed

### Issue: Browser Cache Issues

**Symptoms:**
- Old behavior persists after redeploy
- Files show old timestamps
- Changes not visible

**Fix:**
1. Hard refresh (Ctrl+Shift+R)
2. Clear browser cache
3. Use incognito mode
4. Disable cache in DevTools Network tab

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REPORTING RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After completing verification, report:

**1. JS Bundle Status:**
- Status code: 200 / 404 / HTML / Other
- Content-Type: application/javascript / text/html / Other
- Size: ___ KB

**2. Console Errors:**
- Any red errors? (yes/no)
- Error messages: ___

**3. Debug Flag:**
- window.__BITMIND_DEBUG: true / undefined / error

**4. Console Logs:**
- Any logs appear? (yes/no)
- Which logs? ___

**5. Button Click:**
- Alert appears? (yes/no)
- Console log appears? (yes/no)
- Modal opens? (yes/no)

**6. Modal Submit:**
- Alert appears? (yes/no)
- Console log appears? (yes/no)
- Form data logged? (yes/no)

**7. API Call:**
- POST /api/miners/connect appears? (yes/no)
- Status code: ___
- Response: ___

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
QUICK REFERENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Console Commands:**
```javascript
window.__BITMIND_DEBUG          // Check debug flag
React.version                   // Check React version
document.readyState             // Check page load state
performance.memory              // Check memory usage
```

**Keyboard Shortcuts:**
- F12: Open DevTools
- Ctrl+Shift+I: Open DevTools
- Ctrl+Shift+R: Hard refresh
- Ctrl+Shift+J: Open Console directly
- Ctrl+Shift+C: Open Inspector

**Network Tab Filters:**
- JS: Filter for JavaScript files
- Doc: Filter for documents
- XHR/Fetch: Filter for API calls
- Img: Filter for images

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
