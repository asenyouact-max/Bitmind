# BITMIND F5 TOKEN LIFECYCLE AUDIT

**Phase:** F5 - Onboarding Alignment Implementation  
**Date:** 2026-06-21  
**Status:** TOKEN LIFECYCLE AUDIT  
**Purpose:** Audit token lifecycle implementation before firmware registration modification

---

## EXECUTIVE SUMMARY

**Audit Result:** ❌ CRITICAL ISSUE FOUND

**Key Finding:** Backend generates NEW token on EVERY WebSocket connection, violating F4 architecture (backend owns token, generated once per device identity)

**Impact:** HIGH
- Token is not stable across reconnections
- Token changes on every WebSocket connection
- DeviceRegistry preserves token correctly, but handlers.js overwrites it
- Firmware stores token correctly, but receives new token on each connection

**Required Fix:** Modify handlers.js to use token from DeviceRegistry instead of generating new token

---

## SECTION 1: TOKEN GENERATION AUDIT

### 1.1 Backend Token Generation

**Location:** `server/ws/handlers.js` line 196

**Current Implementation:**
```javascript
// Phase D: Send protocol-compliant registration response
const token = crypto.randomBytes(16).toString('hex');
const regResponse = deviceGateway.createRegistrationResponse(deviceId, token);
ws.send(JSON.stringify(regResponse));
```

**Issue:** ❌ CRITICAL
- Generates NEW token on EVERY WebSocket connection
- Does NOT use token from DeviceRegistry
- Overwrites stable token from DeviceRegistry

**Expected Behavior:** ✅ SHOULD BE
- Use token from DeviceRegistry
- Generate token only on first registration
- Preserve token across reconnections

---

### 1.2 DeviceRegistry Token Generation

**Location:** `server/services/deviceRegistry.js` line 16

**Current Implementation:**
```javascript
const createRegistration = (deviceId, metadata = {}) => ({
  deviceId,
  registeredAt: Date.now(),
  status: 'registered',
  token: metadata.token || crypto.randomBytes(32).toString('hex'), // Future-proof for ESP32 auth
  metadata: {
    deviceType: metadata.deviceType || 'unknown',
    walletAddress: metadata.walletAddress || null,
    workerName: metadata.workerName || null,
    ...metadata
  }
});
```

**Issue:** ✅ CORRECT
- Generates token on first registration (if not provided)
- Preserves token on subsequent updates (line 49: `existing.metadata = { ...existing.metadata, ...metadata }`)
- Token is stable across device updates

---

### 1.3 Verification: Token Generated Only Once Per Device Identity

**Current State:** ❌ FAILS
- DeviceRegistry generates token once (correct)
- handlers.js generates new token on every connection (incorrect)
- Token is not stable across reconnections

**Required Fix:** Modify handlers.js to use token from DeviceRegistry

---

## SECTION 2: TOKEN SURVIVES REBOOT AUDIT

### 2.1 Firmware Token Storage

