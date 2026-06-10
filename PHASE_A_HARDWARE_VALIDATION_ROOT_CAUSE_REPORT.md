# PHASE A HARDWARE VALIDATION ROOT CAUSE REPORT

**Date:** 2026-06-10  
**Firmware:** bitmind_legacy_v1.ino  
**Backend:** server.js, ws/handlers.js  
**Status:** ROOT CAUSE ANALYSIS ONLY (NO FIXES)

---

## EXECUTIVE SUMMARY

Three critical mismatches identified between firmware implementation and backend expectations:

1. **Device Registration Mismatch:** Backend requires REST API pre-registration, firmware expects WebSocket registration
2. **Message Type Mismatch:** Firmware sends `mining_stats`, backend only handles `stats`
3. **RPC Configuration Mismatch:** Backend attempting localhost RPC instead of Tailscale remote Bitcoin Core

---

## ISSUE 1: DEVICE REGISTRATION FAILURE

### Symptom

Device connects to WebSocket, sends `device.register`, but backend logs show:
```
[WS] HEARTBEAT_FROM_UNKNOWN deviceId=esp32-1F84
```

Device never becomes registered.

### Root Cause

**File:** `server/ws/handlers.js`  
**Function:** `handlers.register` (lines 50-80)

**Code:**
```javascript
// Check if device is registered in DeviceRegistry
const isRegistered = DeviceRegistry.isRegistered(deviceId);
const isDevClient = DeviceRegistry.isDevClient(deviceId);

// Dev mode: allow web-client-* devices with warning
if (!isRegistered && isDevClient) {
  console.log("[WS] DEVICE_DEV_MODE_ALLOWED deviceId=" + deviceId + " reason=DEV_CLIENT_AUTO_ACCEPT");
  // Auto-register dev clients
  DeviceRegistry.register(deviceId, { deviceType: 'web-client' });
}

// If still not registered, reject with structured error
if (!DeviceRegistry.isRegistered(deviceId)) {
  console.log("[WS] DEVICE_REJECTED_UNREGISTERED deviceId=" + deviceId);
  const errorMsg = deviceGateway.createDeviceError('AUTH_INVALID', 'Device must be registered via REST API before WebSocket connection');
  ws.send(JSON.stringify(errorMsg));
  return false;
}
```

**Analysis:**
- Backend checks `DeviceRegistry.isRegistered(deviceId)` before accepting WebSocket registration
- DeviceRegistry is populated via REST API, not WebSocket
- Firmware device ID format: `esp32-1F84...` (not `web-client-*`)
- Device is not in DeviceRegistry, so registration is rejected
- Device continues sending heartbeat but backend treats as unknown device

