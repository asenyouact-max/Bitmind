# PHASE A REGISTRATION ARCHITECTURE AUDIT

**Date:** 2026-06-10  
**Status:** RECOMMENDATION ONLY (NO CODE CHANGES)  
**Scope:** Determine canonical Bitmind device onboarding model for Phase A

---

## EXECUTIVE SUMMARY

**Recommendation:** MODEL A - WebSocket Self-Registration

**Rationale:** Firmware architecture, protocol freeze, and pre-flashed ESP deployment model all specify WebSocket self-registration. Current backend implementation (MODEL B) is misaligned with canonical specifications.

**Impact:** Backend requires alignment with MODEL A to support pre-flashed ESP32 devices.

---

## MODEL DEFINITIONS

### MODEL A: WebSocket Self-Registration

**Flow:**
```
Device boots
→ device.register via WebSocket
→ backend creates/registers device automatically
→ device becomes active
```

**Characteristics:**
- Device initiates registration via WebSocket
- Backend accepts device.register without pre-registration
- Backend creates device record on first registration
- Subsequent reconnections use existing record
- No REST API step required
- Suitable for pre-flashed devices

### MODEL B: REST API Pre-Registration

**Flow:**
```
Device must already exist in DeviceRegistry
→ registration occurs through REST/API/admin workflow
→ device.register only attaches an already-known device
```

**Characteristics:**
- Device must be pre-registered via REST API
- WebSocket device.register only for reconnection
- Backend rejects unknown devices
- Requires admin or UI workflow for initial registration
- Suitable for web clients with UI

---

## EVIDENCE ANALYSIS

### 1. Firmware Architecture Specification

**Document:** BITMIND_FIRMWARE_ARCHITECTURE.md

**Legacy Firmware Registration Flow (lines 174-180):**
```
6. **Device Registration**
   - Send `device.register` message
   - Include: deviceId, deviceType, firmwareVersion
   - Wait for `device.registered` response
   - Store token from response
   - Set registration flag
```

**Expected Response (lines 263-272):**
```json
{
  "type": "device.registered",
  "status": "accepted",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "token": "32-char-auth-token",
  "serverTime": 1717891200
}
```

**User Experience (lines 221-222):**
```
- Device reboots and connects to user's WiFi
- Device registers with backend automatically
```

**Analysis:** Firmware architecture clearly specifies MODEL A - automatic WebSocket registration after AP mode setup.

---

### 2. Protocol Freeze Specification

**Document:** BITMIND_PROTOCOL_V1_FREEZE.md

**device.register Schema (lines 361-378):**
```json
{
  "type": "device.register",
  "deviceId": "string (pattern: ^esp32-[a-f0-9]{4,12}$)",
  "deviceType": "enum: [\"oled_miner\", \"miner\", \"test_client\"]",
  "firmwareVersion": "string (pattern: ^\\d+\\.\\d+\\.\\d+$)",
  "capabilities": {
    "oled": "boolean",
    "wifi": "boolean",
    "stratum": "boolean"
  }
}
```

**device.registered Schema (lines 386-403):**
```json
{
  "type": "device.registered",
  "status": "const: \"accepted\"",
  "deviceId": "string",
  "token": "string (minLength: 32)",
  "serverTime": "integer"
}
```

**Configuration Rules (lines 661-675):**
```
**Configuration Method:**
- AP mode web portal only (Phase A)
- QR onboarding: NOT IMPLEMENTED (Phase B)

**Configuration Update:**
- Manual re-entry to AP mode
- No backend-initiated updates (Phase A)
```

**Analysis:** Protocol freeze specifies device.register message with no mention of REST API pre-registration requirement. Configuration is AP mode only (Phase A).

---

### 3. Canonical State

**Document:** BITMIND_CANONICAL_STATE.md

**Phase A Objectives (lines 257-264):**
```
5. DEVICE MANAGEMENT

Requirements:

[ ] Device registration
[ ] Device identification
[ ] Device status reporting
[ ] Device management
```

**Analysis:** Canonical State mentions "Device registration" as a Phase A objective but does not specify the registration model. Delegates to firmware architecture and protocol freeze.

---

### 4. Device Registry Implementation

**Document:** server/services/deviceRegistry.js

