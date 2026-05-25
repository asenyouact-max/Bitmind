# Bitmind VPS Deployment Recovery Instructions
**CRITICAL FIX - Empty Nginx Root Recovery**
Generated: 2026-05-25

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROOT CAUSE IDENTIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**This was NOT a frontend bug.**

**The VPS does not contain:**
- Bitmind repository ❌
- Frontend build (dist) ❌
- /bitmind-ui directory ❌
- Git repository ❌

**Result:** /usr/share/nginx/html is empty, frontend JS does not exist in production.

**You were debugging a system that was never actually deployed.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMMEDIATE FIX - EXECUTE ON VPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### OPTION 1: Use Recovery Script (Recommended)

```bash
# Copy script to VPS and run
chmod +x vps-deploy-recovery.sh
sudo ./vps-deploy-recovery.sh
```

### OPTION 2: Manual Commands

```bash
# 1. Clone repository
cd /opt
sudo git clone https://github.com/asenyouact-max/Bitmind.git
cd Bitmind

# 2. Install frontend dependencies
cd bitmind-ui
sudo npm install

# 3. Build frontend
sudo npm run build

# 4. Deploy to nginx root
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
sudo chown -R www-data:www-data /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html

# 5. Restart nginx
sudo systemctl restart nginx

# 6. Verify deployment
ls -la /usr/share/nginx/html
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION AFTER DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### On VPS:

```bash
# Check nginx root contains files
ls -la /usr/share/nginx/html

# Should show:
# index.html
# assets/
# (other static files)
```

### In Browser:

1. Open https://getbitmind.com
2. Open DevTools (F12)
3. Hard refresh (Ctrl+Shift+R)
4. Check Console for: `🔥 BITMIND FRONTEND EXECUTING`
5. Run: `window.__BITMIND_RUNTIME` (should return `true`)
6. Click "Connect Miner" button (should show alert "CLICK WORKS")

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Repository exists on VPS (/opt/Bitmind)
✅ Frontend built successfully (dist folder exists)
✅ Nginx serves dist/ (index.html in nginx root)
✅ JS executes in browser (console logs appear)
✅ Connect Miner button works (alert appears)
✅ Modal opens correctly

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Issue: npm install fails

**Fix:**
```bash
sudo apt update
sudo apt install nodejs npm
cd /opt/Bitmind/bitmind-ui
sudo npm install
```

### Issue: npm run build fails

**Fix:**
```bash
cd /opt/Bitmind/bitmind-ui
sudo rm -rf node_modules package-lock.json
sudo npm install
sudo npm run build
```

### Issue: nginx restart fails

**Fix:**
```bash
sudo nginx -t
# If error, fix config
sudo systemctl restart nginx
```

### Issue: Still empty after deployment

**Fix:**
```bash
# Check if files were copied
ls -la /usr/share/nginx/html

# If empty, check dist folder
ls -la /opt/Bitmind/bitmind-ui/dist

# Recopy manually
sudo cp -r /opt/Bitmind/bitmind-ui/dist/* /usr/share/nginx/html/
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FUTURE DEPLOYMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After this recovery, future deployments should use:

```bash
cd /opt/Bitmind
git pull
cd bitmind-ui
npm run build
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
sudo systemctl restart nginx
```

**DO NOT clone repository again** - it already exists.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