**Location:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`

**Token Save (line 389-391):**
```cpp
void handleDeviceRegistered(const String& message) {
  Serial.println("[PROTO] Received device.registered");
  
  // Extract token (simplified parsing)
  int tokenStart = message.indexOf("\"token\":\"") + 9;
  int tokenEnd = message.indexOf("\"", tokenStart);
  if (tokenStart > 8 && tokenEnd > tokenStart) {
    config.token = message.substring(tokenStart, tokenEnd);
    config.registered = true;
    saveConfiguration();
    Serial.println("[PROTO] Token saved: " + config.token);
  }
}
```

**Token Load (line 133):**
```cpp
config.token = preferences.getString("token", "");
```

**Issue:** ✅ CORRECT
- Firmware saves token to Preferences NV storage
- Firmware loads token from Preferences on boot
- Token survives reboot

---

### 2.2 Verification: Token Survives Reboot

**Current State:** ✅ PASSES
- Firmware stores token in Preferences NV storage
- Firmware loads token on boot
- Token survives reboot

**Note:** Token changes on WebSocket reconnection due to handlers.js issue, but survives device reboot

---

## SECTION 3: TOKEN SURVIVES NORMAL RECONNECT AUDIT

### 3.1 Backend Token Handling on Reconnect

**Location:** `server/ws/handlers.js` lines 194-198

**Current Implementation:**
```javascript
try {
  // Phase D: Send protocol-compliant registration response
  const token = crypto.randomBytes(16).toString('hex');
  const regResponse = deviceGateway.createRegistrationResponse(deviceId, token);
  ws.send(JSON.stringify(regResponse));
```

**Issue:** ❌ CRITICAL
- Generates NEW token on every WebSocket connection
- Does NOT check if device is already registered
- Does NOT use existing token from DeviceRegistry

**Expected Behavior:** ✅ SHOULD BE
```javascript
try {
  // Get token from DeviceRegistry (preserve existing token)
  const registration = DeviceRegistry.getRegistration(deviceId);
  const token = registration ? registration.token : crypto.randomBytes(16).toString('hex');
  const regResponse = deviceGateway.createRegistrationResponse(deviceId, token);
  ws.send(JSON.stringify(regResponse));
```

---

### 3.2 DeviceRegistry Token Preservation

**Location:** `server/services/deviceRegistry.js` lines 40-51

**Current Implementation:**
```javascript
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
```

**Issue:** ✅ CORRECT
- DeviceRegistry preserves token on updates
- Token is not overwritten in DeviceRegistry
- Token is stable in DeviceRegistry

---

### 3.3 Verification: Token Survives Normal Reconnect

**Current State:** ❌ FAILS
- DeviceRegistry preserves token correctly
- handlers.js generates new token on every connection
- Firmware receives new token on every connection
- Token does NOT survive normal reconnect

**Required Fix:** Modify handlers.js to use token from DeviceRegistry

---

## SECTION 4: FACTORY RESET CLEARS TOKEN AUDIT

### 4.1 Factory Reset Implementation

**Search Results:** No factory reset implementation found in firmware

**Issue:** ❌ GAP
- No factory reset function found
- No clear token mechanism
- No documented factory reset procedure

**Expected Behavior:** ✅ SHOULD BE
- Factory reset should clear all Preferences
- Factory reset should clear token
- Factory reset should clear WiFi credentials
- Factory reset should clear workerName and walletAddress

---

### 4.2 Verification: Factory Reset Clears Token

**Current State:** ❌ CANNOT VERIFY
- No factory reset implementation found
- Cannot verify if factory reset clears token

**Required Implementation:** Add factory reset function to firmware

---

## SECTION 5: EXISTING REGISTERED DEVICES COMPATIBILITY AUDIT

### 5.1 Backend Compatibility

**DeviceRegistry:** ✅ COMPATIBLE
- DeviceRegistry preserves token on updates
- Existing devices continue to work
- No breaking changes to DeviceRegistry

**handlers.js:** ⚠️ PARTIALLY COMPATIBLE
- Existing devices receive new token on each connection
- Existing devices continue to work (token not validated)
- No breaking changes, but token instability

---

### 5.2 Firmware Compatibility

**Current Firmware:** ✅ COMPATIBLE
- Firmware accepts any token from backend
- Firmware does not validate token
- Firmware stores token regardless of value
- Existing devices continue to work

**Modified Firmware (with workerName/walletAddress):** ✅ COMPATIBLE
- New fields are optional in backend validation
- Backend accepts old firmware without new fields
- No breaking changes

---

### 5.3 Verification: Existing Registered Devices Remain Compatible

**Current State:** ✅ PASSES
- Existing devices continue to work
- No breaking changes
- Token instability does not prevent operation

**Note:** Token instability is a functional issue, not a compatibility issue

---

## SECTION 6: CRITICAL ISSUES SUMMARY

### 6.1 Issue 1: Token Generated on Every Connection (CRITICAL)

**Location:** `server/ws/handlers.js` line 196

**Current Code:**
```javascript
const token = crypto.randomBytes(16).toString('hex');
```

**Issue:** Generates new token on every WebSocket connection

**Impact:** HIGH
- Token is not stable across reconnections
- Violates F4 architecture (backend owns token, generated once)
- DeviceRegistry preserves token correctly, but handlers.js overwrites it

**Required Fix:**
```javascript
// Get token from DeviceRegistry (preserve existing token)
const registration = DeviceRegistry.getRegistration(deviceId);
const token = registration ? registration.token : crypto.randomBytes(16).toString('hex');
```

---

### 6.2 Issue 2: No Factory Reset Implementation (MEDIUM)

**Location:** Firmware (not implemented)

**Issue:** No factory reset function to clear token

**Impact:** MEDIUM
- Users cannot clear token without manual intervention
- No documented factory reset procedure
- Cannot verify if factory reset clears token

**Required Implementation:** Add factory reset function to firmware

---

## SECTION 7: RECOMMENDED FIXES

### 7.1 Fix 1: Use Token from DeviceRegistry (CRITICAL)

**File:** `server/ws/handlers.js`

**Line:** 196

**Current Code:**
```javascript
const token = crypto.randomBytes(16).toString('hex');
```

**New Code:**
```javascript
// Get token from DeviceRegistry (preserve existing token)
const registration = DeviceRegistry.getRegistration(deviceId);
const token = registration ? registration.token : crypto.randomBytes(16).toString('hex');
```

**Impact:** HIGH
- Token becomes stable across reconnections
- Aligns with F4 architecture
- DeviceRegistry becomes single source of truth for token

---

### 7.2 Fix 2: Add Factory Reset Function (MEDIUM)

**File:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`

**New Function:**
```cpp
void factoryReset() {
  Serial.println("[FACTORY_RESET] Clearing configuration...");
  
  preferences.begin("bitmind", false);
  preferences.clear();
  preferences.end();
  
  Serial.println("[FACTORY_RESET] Configuration cleared");
  Serial.println("[FACTORY_RESET] Rebooting...");
  
  delay(1000);
  ESP.restart();
}
```

**Trigger:** Add factory reset trigger (e.g., button press, AP mode timeout, special command)

**Impact:** MEDIUM
- Users can clear token and configuration
- Enables device reassignment
- Improves user experience

---

## SECTION 8: UPDATED IMPLEMENTATION PLAN

### 8.1 Priority Update

**Priority 0 (CRITICAL - NEW):**
- Backend: Use token from DeviceRegistry instead of generating new token

**Priority 1 (CRITICAL):**
- Firmware: Add workerName and walletAddress to device.register payload

**Priority 2 (HIGH):**
- Backend: Add virtual- prefix to virtual device IDs
- Backend: Set deviceType to 'virtual_client'
- Backend: Add virtual- prefix check in handlers.js

**Priority 3 (MEDIUM):**
- Firmware: Add factory reset function

**Priority 4 (LOW):**
- Frontend: Rename "Connect Miner" to "Add Virtual Device"

---

### 8.2 Updated Files to Modify

**File:** `server/ws/handlers.js`
- **Line 196:** Use token from DeviceRegistry
- **Change Type:** CRITICAL
- **Impact:** HIGH

**File:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`
- **Lines 308-313:** Add workerName and walletAddress to device.register
- **Change Type:** CRITICAL
- **Impact:** HIGH
- **New Function:** Add factory reset function
- **Change Type:** MEDIUM
- **Impact:** MEDIUM

**File:** `server/api/routes.js`
- **Line 547:** Add virtual- prefix to device IDs
- **Line 551:** Set deviceType to 'virtual_client'
- **Change Type:** MINOR
- **Impact:** MEDIUM

**File:** `server/ws/handlers.js`
- **Line 149:** Add isVirtualDevice check
- **Line 170:** Add MODEL B rejection logic
- **Change Type:** MINOR
- **Impact:** MEDIUM

---

## SECTION 9: VERIFICATION SUMMARY

| Requirement | Status | Evidence |
|-------------|--------|----------|
| Token generated only once per device identity | ❌ FAILS | handlers.js generates new token on every connection |
| Token survives reboot | ✅ PASSES | Firmware stores token in Preferences NV storage |
| Token survives normal reconnect | ❌ FAILS | handlers.js generates new token on every connection |
| Factory reset clears token | ❌ CANNOT VERIFY | No factory reset implementation found |
| Existing registered devices remain compatible | ✅ PASSES | No breaking changes, devices continue to work |

---

## SECTION 10: RISK ASSESSMENT

### 10.1 Token Instability Risk

**Risk:** Token changes on every WebSocket connection

**Impact:** MEDIUM
- Token is not used for authentication (not validated)
- Token is only stored in firmware
- Token instability does not prevent operation
- Token instability is a functional issue, not a security issue

**Mitigation:** Fix handlers.js to use token from DeviceRegistry

**Urgency:** HIGH (violates F4 architecture)

---

### 10.2 Factory Reset Gap Risk

**Risk:** No factory reset implementation

**Impact:** LOW
- Users can manually clear Preferences via Arduino IDE
- No critical functionality blocked
- Device reassignment possible via manual intervention

**Mitigation:** Add factory reset function to firmware

**Urgency:** MEDIUM (user experience improvement)

---

## CONCLUSION

**Audit Result:** ❌ CRITICAL ISSUE FOUND

**Required Action:** MUST FIX token generation in handlers.js before proceeding with firmware registration modification

**Updated Implementation Plan:**
1. **Priority 0 (CRITICAL):** Fix handlers.js to use token from DeviceRegistry
2. **Priority 1 (CRITICAL):** Add workerName and walletAddress to device.register
3. **Priority 2 (HIGH):** Backend virtual device changes
4. **Priority 3 (MEDIUM):** Add factory reset function
5. **Priority 4 (LOW):** Frontend UI changes

**Recommendation:** DO NOT PROCEED with firmware registration modification until token lifecycle issue is fixed

**Status:** BLOCKED - Token lifecycle issue must be resolved first
