# Bitmind Deterministic Reset - Complete Elimination of /api/devices
**Full Deterministic Reset + Rebuild + Verification**
Generated: 2026-05-25

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OBJECTIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Completely eliminate all occurrences of deprecated `/api/devices`, remove stale Vite bundles, reset dependency graph, and ensure production only uses `/api/miners`.

This is a full deterministic reset + rebuild + verification pass.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ No new features added
✅ No API renaming (final state: /api/miners)
✅ No duplicate endpoints
✅ No legacy compatibility routes (removed /api/devices)
✅ No cache or previous builds
✅ Everything rebuilt cleanly from source

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILES MODIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. bitmind-ui/src/hooks/useWebSocket.js**
- Changed: `/api/devices` → `/api/miners`
- Updated log message: "Devices loaded" → "Miners loaded"

**2. server/api/routes.js**
- Removed: `GET /api/devices` endpoint (legacy, deprecated)
- Kept: `GET /api/miners` endpoint (unified API)
- Kept: `GET /api/stats` endpoint
- Kept: `POST /api/miners/connect` endpoint

**3. bitmind-ui/vite.config.js**
- Verified: Clean configuration (no caching issues)
- Verified: `base: "/"` set correctly
- Verified: No legacy plugin caching
- Verified: No multiple entry points

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL API CONTRACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Only allowed endpoints:**

| Operation | Method | Endpoint | Purpose |
|-----------|--------|----------|---------|
| List miners | GET | `/api/miners` | Get all registered miners |
| Connect miner | POST | `/api/miners/connect` | Register new miner |
| Get stats | GET | `/api/stats` | Get system statistics |

**Removed endpoints:**
- ❌ `GET /api/devices` (completely removed)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTOMATED SCRIPTS CREATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**1. deterministic-reset.sh**
- Pulls latest code
- Verifies source code has no /api/devices
- Kills old module graph (dist, node_modules/.vite, node_modules)
- Reinstalls fresh dependencies
- Builds frontend
- Verifies build sanity (no /api/devices)
- Verifies /api/miners references
- Clean deployment (zero cache policy)
- Cache invalidation (touches all files)
- Restarts nginx
- Verifies deployment (no /api/devices)

**2. final-validation.sh**
- Tests source code has zero /api/devices
- Tests build has zero /api/devices
- Tests build has /api/miners references
- Tests deployment has zero /api/devices
- Tests deployment has /api/miners references
- Tests backend /api/miners returns 200
- Tests backend /api/devices returns 404
- Tests backend /api/stats returns 200
- Tests nginx is running
- Tests production build sanity
- Final grep check for /api/devices in production

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXECUTION ON VPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Step 1: Clone repository (if not exists)**
```bash
cd /opt
sudo git clone https://github.com/asenyouact-max/Bitmind.git
```

**Step 2: Make scripts executable**
```bash
cd /opt/Bitmind
chmod +x deterministic-reset.sh final-validation.sh
```

**Step 3: Run deterministic reset**
```bash
sudo ./deterministic-reset.sh
```

**Step 4: Run final validation**
```bash
./final-validation.sh
```

**Step 5: Restart backend (to pick up route changes)**
```bash
pm2 restart bitmind
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXPECTED OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**deterministic-reset.sh:**
```
✓ Latest code pulled
✓ Source code is clean (no /api/devices)
✓ Old module graph destroyed
✓ Fresh dependencies installed
✓ Frontend built
✓ OK - CLEAN (no /api/devices in build)
✓ /api/miners references found
✓ Clean deployment complete
✓ Cache invalidated
✓ Nginx restarted
✓ Deployment is clean (no /api/devices)
✓ Nginx is running
```

**final-validation.sh:**
```
✓ PASS: Zero /api/devices in source
✓ PASS: Zero /api/devices in build
✓ PASS: /api/miners references found
✓ PASS: Zero /api/devices in deployment
✓ PASS: /api/miners references found
✓ PASS: /api/miners returns 200
✓ PASS: /api/devices returns 404 (endpoint removed)
✓ PASS: /api/stats returns 200
✓ PASS: Nginx is running
✓ PASS: Production build is sane
✓ PASS: CLEAN PRODUCTION
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BROWSER VALIDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**In production:**

1. Open https://getbitmind.com
2. Open DevTools → Network
3. Hard refresh (Ctrl+Shift+R)
4. **MUST SEE:**
   - NO `/api/devices` requests
   - ONLY `/api/miners` requests
5. **MUST WORK:**
   - Connect Miner button triggers request
   - No silent UI failures
   - No JS errors in Console

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUCCESS CRITERIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Zero `/api/devices` anywhere in codebase
✅ Zero `/api/devices` in dist
✅ Zero `/api/devices` in production
✅ Only `/api/miners` exists
✅ Button triggers real API call
✅ No silent frontend failures
✅ Clean WebSocket + API flow
✅ Backend `/api/miners` returns 200
✅ Backend `/api/devices` returns 404
✅ All validation tests pass

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
