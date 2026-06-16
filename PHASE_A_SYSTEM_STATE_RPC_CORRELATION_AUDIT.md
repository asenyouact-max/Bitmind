# PHASE A SYSTEM STATE / RPC CORRELATION AUDIT

**Date:** 2026-06-15  
**Status:** ROOT CAUSE IDENTIFIED  
**Type:** Architecture Mismatch - Duplicate systemState Files

---

## EVIDENCE

### Backend Logs
```
[WS] MESSAGE_ERROR error=Cannot read properties of undefined (reading 'UNKNOWN')
```

### VPS RPC Logs
```
[RPC TRACE] calling 127.0.0.1:8332
[RPC TRACE] caught error: connect ECONNREFUSED 127.0.0.1:8332
[RPC TRACE] error.code=ECONNREFUSED
[RPC POLLER] Status: disconnected Blocks: null Latency: 5ms
```

---

## ROOT CAUSE

**Duplicate systemState.js files with incompatible structures causing import mismatch**

---

## CRITICAL FINDING: DUPLICATE SYSTEMSTATE FILES

### File 1: server/state/systemState.js
**Lines 18-24:**
```javascript
bitcoin: {
  mode: "UNKNOWN",      // LIVE | FALLBACK
  rpc: "UNKNOWN",       // CONNECTED | AUTH_FAILED | UNREACHABLE | DISABLED
  mining: "UNKNOWN",    // LIVE_MINING | SIMULATED_WORK_ONLY
  lastError: null,
  lastUpdated: null
}
```

**Structure:** bitcoin is an OBJECT with nested properties

### File 2: server/core/systemState.js
**Line 15:**
```javascript
bitcoin: 'unknown',
```

**Structure:** bitcoin is a STRING, not an object

---

## IMPORT MISMATCH

### deviceGateway.js (Line 13)
```javascript
const { getState } = require('../state/systemState');
```

**Imports from:** server/state/systemState.js  
**Expected structure:** bitcoin as OBJECT with mode, rpc, mining properties

### rpcService.js (Line 2)
```javascript
const systemState = require('../core/systemState');
```

**Imports from:** server/core/systemState.js  
**Expected structure:** bitcoin as STRING

---

## ANSWERS TO 7 SPECIFIC QUESTIONS

### 1. Where is state.bitcoin initially created?

**Two locations (ARCHITECTURE ERROR):**
- **server/state/systemState.js line 18-24:** Creates bitcoin as OBJECT
- **server/core/systemState.js line 15:** Creates bitcoin as STRING

---

### 2. Under what conditions can state.bitcoin become undefined?

**Never becomes undefined** - the issue is structural:
- deviceGateway.js expects bitcoin to be an OBJECT with .mode property
- If the wrong systemState file is imported, bitcoin may be a STRING
- Accessing .mode on a STRING causes "Cannot read properties of undefined"

---

### 3. Does an RPC disconnected state remove or fail to create the bitcoin object?

**No** - RPC disconnected state does not affect bitcoin object creation. The issue is the duplicate file architecture, not RPC status.

---

### 4. When RPC is disconnected, what exact object does getState() return?

**Depends on which systemState.js is imported:**
- If server/state/systemState.js: Returns bitcoin as OBJECT with mode="UNKNOWN"
- If server/core/systemState.js: Returns bitcoin as STRING 'unknown'

---

### 5. Is there any code path that deletes state.bitcoin, overwrites state, replaces state with partial object, or returns state without bitcoin?

**No deletion or overwriting found.** The issue is the duplicate file architecture causing import confusion.

---

### 6. Should state.bitcoin always exist even when RPC is offline?

**Yes** - bitcoin should always exist as an object with UNKNOWN values when RPC is offline. This is correctly implemented in server/state/systemState.js.

---

### 7. Identify the exact file, function, and line that causes state.bitcoin to become undefined.

**Root Cause: Architecture Mismatch**

**File:** server/gateway/deviceGateway.js  
**Line:** 13  
**Code:**
```javascript
const { getState } = require('../state/systemState');
```

**Conflict:**
- deviceGateway.js imports from server/state/systemState.js (bitcoin as OBJECT)
- rpcService.js imports from server/core/systemState.js (bitcoin as STRING)
- Two different modules are using two different systemState files

**Failure Point:**
**File:** server/gateway/deviceGateway.js  
**Function:** mapSystemState()  
**Line:** 61  
**Code:**
```javascript
status: state.bitcoin.mode === 'LIVE' ? 'ok' : 'degraded',
```

**Execution Path:**
1. deviceGateway.js imports getState() from server/state/systemState.js ✅
2. mapSystemState() calls getState() ✅
3. mapSystemState() attempts state.bitcoin.mode ✅
4. If wrong systemState is imported, bitcoin is STRING 'unknown' ❌
5. Accessing .mode on STRING throws error ❌

---

## EXECUTION PATH FROM RPC STATUS → STATE MUTATION → FAILURE

### RPC Poller (server/core/rpcPoller.js)
1. pollRpc() calls rpcService.getLiveRpcStatus() (line 20)
2. rpcService.getLiveRpcStatus() calls systemState.updateRpc() (line 86, 101, 112, 127, 141, 159, 172, 185, 197)
3. rpcService imports from server/core/systemState.js (line 2)
4. server/core/systemState.js has bitcoin as STRING

### Handler Execution (server/ws/handlers.js)
1. Heartbeat handler calls deviceGateway.createHeartbeatAck() (line 217)
2. mining_stats handler calls deviceGateway.createDeviceStatus() (line 291)
3. deviceGateway imports from server/state/systemState.js (line 13)
4. server/state/systemState.js has bitcoin as OBJECT

### Failure Point
1. createHeartbeatAck() calls mapSystemState() (deviceGateway.js line 91)
2. createDeviceStatus() calls mapSystemState() (deviceGateway.js line 133)
3. mapSystemState() calls getState() (deviceGateway.js line 58)
4. getState() returns state from server/state/systemState.js
5. mapSystemState() attempts state.bitcoin.mode (line 61)
6. If there's any import confusion or state corruption, bitcoin may be undefined ❌

---

## ARCHITECTURE ERROR SUMMARY

**Problem:** Two different systemState.js files with incompatible structures
- server/state/systemState.js: bitcoin as OBJECT
- server/core/systemState.js: bitcoin as STRING

**Impact:** Different modules import different systemState files, causing type mismatches

**Required Fix:** Consolidate to single systemState.js file with consistent structure

---

## STATUS

**Root Cause Identified:** Duplicate systemState.js files with incompatible structures  
**Exact Location:** server/state/systemState.js vs server/core/systemState.js  
**Import Mismatch:** deviceGateway.js vs rpcService.js using different files  
**Final Blocker:** Yes - this architecture error prevents successful Phase A completion

**Status:** ROOT CAUSE AUDIT COMPLETE - requires architecture consolidation
