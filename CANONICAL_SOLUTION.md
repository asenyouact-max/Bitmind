# Bitmind Canonical Production Solution
**Deterministic API + Deployment Architecture**
Generated: 2026-05-27

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANONICAL ARCHITECTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Frontend → Nginx → Backend → WebSocket**

```
Browser (https://getbitmind.com)
    ↓
Nginx (443)
    ├─ / → /usr/share/nginx/html (static files)
    ├─ /api → http://127.0.0.1:3001 (API proxy)
    └─ /ws → http://127.0.0.1:3001 (WebSocket proxy)
    ↓
Backend (3001)
    ├─ Express API routes
    └─ WebSocket upgrade handler
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CANONICAL API CONTRACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Only allowed endpoints:**

| Operation | Method | Endpoint | Purpose |
|-----------|--------|----------|---------|
| List miners | GET | `/api/miners` | Get all registered miners |
| Connect miner | POST | `/api/miners/connect` | Register new miner |
| Get stats | GET | `/api/stats` | Get system statistics |
| WebSocket | WS | `/ws` | Real-time miner updates |

**Removed endpoints:**
- ❌ `GET /api/devices` (completely removed)

**WebSocket message types:**
- `miners` - Initial miner list
- `miner_update` - Real-time miner updates
- `miner_connected` - New miner registration event

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE CHANGES - FINAL CLEAN DIFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### 1. bitmind-ui/src/hooks/useWebSocket.js

**Change:** Updated WebSocket message type handling from `devices` to `miners`

**Before:**
```javascript
// STRICT MESSAGE TYPE HANDLING - Only allow device-related messages
if (message.type === 'devices' || message.type === 'device_update') {
  console.log('Device message received:', message.type);
  // ...
}
```

**After:**
```javascript
// STRICT MESSAGE TYPE HANDLING - Only allow miner-related messages
if (message.type === 'miners' || message.type === 'miner_update' || message.type === 'miner_connected') {
  console.log('Miner message received:', message.type);
  // ...
}
```

**API call:** Already uses `/api/miners` (line 171)

---

### 2. bitmind-ui/src/services/ws.js

**Change:** Dynamic WebSocket URL construction (already implemented)

**Current state (CORRECT):**
```javascript
this.url = window.location.protocol === 'https:' ? 'wss://' + window.location.host + '/ws' : 'ws://' + window.location.host + '/ws';
```

**No changes needed.**

---

### 3. bitmind-ui/src/pages/Landing.jsx

**Change:** STEP debug logs added (already implemented)

**Current state (CORRECT):**
- `STEP 1 BUTTON CLICK` - Button onClick
- `STEP 2 MODAL OPEN` - Modal state update
- `STEP 4 API REQUEST` - Fetch POST
- `STEP 5 API SUCCESS` - API response

**API call:** Uses `/api/miners/connect` (line 49)

**No changes needed.**

---

### 4. bitmind-ui/src/components/ConnectMinerModal.jsx

**Change:** STEP debug logs added (already implemented)

**Current state (CORRECT):**
- `STEP 3 SUBMIT` - Form submit handler
- Modal mounting logs

**No changes needed.**

---

### 5. bitmind-ui/vite.config.js

**Change:** Added build validation to fail if `/api/devices` detected

**Before:**
```javascript
export default defineConfig({
  plugins: [react()],
  base: '/',
  // ...
});
```

**After:**
```javascript
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'check-legacy-api',
      generateBundle(options, bundle) {
        let hasLegacyApi = false;
        for (const fileName in bundle) {
          const file = bundle[fileName];
          if (file.type === 'chunk' && file.code) {
            if (file.code.includes('/api/devices')) {
              hasLegacyApi = true;
              console.error(`❌ BUILD FAILED: Legacy /api/devices found in ${fileName}`);
            }
          }
        }
        if (hasLegacyApi) {
          throw new Error('Build failed: Legacy /api/devices references detected. Use /api/miners instead.');
        }
      }
    }
  ],
  base: '/',
  // ...
});
```

---

### 6. server/api/routes.js

**Change:** Removed legacy `/api/devices` endpoint (already done)

**Current state (CORRECT):**
- `GET /api/miners` - Returns miner list
- `POST /api/miners/connect` - Registers new miner
- `GET /api/stats` - Returns system stats

**No changes needed.**

---

### 7. server/server.js

**Change:** WebSocket debug logs added (already implemented)

**Current state (CORRECT):**
- `🔍 UPGRADE REQUEST:` - Logs upgrade requests
- `✅ WS UPGRADE ACCEPTED` - Confirms path match
- `✅ WS CLIENT CONNECTED` - Confirms connection
- `✅ WS OPEN:` - Logs when WebSocket opens

**Architecture (CORRECT):**
```javascript
const wsServer = new WebSocket.Server({
  noServer: true,
  path: '/ws'
});