**register() Function (lines 34-60):**
```javascript
register: (deviceId, metadata = {}) => {
  // ... validation ...
  const existing = registry.get(deviceId);
  const isNew = !existing;

  if (isNew) {
    const registration = createRegistration(deviceId, metadata);
    registry.set(deviceId, registration);
    log('DEVICE_REGISTERED', deviceId, { deviceType: metadata.deviceType });
  } else {
    // Update existing registration
    existing.metadata = { ...existing.metadata, ...metadata };
    log('DEVICE_UPDATED', deviceId, { deviceType: metadata.deviceType });
  }

  return {
    success: true,
    deviceId,
    status: 'registered',
    isNew,
    token: registry.get(deviceId).token
  };
}
```

**Analysis:** DeviceRegistry.register() supports both new registration and updates. No inherent requirement for pre-registration.

---

### 5. Backend WebSocket Handler

**Document:** server/ws/handlers.js

**register() Handler (lines 50-80):**
```javascript
register: (ws, data) => {
  const deviceId = data.deviceId;
  const ipAddress = ws._socket.remoteAddress;

  // Phase D: Validate registration using deviceGateway
  const validation = deviceGateway.validateRegistration(data);
  if (!validation.valid) {
    console.log("[WS] REGISTER_FAILED deviceId=" + (deviceId || 'null') + " reason=" + validation.error);
    const errorMsg = deviceGateway.createDeviceError('PAYLOAD_INVALID', validation.error);
    ws.send(JSON.stringify(errorMsg));
    return false;
  }

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
  // ... rest of registration logic ...
}
```

**Analysis:** Backend WebSocket handler implements MODEL B - requires REST API pre-registration. Only auto-registers web-client-* devices.

---

### 6. REST API Registration

**Document:** server/api/routes.js

**POST /device/register Endpoint (lines 380-421):**
```javascript
router.post('/device/register', (req, res) => {
  try {
    const { deviceId, deviceType, walletAddress, workerName } = req.body;
    const DeviceRegistry = require('../services/deviceRegistry');

    // Validation
    if (!deviceId || !deviceId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Device ID is required'
      });
    }

    // Register device using DeviceRegistry
    const result = DeviceRegistry.register(deviceId, {
      deviceType: deviceType || 'web-client',
      walletAddress: walletAddress || null,
      workerName: workerName || null
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    console.log(`[API] Device registered: ${deviceId} (${result.isNew ? 'NEW' : 'UPDATE'})`);

    res.json({
      success: true,
      deviceId: result.deviceId,
      status: result.status,
      isNew: result.isNew,
      token: result.token
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to register device'
    });
  }
});
```

**Analysis:** REST API endpoint exists for device registration. Used by web clients and admin workflows.

---

### 7. Onboarding Flow (Web Clients)

**Document:** ONBOARDING_FLOW_REPORT.md

**Objective (lines 9-10):**
```
Convert "Connect Miner" from instant action into a full onboarding modal flow that registers miner identity + wallet + device type before connecting.
```

**POST /api/miners/connect Endpoint (lines 86-134):**
```json
{
  "walletAddress": "bc1q...",
  "workerName": "my-miner-01",
  "deviceType": "esp32",
  "miningMode": "standard"
}
```

**Analysis:** Web client onboarding uses REST API for registration. This is MODEL B, appropriate for web clients with UI.

---

### 8. Pre-Flashed ESP Deployment Model

**Document:** BITMIND_FIRMWARE_ARCHITECTURE.md

