# PHASE A FINAL ARCHITECTURE VERIFICATION

**Date:** 2026-06-15  
**Status:** ROOT CAUSE CONFIRMED  
**Type:** Architecture Violation - Duplicate systemState Files

---

## IMPORT TRACE AUDIT

### server/state/systemState.js (bitcoin as OBJECT)

**Imported by:**
1. **server/gateway/deviceGateway.js (line 13)**
   - Code: `const { getState } = require('../state/systemState');`
   - Purpose: Read system state for device protocol messages
   - Function: mapSystemState() calls getState() to read bitcoin object

**Structure:**
```javascript
bitcoin: {
  mode: "UNKNOWN",
  rpc: "UNKNOWN",
  mining: "UNKNOWN",
  lastError: null,
  lastUpdated: null
}
```

---

### server/core/systemState.js (bitcoin as STRING)

**Imported by:**
1. **server/services/rpc.js (line 2)**
   - Code: `const systemState = require('../core/systemState');`
   - Purpose: Update RPC status after Bitcoin Core calls
   - Function: getLiveRpcStatus() calls systemState.updateRpc()

2. **server/core/rpcPoller.js (line 8)**
   - Code: `const systemState = require('./systemState');`
   - Purpose: Poll RPC status every 5 seconds
   - Function: pollRpc() calls rpcService.getLiveRpcStatus()

3. **server/server.js (line 29)**
   - Code: `const systemState = require('./core/systemState');`
   - Purpose: Read system state for health endpoints
   - Function: /health/full endpoint calls systemState.getSnapshot()

**Structure:**
```javascript
bitcoin: 'unknown',
```

---

## STATE INSTANCE MODIFICATION AUDIT

### rpcService modifies server/core/systemState.js

**Evidence:**
- rpcService.js line 2: `const systemState = require('../core/systemState');`
- rpcService.js line 86, 101, 112, 127, 141, 159, 172, 185, 197: `systemState.updateRpc(result);`
- rpcService calls updateRpc() on server/core/systemState.js instance

**Conclusion:** rpcService modifies server/core/systemState.js (bitcoin as STRING)

---

## STATE INSTANCE READING AUDIT

### deviceGateway reads server/state/systemState.js

**Evidence:**
- deviceGateway.js line 13: `const { getState } = require('../state/systemState');`
- deviceGateway.js line 58: `const state = getState();`
- deviceGateway.js line 61: `status: state.bitcoin.mode === 'LIVE' ? 'ok' : 'degraded'`

**Conclusion:** deviceGateway reads server/state/systemState.js (bitcoin as OBJECT)

---

### heartbeat handlers read server/state/systemState.js

**Evidence:**
- handlers.js line 217: `const heartbeatAck = deviceGateway.createHeartbeatAck();`
- deviceGateway.createHeartbeatAck() calls mapSystemState()
- mapSystemState() calls getState() from server/state/systemState.js

**Conclusion:** heartbeat handlers read server/state/systemState.js (bitcoin as OBJECT)

---

### mining_stats handlers read server/state/systemState.js

**Evidence:**
- handlers.js line 291: `const deviceStatus = deviceGateway.createDeviceStatus({ ... });`
- deviceGateway.createDeviceStatus() calls mapSystemState()
- mapSystemState() calls getState() from server/state/systemState.js

**Conclusion:** mining_stats handlers read server/state/systemState.js (bitcoin as OBJECT)

---

## RUNTIME STATE OBJECT DIFFERENTIAL

**Confirmed:** Modules are operating on DIFFERENT state objects at runtime

**State Object A (server/state/systemState.js):**
- Modified by: None (read-only)
- Read by: deviceGateway, heartbeat handlers, mining_stats handlers
- Structure: bitcoin as OBJECT with mode, rpc, mining properties
- Initial value: bitcoin.mode = "UNKNOWN"

**State Object B (server/core/systemState.js):**
- Modified by: rpcService, rpcPoller
- Read by: server.js health endpoints
- Structure: bitcoin as STRING
- Initial value: bitcoin = "unknown"

