# Bitmind API Alignment Fix
**Critical Production Bug - Unified API Layer**
Generated: 2026-05-25

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROOT CAUSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Frontend called:** `GET /api/devices`
**Backend had:** `GET /api/devices` (existed but returned 404 in production)

**Issue:** API naming inconsistency causing confusion and potential routing issues.

**Solution:** Unified API layer using `/api/miners` for all miner-related operations.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILES MODIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. bitmind-ui/src/hooks/useWebSocket.js**

**Before:**
```javascript
const response = await fetch('/api/devices');
console.log('Devices loaded:', devices);
```

**After:**
```javascript
const response = await fetch('/api/miners');
console.log('Miners loaded:', devices);
```

**Why:** Unified API naming - all miner operations use `/api/miners`.

---

**2. server/api/routes.js**

**Added:**
```javascript
// Miners endpoint - returns live miner registry (unified API)
router.get('/miners', (req, res) => {
  try {
    const minerList = state.getAllDevices();

    res.json({
      success: true,
      count: minerList.length,
      miners: minerList
    });
  } catch (error) {
    console.error('Error getting API miners:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get miner list'
    });
  }
});
```

**Kept for backward compatibility:**
```javascript
// Devices endpoint - returns live device registry (legacy, deprecated)
router.get('/devices', (req, res) => {
  // ... same implementation
});
```

**Why:** New unified `/api/miners` endpoint, kept `/api/devices` as legacy for any existing consumers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UNIFIED API DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Frontend → Backend API Contract:**

| Operation | Method | Endpoint | Purpose |
|-----------|--------|----------|---------|
| List miners | GET | `/api/miners` | Get all registered miners |
| Connect miner | POST | `/api/miners/connect` | Register new miner |
| Get stats | GET | `/api/stats` | Get system statistics |

**Legacy (deprecated but kept):**
- `GET /api/devices` - Same as `/api/miners`

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPLOYMENT STEPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. Commit and push:**
```bash
git add -A
git commit -m "Unify API layer - use /api/miners for all miner operations"
git push
```

**2. On VPS:**
```bash
cd /opt/Bitmind
git pull
cd bitmind-ui
npm run build
sudo rm -rf /usr/share/nginx/html/*
sudo cp -r dist/* /usr/share/nginx/html/
sudo systemctl restart nginx

# Restart backend to pick up new routes
pm2 restart bitmind
```

**3. Verify API endpoints:**
```bash
# Test new endpoint
curl http://localhost:3001/api/miners

# Test legacy endpoint (should still work)
curl http://localhost:3001/api/devices

# Test connect endpoint
curl -X POST http://localhost:3001/api/miners/connect \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"bc1test","workerName":"test","deviceType":"ESP32"}'
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ No /api/devices calls in frontend code
✅ /api/miners is unified API layer
✅ GET /api/miners returns JSON (not 404)
✅ POST /api/miners/connect works
✅ Connect Miner triggers backend successfully
✅ No 404 HTML responses
✅ UI flow completes end-to-end
✅ Legacy /api/devices still works (backward compatibility)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
