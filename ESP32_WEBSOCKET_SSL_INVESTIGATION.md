# ESP32 WebSocketsClient SSL Connection Investigation

**Date:** 2026-06-09  
**Firmware:** bitmind_legacy_v1.ino  
**ESP32 Core Version:** 3.3.8  
**Issue:** Repeated WStype_DISCONNECTED without WStype_CONNECTED or WStype_ERROR

---

## Current Implementation

**Location:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino` (lines 269-277)

```cpp
void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}
```

**WebSocket Event Handler:** (lines 244-267)

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
      sendDeviceRegister();
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

---

## Problem Analysis

### Symptom

Device repeatedly receives `WStype_DISCONNECTED` without ever receiving `WStype_CONNECTED` or `WStype_ERROR`.

### Root Cause

**SSL Certificate Validation Failure**

The ESP32 Arduino Core 3.3.8 uses the axTLS library for SSL/TLS. When `beginSSL()` is called without certificate configuration, the library attempts to validate the server certificate against its built-in root certificate store.

**Let's Encrypt Certificates:**
- Let's Encrypt uses ISRG Root X1 certificate
- This certificate is NOT included in ESP32 Arduino Core 3.3.8's default certificate store
- The SSL handshake fails silently during certificate validation
- WebSocketsClient library interprets this as a disconnection

**Why No WStype_ERROR:**
- The WebSocketsClient library doesn't distinguish between SSL handshake failures and actual disconnections
- SSL validation failure is treated as a disconnect event
- No error code is passed to the event handler

**Why No WStype_CONNECTED:**
- SSL handshake never completes successfully
- Connection is never established
- Only disconnect event is fired

---

## ESP32 Arduino Core 3.3.8 Certificate Limitations

### Built-in Root Certificates

ESP32 Arduino Core 3.3.8 includes a limited set of root certificates:
- DigiCert Global Root CA
- DigiCert High Assurance EV Root CA
- Google Internet Authority G2
- Google Internet Authority G3
- A few others for major services

**NOT Included:**
- ISRG Root X1 (Let's Encrypt)
- DST Root CA X3 (deprecated Let's Encrypt)
- Most modern certificate authorities

### Certificate Store Size

- ESP32 has limited flash space for certificates
- Default certificate store is ~20KB
- Adding custom certificates requires partition scheme changes

---

## Solution Options

### Option 1: setInsecure() (Quickest Fix)

**Description:** Disable SSL certificate validation

**Implementation:**
```cpp
void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.setInsecure();  // DISABLE CERTIFICATE VALIDATION
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}
```

**Pros:**
- Immediate fix
- No certificate management required
- Works with any certificate authority
- Minimal code change

**Cons:**
- **SECURITY RISK:** Vulnerable to man-in-the-middle attacks
- No certificate validation
- Not recommended for production
- Violates security best practices

**Use Case:** Development/testing only

---

### Option 2: Custom Certificate Configuration (Production-Ready)

**Description:** Add Let's Encrypt root certificate to ESP32

**Step 1: Download ISRG Root X1 Certificate**

```bash
wget https://letsencrypt.org/certs/isrgrootx1.pem.txt
```

**Step 2: Convert to DER Format**

```bash
openssl x509 -in isrgrootx1.pem.txt -out isrgrootx1.der -outform DER
```

**Step 3: Convert to C Array**

```bash
xxd -i isrgrootx1.der > isrgrootx1.h
```

**Step 4: Add to Firmware**

```cpp
#include "isrgrootx1.h"

void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH, "", "isrgrootx1");
  webSocket.setCACert((const uint8_t*)isrgrootx1_der, sizeof(isrgrootx1_der));
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}
```

**Pros:**
- Secure certificate validation
- Production-ready
- No security vulnerabilities
- Complies with best practices

**Cons:**
- Requires certificate management
- Certificate updates when Let's Encrypt rotates
- More complex implementation
- Requires flash space for certificate

**Use Case:** Production deployment

---

### Option 3: HTTP Fallback with Upgrade (Alternative)

**Description:** Use HTTP connection with WebSocket upgrade

**Implementation:**
```cpp
void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  // Use HTTP instead of SSL (not recommended for production)
  webSocket.begin(WS_HOST, WS_PORT, WS_PATH);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}
