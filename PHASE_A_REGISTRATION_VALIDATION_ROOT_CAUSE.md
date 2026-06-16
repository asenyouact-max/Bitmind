# PHASE A REGISTRATION VALIDATION ROOT CAUSE

**Date:** 2026-06-14  
**Status:** ROOT CAUSE IDENTIFIED  
**Type:** Validation Mismatch

---

## EVIDENCE

### Backend Logs
```
[WS] RAW_MESSAGE seq=1 time_since_connect_ms=682 length=154 content={"type":"device.register","deviceId":"esp32-1F84","deviceType":"miner","firmwareVersion":"1.0.0","capabilities":{"oled":false,"wifi":true,"stratum":true}}

[WS] MESSAGE_PARSED type=device.register
[WS] MESSAGE_ROUTED type=device.register handler=register
[WS] REGISTER_FAILED deviceId=esp32-1F84 reason=Invalid device ID format
```

### ESP Serial Logs
```
[TRACE] SEND_DEVICE_REGISTER_ENTERED
[TRACE] BUILDING_REGISTER_PAYLOAD
[TRACE] REGISTER_PAYLOAD_READY length=154
[PROTO] Sending device.register
[WS] SEND_ATTEMPT payload_length=154
[WS] SEND_ATTEMPT wsConnected_before=true
[WS] SEND_RESULT sendTXT_return=true
[WS] SEND_RESULT wsConnected_after=true
[TRACE] REGISTER_SEND_FUNCTION_RETURNED
```

---

## ROOT CAUSE

**Device ID format mismatch between firmware generation and backend validation**

---

## EXACT FILE, FUNCTION, LINE

### Backend Validation
**File:** server/gateway/deviceGateway.js  
**Function:** validateRegistration()  
**Line:** 232

**Code:**
```javascript
if (!payload.deviceId || !/^esp32-[a-f0-9]{4,12}$/.test(payload.deviceId)) {
  return { valid: false, error: 'Invalid device ID format' };
}
```

**Regex Pattern:** `/^esp32-[a-f0-9]{4,12}$/`  
**Requirements:**
- Prefix: "esp32-"
- Hex characters: 4-12 characters
- Case: lowercase only (a-f, 0-9)

---

### Firmware Generation
**File:** esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino  
**Function:** generateDeviceId()  
**Line:** 114

**Code:**
```cpp
sprintf(deviceIdStr, "esp32-%04X", (uint16_t)(chipid & 0xFFFF));
```

**Format Specifier:** `%04X`  
**Output:**
- Prefix: "esp32-"
- Hex characters: 4 characters
- Case: uppercase (A-F, 0-9)
- Example: "esp32-1F84"

---

## VALIDATION RULE REJECTING esp32-1F84

**Regex:** `/^esp32-[a-f0-9]{4,12}$/`

**Test Case:** "esp32-1F84"
- Prefix: "esp32-" ✅ matches
- Length: 4 characters ✅ matches (within 4-12 range)
- Case: "1F84" ❌ FAILS (contains uppercase 'F')

**Result:** Regex test returns false → validation fails → REGISTER_FAILED

---

## MODEL A ESP32 SELF-REGISTRATION ARCHITECTURE CONFLICT

**MODEL A Architecture:** ESP32 devices auto-register on first WebSocket connection without REST API pre-registration.

**Backend Handler (server/ws/handlers.js lines 84-92):**
```javascript
// MODEL A: ESP32 devices auto-register on first connection
if (!isRegistered && isEsp32Device) {
  console.log("[WS] DEVICE_AUTO_REGISTERED deviceId=" + deviceId + " reason=ESP32_SELF_REGISTRATION");
  DeviceRegistry.register(deviceId, { 
    deviceType: data.deviceType || 'miner',
    workerName: data.workerName,
    walletAddress: data.walletAddress
  });
}
```

**Conflict:** The deviceGateway.validateRegistration() call (line 64) occurs BEFORE the MODEL A auto-registration logic (line 85). This means ESP32 devices must pass deviceGateway validation before reaching the auto-registration code path.

**Impact:** The validation rejects ESP32 devices with uppercase hex device IDs, preventing them from reaching the MODEL A auto-registration logic.

---

## FIRMWARE VS BACKEND INCONSISTENCY

| Aspect | Firmware | Backend | Status |
|--------|----------|---------|--------|
| Prefix | "esp32-" | "esp32-" | ✅ Match |
| Hex Length | 4 characters | 4-12 characters | ✅ Match |
| Hex Case | Uppercase (%04X) | Lowercase ([a-f0-9]) | ❌ MISMATCH |
| Example | "esp32-1F84" | "esp32-1f84" | ❌ MISMATCH |

---

## EXACT FAILURE POINT

**File:** server/ws/handlers.js  
**Function:** register()  
**Line:** 64-70

**Code:**
```javascript
// Phase D: Validate registration using deviceGateway
const validation = deviceGateway.validateRegistration(data);
if (!validation.valid) {
  console.log("[WS] REGISTER_FAILED deviceId=" + (deviceId || 'null') + " reason=" + validation.error);
  const errorMsg = deviceGateway.createDeviceError('PAYLOAD_INVALID', validation.error);
  ws.send(JSON.stringify(errorMsg));
  return false;
}
```

**Execution Flow:**
1. device.register message arrives ✅
2. JSON parsing succeeds ✅
3. Message routing succeeds ✅
4. Handler executes ✅
5. deviceGateway.validateRegistration() called ✅
6. Regex test fails ❌ (uppercase hex)
7. REGISTER_FAILED logged ❌
8. Auto-registration logic never reached ❌

---

## MINIMAL FIX OPTIONS

### Option 1: Change Firmware to Lowercase
**File:** esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino  
**Line:** 114

**Change:**
```cpp
// From:
sprintf(deviceIdStr, "esp32-%04X", (uint16_t)(chipid & 0xFFFF));

// To:
sprintf(deviceIdStr, "esp32-%04x", (uint16_t)(chipid & 0xFFFF));
```

**Result:** "esp32-1f84" (lowercase)

### Option 2: Change Backend to Accept Uppercase
**File:** server/gateway/deviceGateway.js  
**Line:** 232

**Change:**
```javascript
// From:
if (!payload.deviceId || !/^esp32-[a-f0-9]{4,12}$/.test(payload.deviceId)) {

// To:
if (!payload.deviceId || !/^esp32-[a-fA-F0-9]{4,12}$/.test(payload.deviceId)) {
```

**Result:** Accepts both "esp32-1F84" and "esp32-1f84"

---

## RECOMMENDATION

**Option 1 (Change Firmware):** Preferred for consistency with backend specification and protocol documentation.

**Rationale:**
- Backend validation is the authoritative source of truth
- Protocol specification likely defines lowercase hex
- Changing firmware aligns with backend expectations
- No risk of accepting invalid device IDs from other sources

---

## STATUS

**Root Cause Identified:** Device ID case mismatch (firmware uppercase, backend lowercase)  
**Exact Location:** server/gateway/deviceGateway.js line 232, esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino line 114  
**MODEL A Conflict:** Yes - validation occurs before auto-registration logic  
**Consistency:** No - firmware and backend have mismatched hex case requirements

**Status:** ROOT CAUSE AUDIT COMPLETE
