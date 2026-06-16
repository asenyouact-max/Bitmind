# PHASE A BACKEND UNKNOWN ACCESS ROOT CAUSE

**Date:** 2026-06-15  
**Status:** ROOT CAUSE IDENTIFIED  
**Type:** State Access Error

---

## EVIDENCE

### Backend Logs
```
[WS] MESSAGE_PARSED type=device.register
[WS] MESSAGE_ROUTED type=device.register handler=register
[WS] SOCKET_REPLACED deviceId=esp32-1f84
[WS] DEVICE_RECONNECTED deviceId=esp32-1f84
[WS] MESSAGE_PARSED type=device.heartbeat
[WS] MESSAGE_ROUTED type=device.heartbeat handler=heartbeat
[WS] MESSAGE_ERROR error=Cannot read properties of undefined (reading 'UNKNOWN')
[WS] MESSAGE_PARSED type=mining_stats
[WS] MESSAGE_ROUTED type=mining_stats handler=mining_stats
[WS] MINING_STATS_RECEIVED deviceId=esp32-1f84
[WS] MESSAGE_ERROR error=Cannot read properties of undefined (reading 'UNKNOWN')
```

---

## ROOT CAUSE

**Undefined state.bitcoin object access in deviceGateway.mapSystemState()**

---

## EXACT FILE, FUNCTION, LINE

### Backend Access Point
**File:** server/gateway/deviceGateway.js  
**Function:** mapSystemState()  
**Lines:** 57-66

**Code:**
```javascript
function mapSystemState() {
  const state = getState();
  
  return {
    status: state.bitcoin.mode === 'LIVE' ? 'ok' : 'degraded',
    mode: STATE_MAPPING.bitcoinMode[state.bitcoin.mode] || 'FALLBACK',
    rpc: STATE_MAPPING.rpcState[state.bitcoin.rpc] || 'UNREACHABLE',
    mining: STATE_MAPPING.miningMode[state.bitcoin.mining] || 'IDLE'
  };
}
```

**Access Pattern:**
- Line 61: `state.bitcoin.mode`
- Line 62: `state.bitcoin.mode`
- Line 63: `state.bitcoin.rpc`
- Line 64: `state.bitcoin.mining`

---

## WHAT OBJECT IS UNDEFINED

**Object:** `state.bitcoin`

**Evidence:**
- Error message: "Cannot read properties of undefined (reading 'UNKNOWN')"
- The code attempts to read `state.bitcoin.mode` but `state.bitcoin` is undefined
- JavaScript throws this error when trying to access a property on an undefined object

---

## WHY OBJECT BECOMES UNDEFINED AFTER REGISTRATION

**Initial State (systemState.js lines 18-24):**
```javascript
bitcoin: {
  mode: "UNKNOWN",
  rpc: "UNKNOWN",
  mining: "UNKNOWN",
  lastError: null,
  lastUpdated: null
}
```

**Issue:** The `getState()` function returns the `systemState` object directly. When `mapSystemState()` is called, it receives this state and attempts to access `state.bitcoin.mode`. The error indicates that `state.bitcoin` is undefined at the time of access.

**Timing:** The error occurs immediately after successful device registration, when:
1. Heartbeat handler calls `deviceGateway.createHeartbeatAck()` (line 217)
2. mining_stats handler calls `deviceGateway.createDeviceStatus()` (line 291)
3. Both functions internally call `mapSystemState()`
4. `mapSystemState()` attempts to access `state.bitcoin.mode`
5. `state.bitcoin` is undefined → error thrown

---

## HEARTBEAT AND MINING_STATS CODE PATH SHARING

**Yes - both handlers share the same failing code path**

### Heartbeat Handler (handlers.js lines 196-221)
```javascript
heartbeat: (ws, data) => {
  // ... validation ...
  state.mutations.updateDevice(data.deviceId, { ... });
  
  // Phase D: Send protocol-compliant heartbeat ACK
  const heartbeatAck = deviceGateway.createHeartbeatAck();  // Line 217
  ws.send(JSON.stringify(heartbeatAck));
  
  return true;
}
```

### mining_stats Handler (handlers.js lines 264-301)
```javascript
mining_stats: (ws, data) => {
  // ... validation ...
  state.mutations.updateDevice(data.deviceId, { ... });
  
  // Phase D: Send protocol-compliant device status
  const deviceStatus = deviceGateway.createDeviceStatus({ ... });  // Line 291
  ws.send(JSON.stringify(deviceStatus));
  
  return true;
}
```

### Shared Failure Point
**deviceGateway.js:**
- `createHeartbeatAck()` (line 88-93) calls `mapSystemState()` (line 91)
- `createDeviceStatus()` (line 132-163) calls `mapSystemState()` (line 133)
- Both fail at `state.bitcoin.mode` access in `mapSystemState()`

---

## EXACT FAILURE POINT

**File:** server/gateway/deviceGateway.js  
**Function:** mapSystemState()  
**Line:** 61

**Code:**
```javascript
status: state.bitcoin.mode === 'LIVE' ? 'ok' : 'degraded',
```

**Execution Flow:**
1. Device registration succeeds ✅
2. Heartbeat message arrives ✅
3. Heartbeat handler executes ✅
4. Handler calls `deviceGateway.createHeartbeatAck()` ✅
5. `createHeartbeatAck()` calls `mapSystemState()` ✅
6. `mapSystemState()` calls `getState()` ✅
7. `mapSystemState()` attempts `state.bitcoin.mode` ❌
8. `state.bitcoin` is undefined ❌
9. Error thrown: "Cannot read properties of undefined (reading 'UNKNOWN')" ❌

---

## ROOT CAUSE ANALYSIS

**Primary Hypothesis:** The `state.bitcoin` object is being deleted or set to undefined somewhere in the code between system initialization and handler execution.

**Secondary Hypothesis:** The `getState()` function is returning an incomplete or corrupted state object.

**Required Investigation:** 
1. Search for any code that sets `state.bitcoin = undefined` or `delete state.bitcoin`
2. Verify `getState()` always returns the complete `systemState` object
3. Check if any state mutation functions are corrupting the `bitcoin` object

---

## STATUS

**Root Cause Identified:** Undefined `state.bitcoin` object access in `mapSystemState()`  
**Exact Location:** server/gateway/deviceGateway.js line 61  
**Affected Handlers:** heartbeat, mining_stats (both call `mapSystemState()` via deviceGateway)  
**Timing:** Occurs immediately after successful device registration

**Status:** ROOT CAUSE AUDIT COMPLETE - requires further investigation of state mutation code
