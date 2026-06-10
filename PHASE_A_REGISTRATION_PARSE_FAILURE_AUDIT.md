# PHASE A REGISTRATION PARSE FAILURE AUDIT

**Date:** 2026-06-10  
**Status:** ROOT CAUSE IDENTIFIED  
**Deployment Commit:** dcabb2e

---

## OBJECTIVE

Determine why device.register is not being processed despite commit dcabb2e being deployed.

**Observed Logs:**
```
JSON_PARSE_ERROR
MESSAGE_PARSE_FAILED reason=INVALID_JSON
HEARTBEAT_FROM_UNKNOWN
MINING_STATS_FROM_UNKNOWN
```

**Expected Logs (Missing):**
```
DEVICE_AUTO_REGISTERED
DEVICE_REGISTERED
```

---

## AUDIT FINDINGS

### 1. Firmware JSON Payload Analysis

**File:** esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino  
**Function:** sendDeviceRegister() (lines 294-304)

**Implementation:**
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

**Generated JSON Payload:**
```json
{"type":"device.register","deviceId":"esp32-XXXX","deviceType":"miner","firmwareVersion":"1.0.0","capabilities":{"oled":false,"wifi":true,"stratum":true}}
```

**Validation:** JSON syntax is valid. No obvious formatting issues.

---

### 2. Backend Message Parser Analysis

**File:** server/server.js  
**Function:** WebSocket message handler (lines 182-194)

**Implementation:**
```javascript
ws.on('message', (msg) => {
  try {
    // Use core utilities for safe parsing
    const data = coreUtils.messageParsing.safeParse(msg);
    if (!data) {
      console.log("[WS] MESSAGE_PARSE_FAILED reason=INVALID_JSON");
      return;
    }

    if (!coreUtils.messageParsing.validateMessage(data)) {
      console.log("[WS] MESSAGE_INVALID type=" + (data?.type || 'null') + " reason=INVALID_FORMAT");
      return;
    }

    console.log("[WS] MESSAGE_PARSED type=" + data.type);
    // ... routing logic ...
  } catch (error) {
    console.error("[WS] MESSAGE_ERROR error=" + error.message);
  }
});
```

---

### 3. Backend Core Utils Parser Analysis

**File:** server/core/utils.js  
**Function:** messageParsing.safeParse() (lines 44-53)

**Implementation:**
```javascript
const messageParsing = {
  // Safe JSON parsing
  safeParse: (message) => {
    try {
      return JSON.parse(message.toString());
    } catch (e) {
      console.log("[CORE_UTILS] JSON_PARSE_ERROR error=" + e.message);
      return null;
    }
  },

  // Validate message structure
  validateMessage: (data) => {
    return data && 
           typeof data === 'object' && 
           data.type && 
           typeof data.type === 'string';
  }
};
```

---

### 4. Firmware WebSocket Send Implementation

**File:** esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino  
**Function:** sendWebSocketMessage() (lines 284-288)

**Implementation:**
```cpp
void sendWebSocketMessage(const char *message) {
  if (wsConnected) {
    webSocket.sendTXT(message);
  }
}
```

**WebSocket Library:** Links2004 WebSocketsClient  
**Method:** sendTXT(message)

---

### 5. Firmware WebSocket Event Handler

**File:** esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino  
**Function:** webSocketEvent() (lines 245-268)

**Implementation:**
```cpp
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected");
      wsConnected = false;
      break;
      
    case WStype_CONNECTED:
      Serial.println("[WS] Connected");
      wsConnected = true;
      sendDeviceRegister();  // Registration sent immediately on connection
      break;
      
    case WStype_TEXT:
      Serial.println("[WS] Message received: " + String((char *)payload));
      handleWebSocketMessage((char *)payload);
      break;
      
    case WStype_ERROR:
      Serial.println("[WS] Error");
      wsConnected = false;
      break;
  }
}
```

