# Bitmind API Route Mismatch Fix
**Critical Production Issue - API/WS URL Configuration**
Generated: 2026-05-25

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROOT CAUSE IDENTIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Frontend was using environment variables for API/WS URLs:**
- `${import.meta.env.VITE_API_URL}/devices`
- `import.meta.env.VITE_WS_URL || 'wss://getbitmind.com/ws'`

**Problem:**
- No .env file exists in frontend
- Environment variables undefined
- Frontend calling incorrect URLs
- Result: 404 errors, WebSocket connection failures

**Backend routes are correct:**
- `GET /api/devices` ✅ exists in routes.js
- `POST /api/miners/connect` ✅ exists in routes.js
- `/api` prefix mounted in server.js ✅

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILES MODIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. bitmind-ui/src/hooks/useWebSocket.js**

**Before:**
```javascript
const response = await fetch(`${import.meta.env.VITE_API_URL}/devices`);
```

**After:**
```javascript
const response = await fetch('/api/devices');
```

**Why:** Uses relative path for nginx proxy compatibility.

---

**2. bitmind-ui/src/services/ws.js**

**Before (constructor):**
```javascript
this.url = import.meta.env.VITE_WS_URL || 'wss://getbitmind.com/ws';
```

**After (constructor):**
```javascript
this.url = window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/ws' : 'ws://' + window.location.host + '/ws';
```

**Before (connectWebSocket):**
```javascript
socket = new WebSocket(import.meta.env.VITE_WS_URL || "wss://getbitmind.com/ws");
```

**After (connectWebSocket):**
```javascript
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${wsProtocol}//${window.location.host}/ws`;
socket = new WebSocket(wsUrl);
```

**Why:** Dynamically constructs WebSocket URL based on current domain/protocol for nginx proxy compatibility.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API CONTRACT VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Backend Routes (server/api/routes.js):**
- ✅ `GET /api/devices` - Returns device list
- ✅ `GET /api/stats` - Returns system stats
- ✅ `POST /api/miners/connect` - Connects new miner
- ✅ Mounted at `/api` in server.js

**Frontend Calls (after fix):**
- ✅ `GET /api/devices` - Fetches device list
- ✅ `POST /api/miners/connect` - Connects miner
- ✅ WebSocket connects to `/ws` relative path

**Nginx Proxy (required):**
```nginx
location /api {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
}

location /ws {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOYMENT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. Commit and push changes:**
```bash
git add -A
git commit -m "Fix API/WS URLs to use relative paths for nginx proxy"
git push
```

**2. On VPS (after repo recovery):**
```bash
cd /opt/Bitmind
git pull
cd bitmind-ui
npm run build
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
sudo systemctl restart nginx
```

**3. Verify nginx proxy configuration:**
```bash
sudo nginx -T | grep -A 5 "location /api"
sudo nginx -T | grep -A 5 "location /ws"
```

**4. Test in browser:**
- Open https://getbitmind.com
- Open DevTools Network tab
- Check API calls return 200
- Check WebSocket connects successfully

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ No /api/devices 404 errors
✅ API routes consistent across system
✅ Backend responds 200 to all API calls
✅ WebSocket connects successfully
✅ Miner registration works
✅ UI updates live via WebSocket
✅ No environment variable dependencies

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