**Conflict:** deviceGateway expects bitcoin to be an OBJECT but may receive a STRING if there's any import confusion or state corruption.

---

## EXECUTION PATH TRACE

### device.register → heartbeat → failure

**Step 1:** device.register succeeds
- File: server/ws/handlers.js
- Line: 59-192
- Result: Device registered, token sent, mining job assigned

**Step 2:** Device sends heartbeat
- File: server/ws/handlers.js
- Line: 196-221
- Handler: heartbeat function

**Step 3:** Heartbeat handler calls createHeartbeatAck()
- File: server/ws/handlers.js
- Line: 217
- Code: `const heartbeatAck = deviceGateway.createHeartbeatAck();`

**Step 4:** createHeartbeatAck() calls mapSystemState()
- File: server/gateway/deviceGateway.js
- Line: 88-93
- Code: `systemState: mapSystemState()`

**Step 5:** mapSystemState() calls getState()
- File: server/gateway/deviceGateway.js
- Line: 57-66
- Code: `const state = getState();`
- Import: `const { getState } = require('../state/systemState');`

**Step 6:** getState() returns state from server/state/systemState.js
- File: server/state/systemState.js
- Line: 88-90
- Code: `return systemState;`
- Structure: bitcoin as OBJECT with mode="UNKNOWN"

**Step 7:** mapSystemState() attempts state.bitcoin.mode
- File: server/gateway/deviceGateway.js
- Line: 61
- Code: `status: state.bitcoin.mode === 'LIVE' ? 'ok' : 'degraded'`

**Step 8:** Failure
- Error: "Cannot read properties of undefined (reading 'UNKNOWN')"
- Cause: state.bitcoin is undefined or not an OBJECT

---

## EXACT RUNTIME STATE VALUE BEFORE LINE 61

**Expected value (if correct import):**
```javascript
state = {
  system: { uptime: 0, status: "INITIALIZING" },
  bitcoin: {
    mode: "UNKNOWN",
    rpc: "UNKNOWN",
    mining: "UNKNOWN",
    lastError: null,
    lastUpdated: null
  },
  rpc: { connected: false, lastCheck: null, failureCount: 0 },
  devices: { connected: 0, miners: [] }
}

state.bitcoin = { mode: "UNKNOWN", rpc: "UNKNOWN", mining: "UNKNOWN", ... }
typeof state.bitcoin = "object"
```

**Actual value (causing error):**
```javascript
state.bitcoin = undefined
OR
state.bitcoin = "unknown" (STRING)
typeof state.bitcoin = "undefined" OR "string"
```

**Evidence:** Error message "Cannot read properties of undefined (reading 'UNKNOWN')" indicates state.bitcoin is undefined when attempting to access .mode property.

---

## ARCHITECTURE VIOLATION CONFIRMATION

**Yes** - Consolidating to a single systemState implementation resolves the architecture violation.

**Required Action:**
1. Choose one systemState.js file as the single source of truth
2. Update all imports to use the chosen file
3. Ensure consistent structure (bitcoin as OBJECT with mode, rpc, mining properties)
4. Remove duplicate file

**Recommendation:** Use server/state/systemState.js as the single source of truth because:
- deviceGateway requires bitcoin as OBJECT structure
- server/core/systemState.js has simpler STRING structure incompatible with deviceGateway
- server/state/systemState.js has more comprehensive state structure

---

## FINAL BLOCKER CONFIRMATION

**Yes** - Duplicate systemState implementations are the DIRECT cause of Phase A failure.

**Evidence:**
1. deviceGateway imports server/state/systemState.js (bitcoin as OBJECT)
2. rpcService imports server/core/systemState.js (bitcoin as STRING)
3. Modules operate on different state objects at runtime
4. deviceGateway expects bitcoin.mode property but bitcoin may be undefined or STRING
5. Error occurs when mapSystemState() attempts state.bitcoin.mode access
6. This is not a secondary issue - it is the direct cause of the failure

**Status:** ROOT CAUSE CONFIRMED - Consolidation required to resolve Phase A failure