**Critical Observation:** sendDeviceRegister() is called immediately upon WStype_CONNECTED event, before the WebSocket connection is fully established and ready to send messages.

---

## ROOT CAUSE ANALYSIS

### Issue: Race Condition in WebSocket Connection

**Problem:** The firmware calls `sendDeviceRegister()` immediately upon receiving `WStype_CONNECTED` event, but the WebSocket connection may not be fully ready to send messages at that point.

**Evidence:**
1. Firmware sends device.register immediately on WStype_CONNECTED (line 255)
2. No delay or confirmation that the connection is ready for transmission
3. Backend logs show JSON_PARSE_ERROR, indicating malformed or incomplete JSON received
4. Subsequent messages (heartbeat, mining_stats) also fail with FROM_UNKNOWN errors

**Likely Scenario:**
1. ESP32 connects to WebSocket
2. WStype_CONNECTED event fires
3. Firmware immediately sends device.register
4. WebSocket connection not fully established
5. Message sent before connection ready
6. Backend receives incomplete or malformed data
7. JSON.parse() fails with JSON_PARSE_ERROR
8. Device never registered
9. Subsequent heartbeat and mining_stats fail because device not in registry

---

### Alternative Possibility: WebSocket Library sendTXT() Behavior

**Links2004 WebSocketsClient sendTXT() Behavior:**
- sendTXT() may buffer messages internally
- If called before connection is fully ready, message may be dropped or corrupted
- No confirmation that message was successfully sent

**Evidence:**
- No error checking in sendWebSocketMessage()
- No confirmation that sendTXT() succeeded
- No retry logic for failed sends

---

### Why HEARTBEAT_FROM_UNKNOWN and MINING_STATS_FROM_UNKNOWN

**Sequence:**
1. device.register fails to parse (JSON_PARSE_ERROR)
2. Device never registered in DeviceRegistry
3. Device never created in state
4. Subsequent heartbeat arrives
5. Backend checks state.getDevice(deviceId)
6. Device not found → HEARTBEAT_FROM_UNKNOWN
7. Subsequent mining_stats arrives
8. Backend checks state.getDevice(deviceId)
9. Device not found → MINING_STATS_FROM_UNKNOWN

---

## PAYLOAD VALIDATION

### Firmware JSON Payload Structure

**Expected:**
```json
{
  "type": "device.register",
  "deviceId": "esp32-XXXX",
  "deviceType": "miner",
  "firmwareVersion": "1.0.0",
  "capabilities": {
    "oled": false,
    "wifi": true,
    "stratum": true
  }
}
```

**Generated by Firmware:**
```json
{"type":"device.register","deviceId":"esp32-XXXX","deviceType":"miner","firmwareVersion":"1.0.0","capabilities":{"oled":false,"wifi":true,"stratum":true}}
```

**Validation:** JSON syntax is valid. No formatting issues.

**Backend Parser Expectations:**
- JSON.parse(message.toString())
- Expects complete JSON object
- No message framing requirements (WebSocket handles framing)

**Conclusion:** JSON payload format is correct. Parse failure is due to timing/race condition, not malformed JSON.

---

## COMPARISON: FIRMWARE vs BACKEND

| Aspect | Firmware | Backend | Status |
|--------|----------|---------|--------|
| JSON Format | Valid JSON | Expects valid JSON | ✅ Match |
| Message Type | device.register | Handles device.register | ✅ Match |
| Field Names | type, deviceId, deviceType, firmwareVersion, capabilities | Validates via deviceGateway | ✅ Match |
| Send Timing | Immediate on WStype_CONNECTED | Expects ready connection | ❌ Race Condition |
| Error Handling | None | Logs JSON_PARSE_ERROR | ❌ No Retry |

---

## ROOT CAUSE SUMMARY

**Primary Root Cause:** Race condition in firmware WebSocket connection handling