**AP Mode Flow (lines 186-222):**
```
**Trigger:** WiFi credentials missing or WiFi connection timeout

**User Experience:**
- User connects to `Bitmind-Setup` WiFi
- User opens browser to `http://192.168.4.1`
- User fills form and submits
- Device reboots and connects to user's WiFi
- Device registers with backend automatically
```

**Analysis:** Pre-flashed ESP32 devices have no UI for REST API registration. Registration must happen automatically via WebSocket after AP mode setup.

---

## MODEL EVALUATION AGAINST PHASE A GOALS

### Phase A Goals (BITMIND_CANONICAL_STATE.md)

1. **RPC Stability** - Not affected by registration model
2. **Backend Stability** - MODEL A simpler (no REST API dependency)
3. **Firmware Stability** - MODEL A matches firmware architecture
4. **Mining Flow** - Not affected by registration model
5. **Device Management** - MODEL A enables automatic device management
6. **QR Onboarding** - AP mode only (Phase A), MODEL A compatible
7. **UI/UX** - MODEL A required for pre-flashed devices (no UI)

### Pre-Flashed ESP Deployment Model

**Requirements:**
- Device ships with firmware pre-flashed
- User has no access to REST API
- User has no admin interface
- Registration must be automatic

**MODEL A:** ✅ Compatible - Automatic WebSocket registration
**MODEL B:** ❌ Incompatible - Requires REST API pre-registration

### Worker Identity Architecture

**Canonical Model (BITMIND_CANONICAL_STATE.md):**
- Worker name is primary device identity
- Source: User-provided during onboarding
- Storage: Preferences NV storage

**MODEL A:** ✅ Compatible - Worker name provided in AP mode, sent in device.register
**MODEL B:** ❌ Incompatible - Worker name must be provided via REST API before device boots

### Device Identity Architecture

**Canonical Model (BITMIND_CANONICAL_STATE.md):**
- Device ID is secondary identity (hardware identifier)
- Source: ESP32 EFuse MAC address
- Format: esp32-{upper4hex}{lower8hex}

**MODEL A:** ✅ Compatible - Device ID generated from MAC, sent in device.register
**MODEL B:** ⚠️ Partially compatible - Device ID must be known before REST API registration

### Existing Onboarding Flow

**Web Client Onboarding (ONBOARDING_FLOW_REPORT.md):**
- Uses REST API (/api/miners/connect)
- Has UI for wallet address, worker name, device type
- MODEL B appropriate for web clients

**ESP32 Onboarding (BITMIND_FIRMWARE_ARCHITECTURE.md):**
- Uses AP mode web portal
- No REST API access
- MODEL A required for ESP32

**Analysis:** Different device types require different registration models. Web clients use MODEL B, ESP32 devices use MODEL A.

---

## NON-CANONICAL CODE PATHS

### 1. Backend WebSocket Handler

**File:** server/ws/handlers.js  
**Function:** handlers.register (lines 64-80)

**Non-Canonical Code:**
```javascript
// If still not registered, reject with structured error
if (!DeviceRegistry.isRegistered(deviceId)) {
  console.log("[WS] DEVICE_REJECTED_UNREGISTERED deviceId=" + deviceId);
  const errorMsg = deviceGateway.createDeviceError('AUTH_INVALID', 'Device must be registered via REST API before WebSocket connection');
  ws.send(JSON.stringify(errorMsg));
  return false;
}
```

**Issue:** Rejects ESP32 devices that are not pre-registered via REST API.

**Required Change:** Remove pre-registration check for ESP32 devices. Auto-register on first device.register.

---

### 2. Backend WebSocket Handler

**File:** server/ws/handlers.js  
**Function:** handlers.register (lines 67-72)

**Non-Canonical Code:**
```javascript
// Dev mode: allow web-client-* devices with warning
if (!isRegistered && isDevClient) {
  console.log("[WS] DEVICE_DEV_MODE_ALLOWED deviceId=" + deviceId + " reason=DEV_CLIENT_AUTO_ACCEPT");
  // Auto-register dev clients
  DeviceRegistry.register(deviceId, { deviceType: 'web-client' });
}
```

**Issue:** Only auto-registers web-client-* devices, not ESP32 devices.

**Required Change:** Extend auto-registration to ESP32 devices (deviceId starts with "esp32-").

---

## CANONICAL REGISTRATION ARCHITECTURE RECOMMENDATION

### Recommendation: MODEL A - WebSocket Self-Registration

**Canonical Registration Flow for ESP32 Devices:**
```
1. Device boots without WiFi credentials
2. Device enters AP mode (SSID: Bitmind-Setup)
3. User connects to AP and opens browser to http://192.168.4.1
4. User fills form: WiFi SSID, Password, Worker Name, Wallet Address
5. Device saves to Preferences NV storage
6. Device reboots
7. Device connects to user's WiFi
8. Device connects to WebSocket
9. Device sends device.register (deviceId, deviceType, firmwareVersion, capabilities, workerName, wallet)
10. Backend validates device.register
11. Backend auto-registers device (if not already registered)
12. Backend sends device.registered (status, deviceId, token, serverTime)
13. Device stores token
14. Device becomes active
```

**Canonical Registration Flow for Web Clients:**
```
1. User opens Bitmind UI
2. User clicks "Connect Miner"
3. User fills modal: Wallet Address, Worker Name, Device Type
4. Frontend calls POST /api/miners/connect
5. Backend registers device via REST API
6. Backend returns miner data
7. Frontend connects WebSocket
8. Device sends device.register
9. Backend validates device.register (already registered)
10. Backend sends device.registered
11. Device becomes active
```

**Dual-Model Architecture:**
- **ESP32 Devices:** MODEL A - WebSocket self-registration
- **Web Clients:** MODEL B - REST API pre-registration
- **Backend:** Supports both models based on device type

---

## EVIDENCE SUPPORTING RECOMMENDATION

### 1. Firmware Architecture Specification

**Evidence:** BITMIND_FIRMWARE_ARCHITECTURE.md lines 174-222

**Support:** Firmware architecture explicitly specifies automatic WebSocket registration after AP mode setup. No mention of REST API pre-registration.

### 2. Protocol Freeze Specification

**Evidence:** BITMIND_PROTOCOL_V1_FREEZE.md lines 361-403

**Support:** Protocol freeze defines device.register and device.registered message schemas. No mention of REST API pre-registration requirement.

### 3. Pre-Flashed ESP Deployment Model

**Evidence:** BITMIND_FIRMWARE_ARCHITECTURE.md lines 186-222

**Support:** Pre-flashed devices have no UI for REST API registration. Registration must be automatic via WebSocket.

### 4. Phase A Goals

**Evidence:** BITMIND_CANONICAL_STATE.md lines 257-264

**Support:** Phase A includes "Device registration" as an objective. MODEL A enables automatic device registration without manual intervention.

### 5. Worker Identity Architecture

**Evidence:** BITMIND_CANONICAL_STATE.md lines 334-348

**Support:** Worker name is user-provided during onboarding. MODEL A allows worker name to be provided in AP mode and sent in device.register.

---

## COMPONENTS REQUIRING ALIGNMENT

### 1. Backend WebSocket Handler

**File:** server/ws/handlers.js  
**Function:** handlers.register (lines 64-80)

**Required Change:**
- Remove pre-registration check for ESP32 devices
- Auto-register ESP32 devices on first device.register
- Keep pre-registration requirement for web clients (MODEL B)

**Implementation:**
```javascript
// Check if device is registered in DeviceRegistry
const isRegistered = DeviceRegistry.isRegistered(deviceId);
const isDevClient = DeviceRegistry.isDevClient(deviceId);
const isEsp32Device = deviceId && deviceId.startsWith('esp32-');

