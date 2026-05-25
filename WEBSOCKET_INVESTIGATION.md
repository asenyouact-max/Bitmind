# Bitmind WebSocket Failure Investigation
**Final WebSocket Transport Layer Debug**
Generated: 2026-05-25

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CURRENT VERIFIED STATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Frontend deployed correctly
✅ No /api/devices anywhere
✅ /api/miners exists
✅ Nginx config loaded
✅ location /ws exists
✅ PM2 backend online
✅ Browser loads latest bundle

❌ Browser still shows: WebSocket connection to 'wss://getbitmind.com/ws' failed

**This is NO LONGER a frontend issue.**
**This is a WebSocket transport layer issue.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SERVER ARCHITECTURE VERIFICATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**File:** `server/server.js`

**Architecture Verified:**

```javascript
// Line 18-20: HTTP server created correctly
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Line 29-33: WebSocket server with noServer: true (CORRECT)
const wsServer = new WebSocket.Server({
  noServer: true,
  path: '/ws'
});

// Line 36-51: Upgrade handler (CORRECT)
server.on('upgrade', (request, socket, head) => {
  console.log("🔍 UPGRADE REQUEST:", request.url);
  console.log("🔍 UPGRADE HEADERS:", request.headers);
  
  if (request.url === '/ws') {
    console.log("✅ WS UPGRADE ACCEPTED for /ws");
    wsServer.handleUpgrade(request, socket, head, (ws) => {
      console.log("✅ WS CLIENT CONNECTED");
      wsServer.emit('connection', ws, request);
    });
  } else {
    console.log("❌ WS UPGRADE REJECTED - wrong path:", request.url);
    socket.destroy();
  }
});

// Line 1386: Server listens on PORT (CORRECT)
server.listen(PORT, () => {
  console.log(`[SYSTEM] ✅ Backend server started on port ${PORT}`);
});
```

**Architecture Status:** ✅ CORRECT
- HTTP server exists
- WebSocket server uses `noServer: true` (required for nginx proxy)
- Upgrade handler exists
- Path is exactly `/ws`
- Server listens on port 3001

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEBUG LOGS ADDED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Upgrade Handler (lines 37-51):**
- `🔍 UPGRADE REQUEST:` - Logs incoming upgrade requests
- `🔍 UPGRADE HEADERS:` - Logs upgrade headers
- `✅ WS UPGRADE ACCEPTED for /ws` - Confirms path match
- `✅ WS CLIENT CONNECTED` - Confirms connection established
- `❌ WS UPGRADE REJECTED` - Logs rejected paths

**Connection Handler (line 136):**
- `✅ WS OPEN:` - Logs when WebSocket opens
- `🟢 WS CONNECTED | clients:` - Logs client count

**Close Handler (line 199):**
- `❌ WS CLOSED | code:` - Logs close event with code and reason

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPS VALIDATION COMMANDS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. Check if backend is listening on port 3001:**
```bash
sudo ss -tulpn | grep 3001
```

**2. Test API endpoint:**
```bash
curl http://127.0.0.1:3001/api/miners
```

**3. Test WebSocket connection locally:**
```bash
node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:3001/ws');
ws.on('open', ()=>console.log('CONNECTED'));
ws.on('error', console.error);
"
```

**4. Check PM2 logs:**
```bash
pm2 logs bitmind --lines 50
```

**5. Check nginx WebSocket proxy:**
```bash
sudo nginx -T | grep -A 10 "location /ws"
```

**6. Test nginx configuration:**
```bash
sudo nginx -t
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTOMATED VALIDATION SCRIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**File:** `validate-websocket.sh`

**Tests:**
1. Backend listening on port 3001
2. API endpoint returns 200
3. Local WebSocket connection works
4. PM2 logs for WebSocket errors
5. Nginx WebSocket proxy configuration exists
6. Nginx configuration syntax valid

**Usage:**
```bash
cd /opt/Bitmind
chmod +x validate-websocket.sh
./validate-websocket.sh
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISION LOGIC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CASE A: Local WebSocket test FAILS**
- Backend WebSocket server has issue
- Check PM2 logs for errors
- Fix server architecture if needed

**CASE B: Local WebSocket test PASSES but nginx fails**
- Backend is working
- Nginx WebSocket proxy issue
- Fix nginx configuration

**CASE C: Both local and nginx work but browser fails**
- Browser security policy (CORS, mixed content)
- Check browser console for specific error
- May need additional headers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION STEPS ON VPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Step 1: Pull latest code with debug logs**
```bash
cd /opt/Bitmind
git pull
```

**Step 2: Restart backend to pick up debug logs**
```bash
pm2 restart bitmind
```

**Step 3: Run validation script**
```bash
chmod +x validate-websocket.sh
./validate-websocket.sh
```

**Step 4: Check PM2 logs for WebSocket debug output**
```bash
pm2 logs bitmind --lines 50
```

**Expected logs when WebSocket connects:**
```
🔍 UPGRADE REQUEST: /ws
🔍 UPGRADE HEADERS: { ... }
✅ WS UPGRADE ACCEPTED for /ws
✅ WS CLIENT CONNECTED
✅ WS OPEN: 127.0.0.1
🟢 WS CONNECTED | clients: 1
```

**Step 5: If local test passes, check nginx**
```bash
sudo nginx -T | grep -A 10 "location /ws"
```

**Step 6: If nginx config missing, add it**
```bash
sudo nano /etc/nginx/sites-available/default
# Add WebSocket proxy location block
sudo nginx -t
sudo systemctl reload nginx
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXPECTED OUTCOMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**If local WebSocket test FAILS:**
- Backend WebSocket server issue
- Debug logs will show upgrade requests
- Fix based on error in logs

**If local WebSocket test PASSES:**
- Backend is working correctly
- Issue is nginx proxy or browser
- Fix nginx configuration

**If nginx proxy missing:**
- Add WebSocket location block
- Reload nginx
- Test from browser

**If everything works locally but browser fails:**
- Check browser console for specific error
- May be CORS or mixed content issue
- Add additional headers if needed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Local WebSocket connection works
✅ PM2 logs show upgrade requests
✅ PM2 logs show client connections
✅ Nginx WebSocket proxy configured
✅ Browser WebSocket connects successfully
✅ No "connection failed" in browser console
✅ Connect Miner button triggers full flow

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICT RULES FOLLOWED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ No frontend edits
✅ No vite edits
✅ No cache theories
✅ No deployment theories
✅ No duplicate routes
✅ Debug ONLY real websocket transport layer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF INVESTIGATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