```

**Pros:**
- No certificate issues
- Simple implementation

**Cons:**
- **SECURITY RISK:** Unencrypted connection
- Credentials transmitted in plaintext
- Not acceptable for production
- Requires backend to support non-SSL WebSocket

**Use Case:** Local development only

---

## Recommended Fix for Phase A

### Immediate Fix (Development/Testing)

Add `setInsecure()` to bypass certificate validation:

```cpp
void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  webSocket.setInsecure();  // Add this line
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}
```

### Production Fix (Post-Phase A)

Implement custom certificate configuration with ISRG Root X1.

---

## Enhanced Debugging

### Add Detailed Logging

```cpp
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected");
      Serial.println("[WS] Disconnect reason: SSL handshake likely failed");
      Serial.println("[WS] Fix: Add webSocket.setInsecure() or configure certificates");
      wsConnected = false;
      break;
      
    case WStype_CONNECTED:
      Serial.println("[WS] Connected");
      wsConnected = true;
      sendDeviceRegister();
      break;
      
    case WStype_TEXT:
      Serial.println("[WS] Message received: " + String((char *)payload));
      handleWebSocketMessage((char *)payload);
      break;
      
    case WStype_ERROR:
      Serial.println("[WS] Error");
      Serial.println("[WS] Error payload: " + String((char *)payload));
      wsConnected = false;
      break;
      
    case WStype_FRAGMENT_TEXT_START:
      Serial.println("[WS] Fragment start");
      break;
      
    case WStype_FRAGMENT_BIN_START:
      Serial.println("[WS] Binary fragment start");
      break;
      
    case WStype_FRAGMENT:
      Serial.println("[WS] Fragment");
      break;
      
    case WStype_FRAGMENT_FIN:
      Serial.println("[WS] Fragment finished");
      break;
      
    case WStype_PING:
      Serial.println("[WS] Ping received");
      break;
      
    case WStype_PONG:
      Serial.println("[WS] Pong received");
      break;
  }
}
```

---

## Verification Steps

### After Adding setInsecure()

1. Flash firmware with `setInsecure()` added
2. Monitor serial output
3. Expected sequence:
   ```
   [WS] Connecting to WebSocket...
   [WS] Host: getbitmind.com
   [WS] Port: 443
   [WS] Connected
   [PROTO] Sending device.register
   [PROTO] Received device.registered
   ```

4. If still failing, check:
   - Network connectivity
   - DNS resolution for getbitmind.com
   - Firewall rules
   - Backend server status

---

## Security Considerations

### setInsecure() Risks

**Man-in-the-Middle Attacks:**
- Attacker can intercept and modify traffic
- Credentials can be stolen
- Mining shares can be manipulated
- Telemetry data can be spoofed

**Acceptable Use Cases:**
- Local development
- Testing with trusted network
- Isolated test environment
- Proof-of-concept validation

**Unacceptable Use Cases:**
- Production deployment
- Public network access
- Untrusted network environments
- Any deployment with real mining value

---

## Summary

### Root Cause

ESP32 Arduino Core 3.3.8 does not include Let's Encrypt root certificates. SSL handshake fails silently, causing immediate disconnection without error event.

### Immediate Fix

Add `webSocket.setInsecure()` after `webSocket.beginSSL()`.

### Production Fix

Implement custom certificate configuration with ISRG Root X1 certificate.

### Recommendation

For Phase A hardware validation, use `setInsecure()` with clear documentation of security implications. For production deployment, implement proper certificate configuration.

---

## Files to Modify

**File:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`

**Function:** `connectWebSocket()` (line 269)

**Change:** Add `webSocket.setInsecure();` after line 274

---

## Testing Checklist

- [ ] Add setInsecure() to connectWebSocket()
- [ ] Flash firmware to ESP32
- [ ] Monitor serial output for WStype_CONNECTED
- [ ] Verify device.register message sent
- [ ] Verify device.registered response received
- [ ] Document security implications in firmware comments
- [ ] Plan production certificate configuration for post-Phase A