// Dev mode: allow web-client-* devices with warning
if (!isRegistered && isDevClient) {
  console.log("[WS] DEVICE_DEV_MODE_ALLOWED deviceId=" + deviceId + " reason=DEV_CLIENT_AUTO_ACCEPT");
  DeviceRegistry.register(deviceId, { deviceType: 'web-client' });
}

// ESP32 devices: auto-register on first connection
if (!isRegistered && isEsp32Device) {
  console.log("[WS] DEVICE_AUTO_REGISTERED deviceId=" + deviceId + " reason=ESP32_SELF_REGISTRATION");
  DeviceRegistry.register(deviceId, { 
    deviceType: data.deviceType || 'miner',
    workerName: data.workerName,
    walletAddress: data.walletAddress
  });
}

// If still not registered (non-ESP32, non-dev-client), reject
if (!DeviceRegistry.isRegistered(deviceId)) {
  console.log("[WS] DEVICE_REJECTED_UNREGISTERED deviceId=" + deviceId);
  const errorMsg = deviceGateway.createDeviceError('AUTH_INVALID', 'Device must be registered via REST API before WebSocket connection');
  ws.send(JSON.stringify(errorMsg));
  return false;
}
```

---

### 2. Backend WebSocket Handler

**File:** server/ws/handlers.js  
**Function:** handlers.register (lines 119-135)

**Required Change:**
- Extract workerName and walletAddress from device.register payload
- Pass to DeviceRegistry.register() for ESP32 devices

**Implementation:**
```javascript
// Handle workerName with fallback logic
if (data.workerName && typeof data.workerName === 'string' && data.workerName.trim().length > 0) {
  if (isNewDevice || !device.workerName) {
    state.mutations.updateDevice(deviceId, {
      workerName: data.workerName.trim()
    });
    console.log("[WS] WORKER_NAME_SET deviceId=" + deviceId + " workerName=" + data.workerName.trim());
  }
} else if (isNewDevice && !device.workerName) {
  const fallbackName = `miner-${deviceId.substring(0, 8)}`;
  state.mutations.updateDevice(deviceId, {
    workerName: fallbackName
  });
  console.log("[WS] WORKER_NAME_FALLBACK deviceId=" + deviceId + " workerName=" + fallbackName);
}

