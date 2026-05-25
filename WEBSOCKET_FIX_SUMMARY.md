# Bitmind WebSocket Production Fix
**Critical WebSocket Connectivity Layer Fix**
Generated: 2026-05-25

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROOT CAUSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Problem:** Frontend trying to connect to `wss://getbitmind.com/ws` but backend WebSocket is not properly proxied by nginx.

**Result:**
- Connect Miner button appears to do nothing
- WebSocket fails → frontend flow breaks
- Miner onboarding does not complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. Backend WebSocket Server ✅ VERIFIED CORRECT**

**File:** `server/server.js` (lines 29-43)

```javascript
// WebSocket server for /ws endpoint
const wsServer = new WebSocket.Server({
  noServer: true,
  path: '/ws'
});

// Handle WebSocket upgrade requests
server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      wsServer.emit('connection', ws, request);
    });
  }
});
```

**Status:** ✅ Backend WebSocket server exists at `/ws` on port 3001

---

**2. Frontend WebSocket URL ✅ ALREADY FIXED**

**File:** `bitmind-ui/src/services/ws.js` (line 14)

```javascript
this.url = window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/ws' : 'ws://' + window.location.host + '/ws';
```

**Status:** ✅ Frontend uses dynamic WebSocket URL (no hardcoding)

---

**3. Nginx WebSocket Proxy ❌ MISSING**

**Issue:** Nginx configuration likely missing WebSocket proxy for `/ws` location.

**Required:** Add WebSocket proxy configuration to nginx.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SOLUTION - NGINX WEBSOCKET PROXY CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**File Created:** `nginx-websocket.conf`

**Required nginx configuration:**

```nginx
# WebSocket proxy to backend (CRITICAL)
location /ws {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket timeout settings
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

**Key Headers:**
- `Upgrade: $http_upgrade` - Required for WebSocket upgrade
- `Connection: "Upgrade"` - Required for WebSocket upgrade
- `proxy_http_version 1.1` - Required for WebSocket

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOYMENT STEPS ON VPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Step 1: Backup current nginx config**
```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup
```

**Step 2: Add WebSocket proxy to nginx config**
```bash
# Edit your nginx config file
sudo nano /etc/nginx/sites-available/default
# OR
sudo nano /etc/nginx/conf.d/bitmind.conf
```

**Step 3: Add the WebSocket location block**
```nginx
location /ws {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

**Step 4: Test nginx configuration**
```bash
sudo nginx -t
```

**Step 5: Reload nginx**
```bash
sudo systemctl reload nginx
```

**Step 6: Verify WebSocket connectivity**
```bash
# Test WebSocket upgrade (should not return 404)
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://getbitmind.com/ws
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTERNATIVE - USE PROVIDED CONFIG FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Step 1: Copy provided config**
```bash
sudo cp nginx-websocket.conf /etc/nginx/sites-available/bitmind
```

**Step 2: Enable site**
```bash
sudo ln -s /etc/nginx/sites-available/bitmind /etc/nginx/sites-enabled/
```

**Step 3: Remove default site (if needed)**
```bash
sudo rm /etc/nginx/sites-enabled/default
```

**Step 4: Test and reload**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION AFTER DEPLOYMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**On VPS:**
```bash
# Test nginx config
sudo nginx -t

# Test WebSocket endpoint
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://getbitmind.com/ws
# Should return: 101 Switching Protocols (not 404)
```

**In Browser:**
1. Open https://getbitmind.com
2. Open DevTools (F12)
3. Go to Network tab
4. Filter by WS (WebSocket)
5. Refresh page
6. **Expected:** WebSocket connection to `/ws` succeeds (green)
7. Check Console - no "connection failed" errors

**Test Connect Miner Flow:**
1. Click "Connect Miner" button
2. Modal should open
3. Fill form and submit
4. **Expected:** WebSocket connects, API call succeeds, miner registered

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ WebSocket connects with no errors
✅ No "connection failed" in console
✅ Connect Miner button triggers full flow
✅ miner_connected event works
✅ Dashboard updates live
✅ Nginx proxies WebSocket correctly
✅ Backend WebSocket server reachable at `/ws`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TROUBLESHOOTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Issue: WebSocket still fails after nginx config**

**Check 1: Nginx config syntax**
```bash
sudo nginx -t
```

**Check 2: Nginx reloaded**
```bash
sudo systemctl reload nginx
sudo systemctl status nginx
```

**Check 3: Backend WebSocket server running**
```bash
pm2 status
# Ensure bitmind process is running
```

**Check 4: Backend port accessible**
```bash
curl http://localhost:3001/api/miners
# Should return 200
```

**Check 5: WebSocket upgrade headers**
```bash
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" http://localhost:3001/ws
# Should return 101 Switching Protocols
```

**Issue: 502 Bad Gateway**

**Cause:** Backend not running or wrong port

**Fix:**
```bash
pm2 restart bitmind
# Check backend is on port 3001
```

**Issue: 404 Not Found for /ws**

**Cause:** Nginx location block missing or incorrect

**Fix:**
```bash
# Verify location block exists in nginx config
sudo nginx -T | grep -A 10 "location /ws"
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT NOTES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Backend WebSocket server is correctly configured
✅ Frontend WebSocket URL is dynamic (no hardcoding)
✅ Only nginx WebSocket proxy needs to be added
✅ No changes to mining logic needed
✅ No changes to RPC logic needed
✅ No changes to frontend UI layout needed

**ONLY fix WebSocket connectivity layer.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