server.on('upgrade', (request, socket, head) => {
  if (request.url === '/ws') {
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      wsServer.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});
```

**No changes needed.**

---

### 8. nginx-websocket.conf

**Change:** Canonical nginx configuration (already provided)

**Current state (CORRECT):**
```nginx
# API proxy to backend
location /api {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

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

**No changes needed.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOYMENT INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Step 1: Pull latest code on VPS

```bash
cd /opt/Bitmind
git pull
```

### Step 2: Build frontend with validation

```bash
cd bitmind-ui
npm install
npm run build
```

**Expected:** Build succeeds (no `/api/devices` errors)

### Step 3: Deploy to nginx

```bash
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
sudo chown -R www-data:www-data /usr/share/nginx/html
sudo chmod -R 755 /usr/share/nginx/html
```

### Step 4: Apply nginx configuration

```bash
sudo cp nginx-websocket.conf /etc/nginx/sites-available/bitmind
sudo ln -s /etc/nginx/sites-available/bitmind /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Step 5: Restart backend

```bash
pm2 restart bitmind
```

### Step 6: Verify deployment

```bash
# Test API
curl http://localhost:3001/api/miners

# Test WebSocket (local)
node -e "const WebSocket = require('ws'); const ws = new WebSocket('ws://127.0.0.1:3001/ws'); ws.on('open', ()=>console.log('WS OK')); ws.on('error', console.error);"

# Check PM2 logs
pm2 logs bitmind --lines 50
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFICATION CHECKLIST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Frontend Verification

- [ ] No `/api/devices` in source code
- [ ] No `/api/devices` in dist folder
- [ ] WebSocket URL uses `window.location.host`
- [ ] API calls use relative paths (`/api/miners`)
- [ ] Message types use `miners` not `devices`

### Backend Verification

- [ ] No `/api/devices` endpoint in routes.js
- [ ] Only `/api/miners`, `/api/miners/connect`, `/api/stats` exist
- [ ] WebSocket uses `noServer: true`
- [ ] WebSocket upgrade handler only accepts `/ws`
- [ ] Debug logs show upgrade requests

### Nginx Verification

- [ ] `/api` proxies to `http://localhost:3001`
- [ ] `/ws` proxies to `http://localhost:3001` with Upgrade headers
- [ ] No additional routing logic
- [ ] Configuration syntax valid (`nginx -t`)

### Build Verification

- [ ] Build fails if `/api/devices` detected
- [ ] Build succeeds with `/api/miners` only
- [ ] No stale build artifacts
- [ ] Clean dist folder

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BROWSER VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

### Step 1: Open production site

```
https://getbitmind.com
```

### Step 2: Open DevTools

- Console tab
- Network tab

### Step 3: Check console logs

**Expected:**
```
🔥 BITMIND FRONTEND EXECUTING
STEP 1 BUTTON CLICK (when button clicked)
STEP 2 MODAL OPEN (when modal opens)
STEP 3 SUBMIT (when form submitted)
STEP 4 API REQUEST: /api/miners/connect
STEP 5 API SUCCESS
```

### Step 4: Check Network tab

**Expected:**
- `/api/miners` requests (not `/api/devices`)
- WebSocket connection to `/ws` (green status)
- No 404 errors
- No connection errors

### Step 5: Test Connect Miner flow

1. Click "Connect Bitminer" button
2. Modal should open
3. Fill form with valid data
4. Submit form
5. **Expected:** API call succeeds, modal closes, dashboard loads

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Zero `/api/devices` anywhere in codebase
✅ Zero `/api/devices` in dist folder
✅ Zero `/api/devices` in production
✅ Only `/api/miners` API endpoint exists
✅ WebSocket uses `/ws` with dynamic URL
✅ Nginx proxies correctly with Upgrade headers
✅ Build fails if legacy endpoints detected
✅ Connect Miner button works end-to-end
✅ WebSocket connects successfully
✅ No manual patching required

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Files Modified:**
1. `bitmind-ui/src/hooks/useWebSocket.js` - Message types updated
2. `bitmind-ui/vite.config.js` - Build validation added

**Files Verified (No Changes Needed):**
3. `bitmind-ui/src/services/ws.js` - Dynamic URL already correct
4. `bitmind-ui/src/pages/Landing.jsx` - API calls already correct
5. `bitmind-ui/src/components/ConnectMinerModal.jsx` - Form already correct
6. `server/api/routes.js` - Legacy endpoint already removed
7. `server/server.js` - WebSocket architecture already correct
8. `nginx-websocket.conf` - Configuration already canonical

**Result:** Fully deterministic system where Frontend → Nginx → Backend → WebSocket all work without manual patching.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF CANONICAL SOLUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