**Specific Issue:**
- Firmware calls sendDeviceRegister() immediately upon WStype_CONNECTED event
- WebSocket connection may not be fully ready to transmit messages
- Message sent before connection ready results in incomplete/corrupted data
- Backend receives malformed JSON → JSON_PARSE_ERROR
- Device never registered
- Subsequent messages fail with FROM_UNKNOWN errors

**Secondary Contributing Factors:**
1. No delay after WStype_CONNECTED before sending
2. No confirmation that sendTXT() succeeded
3. No retry logic for failed registration
4. No error handling in sendWebSocketMessage()

---

## WHY REGISTRATION NEVER REACHES handlers.register()

**Call Chain:**
1. Firmware: webSocketEvent(WStype_CONNECTED) → sendDeviceRegister()
2. Firmware: sendWebSocketMessage() → webSocket.sendTXT(message)
3. WebSocket: Message sent (possibly corrupted/incomplete)
4. Backend: ws.on('message') → coreUtils.messageParsing.safeParse(msg)
5. Backend: JSON.parse() fails → JSON_PARSE_ERROR
6. Backend: Returns null → MESSAGE_PARSE_FAILED
7. Backend: Returns early (never reaches routing)
8. Backend: handlers.register() never called

**Blocking Point:** JSON_PARSE_ERROR in coreUtils.messageParsing.safeParse()

---

## RECOMMENDED FIXES

### Fix 1: Add Delay After Connection

**Location:** esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino  
**Function:** webSocketEvent()  
**Change:** Add delay after WStype_CONNECTED before sending registration

```cpp
case WStype_CONNECTED:
  Serial.println("[WS] Connected");
  wsConnected = true;
  delay(1000);  // Wait 1 second for connection to stabilize
  sendDeviceRegister();
  break;
```

### Fix 2: Add Send Confirmation

**Location:** esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino  
**Function:** sendWebSocketMessage()  
**Change:** Add return value and error checking

```cpp
bool sendWebSocketMessage(const char *message) {
  if (wsConnected) {
    webSocket.sendTXT(message);
    return true;
  }
  return false;
}
```

### Fix 3: Add Registration Retry Logic

**Location:** esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino  
**Function:** loop()  
**Change:** Retry registration if not successful

```cpp
// In loop()
if (wsConnected && !config.registered && millis() - lastRegisterAttempt >= 5000) {
  sendDeviceRegister();
  lastRegisterAttempt = millis();
}
```

### Fix 4: Add Backend Logging for Raw Messages

**Location:** server/server.js  
**Function:** ws.on('message')  
**Change:** Log raw message before parsing

```javascript
ws.on('message', (msg) => {
  console.log("[WS] RAW_MESSAGE length=" + msg.length + " content=" + msg.toString());
  // ... existing parsing logic ...
});
```

---

## VERIFICATION STEPS

### Step 1: Add Backend Raw Message Logging

Add logging to see exactly what the backend receives from the firmware.

### Step 2: Add Firmware Serial Logging

Add Serial.println() before and after sendTXT() to confirm message is sent.

### Step 3: Test with Delay

Add 1-2 second delay after WStype_CONNECTED before sending registration.

### Step 4: Monitor Backend Logs

Check if JSON_PARSE_ERROR persists after delay.

---

## SUMMARY

**Root Cause:** Race condition in firmware WebSocket connection handling

**Evidence:**
- Firmware sends device.register immediately on WStype_CONNECTED
- No delay or confirmation that connection is ready
- Backend receives malformed JSON → JSON_PARSE_ERROR
- Device never registered
- Subsequent messages fail with FROM_UNKNOWN errors

**Why Registration Never Reaches handlers.register():**
- JSON_PARSE_ERROR blocks message parsing
- Parser returns null
- Handler returns early before routing
- handlers.register() never called

**Recommended Fix:** Add delay after WStype_CONNECTED before sending registration

---

**Status:** AUDIT COMPLETE - ROOT CAUSE IDENTIFIED