**Firmware Code:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`  
**Function:** `sendDeviceRegister` (lines 294-304)

```cpp
void sendDeviceRegister() {
  String message = "{\"type\":\"device.register\",";
  message += "\"deviceId\":\"" + deviceId + "\",";
  message += "\"deviceType\":\"" + String(DEVICE_TYPE) + "\",";
  message += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
  message += "\"capabilities\":{\"oled\":false,\"wifi\":true,\"stratum\":true}}";
  message += "}";
  
  Serial.println("[PROTO] Sending device.register");
  sendWebSocketMessage(message.c_str());
}
```

**Mismatch:**
- Firmware expects WebSocket `device.register` to register device
- Backend requires REST API pre-registration before WebSocket connection
- No REST API registration step in firmware or hardware validation guide

---

## ISSUE 2: mining_stats UNHANDLED_TYPE

### Symptom

Backend logs show:
```
[WS] MESSAGE_UNKNOWN type=mining_stats reason=UNHANDLED_TYPE
```

### Root Cause

**File:** `server/server.js`  
**Function:** WebSocket message routing switch (lines 200-242)

**Code:**
```javascript
switch (data.type) {
  case "device.register":
    console.log("[WS] MESSAGE_ROUTED type=device.register handler=register");
    wsHandlers.handlers.register(ws, data);
    break;
    
  case "device.heartbeat":
    console.log("[WS] MESSAGE_ROUTED type=device.heartbeat handler=heartbeat");
    wsHandlers.handlers.heartbeat(ws, data);
    break;
    
  case "device_heartbeat":
    // Legacy underscore format - normalize to device.heartbeat handler
    console.log("[WS] MESSAGE_LEGACY_FORMAT type=device_heartbeat normalized=device.heartbeat");
    wsHandlers.handlers.heartbeat(ws, data);
    break;
    
  case "heartbeat":
    // Plain heartbeat variant - normalize to device.heartbeat handler
    console.log("[WS] MESSAGE_LEGACY_FORMAT type=heartbeat normalized=device.heartbeat");
    wsHandlers.handlers.heartbeat(ws, data);
    break;
    
  case "mining.share":
    console.log("[WS] MESSAGE_ROUTED type=mining.share handler=shareFound");
    wsHandlers.handlers.shareFound(ws, data);
    break;
    
  case "mining_job":
    // Legacy underscore format - normalize to mining.share handler
    console.log("[WS] MESSAGE_LEGACY_FORMAT type=mining_job normalized=mining.share");
    wsHandlers.handlers.shareFound(ws, data);
    break;
    
  case "stats":
    // Legacy stats message - map to heartbeat handler for telemetry
    console.log("[WS] MESSAGE_ROUTED type=stats handler=stats");
    wsHandlers.handlers.stats(ws, data);
    break;
    
  default:
    console.log("[WS] MESSAGE_UNKNOWN type=" + data.type + " reason=UNHANDLED_TYPE");
}
```

**Analysis:**
- Backend handles: `device.register`, `device.heartbeat`, `device_heartbeat`, `heartbeat`, `mining.share`, `mining_job`, `stats`
- Backend does NOT handle: `mining_stats`
- Firmware sends `mining_stats` per protocol v1 freeze documentation
- Backend only handles legacy `stats` format

**Firmware Code:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`  
**Function:** `sendTelemetry` (lines 330-344)

```cpp
void sendTelemetry() {
  String message = "{\"type\":\"mining_stats\",";
  message += "\"deviceId\":\"" + deviceId + "\",";
  message += "\"hashrate\":" + String(miningState.hashrate, 2) + ",";
  message += "\"acceptedShares\":" + String(miningState.acceptedShares) + ",";
  message += "\"rejectedShares\":" + String(miningState.rejectedShares) + ",";
  message += "\"uptime\":" + String(millis() / 1000);
  if (miningState.active) {
    message += ",\"jobId\":\"" + miningState.jobId + "\"";
  }
  message += "}";
  
  Serial.println("[PROTO] Sending mining_stats");
  sendWebSocketMessage(message.c_str());
}
```

**Mismatch:**
- Firmware uses protocol v1 message type: `mining_stats`
- Backend only handles legacy message type: `stats`
- Protocol freeze documentation specifies `mining_stats`
- Backend not updated to match protocol v1 freeze

---

## ISSUE 3: RPC LOCALHOST CONNECTION

### Symptom

Backend logs show:
```
[RPC TRACE] calling 127.0.0.1:8332
connect ECONNREFUSED 127.0.0.1:8332
```

### Root Cause

**File:** `server/services/rpc.js`  
**Function:** RPCService constructor (lines 12-22)

**Code:**
```javascript
constructor() {
  // Production: RPC_HOST, RPC_USER, RPC_PASSWORD MUST be set in .env
  // No fallbacks - configuration is explicit
  this.config = {
    host: process.env.RPC_HOST,
    port: parseInt(process.env.RPC_PORT) || 8332,
    user: process.env.RPC_USER,
    password: process.env.RPC_PASSWORD,
    timeout: parseInt(process.env.RPC_TIMEOUT) || 30000
  };

  // Runtime debug log (safe - does not print password)
  console.log('[RPC BOOT]', {
    host: this.config.host || 'MISSING',
    port: this.config.port,
    user: this.config.user ? 'SET' : 'MISSING',
    password: this.config.password ? 'SET' : 'MISSING'
  });
}
```

**Analysis:**
- RPC_HOST is read from `process.env.RPC_HOST`
- If RPC_HOST is not set or empty, it defaults to undefined/null
- Axios likely interprets undefined host as localhost (127.0.0.1)
- Backend attempts connection to 127.0.0.1:8332
- Bitcoin Core is not running on localhost (per Canonical State)