// Preserve wallet address if provided
if (data.walletAddress) {
  state.mutations.updateDevice(deviceId, {
    walletAddress: data.walletAddress
  });
}
```

---

### 3. Firmware Implementation

**File:** esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino  
**Function:** sendDeviceRegister (lines 294-304)

**Required Change:**
- Add workerName and walletAddress to device.register payload
- Match protocol freeze schema

**Current Implementation:**
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

**Required Implementation:**
```cpp
void sendDeviceRegister() {
  String message = "{\"type\":\"device.register\",";
  message += "\"deviceId\":\"" + deviceId + "\",";
  message += "\"deviceType\":\"" + String(DEVICE_TYPE) + "\",";
  message += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
  message += "\"workerName\":\"" + config.workerName + "\",";
  message += "\"walletAddress\":\"" + config.wallet + "\",";
  message += "\"capabilities\":{\"oled\":false,\"wifi\":true,\"stratum\":true}}";
  message += "}";
  
  Serial.println("[PROTO] Sending device.register");
  sendWebSocketMessage(message.c_str());
}
```

---

## MIGRATION IMPACT ASSESSMENT

### Impact on Existing Web Clients

**Impact:** None

**Reason:** Web clients continue to use MODEL B (REST API pre-registration). Backend change only affects ESP32 devices.

**Migration Required:** None

---

### Impact on Existing ESP32 Devices

**Impact:** Positive

**Reason:** ESP32 devices will be able to register automatically via WebSocket without REST API pre-registration.

**Migration Required:** None (automatic on next connection)

---

### Impact on Backend

**Impact:** Minimal

**Reason:** Backend WebSocket handler requires modification to auto-register ESP32 devices. REST API endpoint unchanged.

**Migration Required:** 
- Update server/ws/handlers.js
- Test with ESP32 device
- Test with web client (regression test)

---

### Impact on Firmware

**Impact:** Minimal

**Reason:** Firmware requires modification to include workerName and walletAddress in device.register payload.

**Migration Required:**
- Update esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino
- Flash updated firmware to ESP32 devices

---

### Risk Assessment

**Risk Level:** Low

**Reasoning:**
- Change is additive (auto-registration) not destructive
- Web clients unaffected (MODEL B preserved)
- ESP32 devices benefit (MODEL A enabled)
- No database schema changes
- No protocol changes (already specified in protocol freeze)

**Mitigation:**
- Test with ESP32 device
- Test with web client
- Monitor backend logs for registration errors

---

## SUMMARY

### Canonical Registration Architecture

**ESP32 Devices:** MODEL A - WebSocket Self-Registration
**Web Clients:** MODEL B - REST API Pre-Registration

### Evidence Supporting Recommendation

1. **Firmware Architecture:** Specifies automatic WebSocket registration
2. **Protocol Freeze:** Defines device.register schema without REST API requirement
3. **Pre-Flashed Deployment:** No UI for REST API registration
4. **Phase A Goals:** Device registration objective enabled by MODEL A
5. **Worker Identity:** Worker name provided in AP mode, sent in device.register

### Components Requiring Alignment

1. **Backend WebSocket Handler:** Auto-register ESP32 devices on first device.register
2. **Firmware:** Include workerName and walletAddress in device.register payload

### Migration Impact

- **Web Clients:** No impact (MODEL B preserved)
- **ESP32 Devices:** Positive impact (MODEL A enabled)
- **Backend:** Minimal impact (additive change)
- **Firmware:** Minimal impact (payload enhancement)
- **Risk Level:** Low

---

**Status:** RECOMMENDATION ONLY - NO CODE CHANGES APPLIED