**Configuration File:** `.env.example` (lines 4-10)

```env
# RPC Configuration - Bitcoin Core (Tailscale VPN)
# RPC_HOST should be Tailscale IP of Bitcoin Core laptop (e.g., 100.82.184.116)
RPC_HOST=
RPC_PORT=8332
RPC_USER=Global
RPC_PASSWORD=Bitmind400KHotSecure
RPC_TIMEOUT=30000
```

**Canonical State:** `BITMIND_CANONICAL_STATE.md`

- Bitcoin Core runs on remote laptop via Tailscale VPN
- Backend should connect to Tailscale IP (e.g., 100.82.184.116)
- NOT localhost

**Mismatch:**
- `.env` file likely has empty `RPC_HOST=` or not set
- Backend defaults to localhost (127.0.0.1)
- Canonical State requires Tailscale remote connection
- Configuration not aligned with deployment requirements

---

## ROOT CAUSE SUMMARY

| Issue | File | Function | Root Cause |
|-------|------|----------|------------|
| Device Registration | server/ws/handlers.js | handlers.register | Backend requires REST API pre-registration, firmware expects WebSocket registration |
| mining_stats UNHANDLED | server/server.js | WebSocket routing | Backend handles legacy `stats`, firmware sends protocol v1 `mining_stats` |
| RPC Localhost | server/services/rpc.js | RPCService constructor | RPC_HOST not set in .env, defaults to localhost instead of Tailscale IP |

---

## PROTOCOL COMPLIANCE GAPS

### Protocol v1 Freeze vs Backend Implementation

**Protocol v1 Freeze (BITMIND_PROTOCOL_V1_FREEZE.md):**
- Message type: `mining_stats` for telemetry
- Device registration via WebSocket `device.register`
- No mention of REST API pre-registration requirement

**Backend Implementation:**
- Message type: `stats` (legacy format)
- Device registration requires REST API pre-registration
- WebSocket `device.register` only for reconnection

**Gap:** Backend not aligned with protocol v1 freeze specification

---

## CONFIGURATION GAPS

### Canonical State vs Actual Configuration

**Canonical State (BITMIND_CANONICAL_STATE.md):**
- Bitcoin Core on remote laptop via Tailscale VPN
- Backend connects to Tailscale IP

**Actual Configuration:**
- Backend attempting localhost (127.0.0.1:8332)
- RPC_HOST not set in .env

**Gap:** Environment configuration not aligned with deployment requirements

---

## FILES RESPONSIBLE

### Firmware Files
- `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`
  - `sendDeviceRegister()` (lines 294-304)
  - `sendTelemetry()` (lines 330-344)

### Backend Files
- `server/ws/handlers.js`
  - `handlers.register` (lines 50-80)
  - `handlers.stats` (lines 204-241)
- `server/server.js`
  - WebSocket message routing (lines 200-242)
- `server/services/rpc.js`
  - RPCService constructor (lines 12-22)

### Configuration Files
- `.env` (actual - not in repo)
- `.env.example` (template - lines 4-10)

---

## MISMATCHES IDENTIFIED

1. **Registration Flow Mismatch:**
   - Firmware: WebSocket registration expected
   - Backend: REST API pre-registration required
   - Impact: Device never registers, treated as unknown

2. **Message Type Mismatch:**
   - Firmware: `mining_stats` (protocol v1)
   - Backend: `stats` (legacy)
   - Impact: Telemetry rejected as UNHANDLED_TYPE

3. **RPC Configuration Mismatch:**
   - Canonical State: Tailscale remote Bitcoin Core
   - Actual: localhost connection attempt
   - Impact: RPC connection refused, no mining jobs

---

## NO FIXES APPLIED

This report identifies root causes only. No code changes, configuration changes, or fixes have been applied.

**Next Steps (Not Implemented):**
1. Align backend with protocol v1 freeze (add `mining_stats` handler)
2. Remove REST API pre-registration requirement or add REST API registration to firmware
3. Configure .env with correct Tailscale RPC_HOST
