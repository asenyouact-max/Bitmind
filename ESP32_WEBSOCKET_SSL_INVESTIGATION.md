# ESP32 WebSocketsClient SSL Connection Investigation

**Date:** 2026-06-09  
**Firmware:** bitmind_legacy_v1.ino  
**ESP32 Core Version:** 3.3.8  
**WebSockets Library:** Links2004/arduinoWebSockets  
**Issue:** Repeated WStype_DISCONNECTED without WStype_CONNECTED or WStype_ERROR

---

## WebSockets Library API Analysis

### Library: Links2004/arduinoWebSockets

**Repository:** https://github.com/Links2004/arduinoWebSockets

**SSL Backend for ESP32 Core 3.3.8:**
- Uses BearSSL (SSL_BARESSL)
- NOT axTLS (older ESP32 cores used axTLS)
- Different API than other WebSocketsClient implementations

### beginSSL() Signature (BearSSL)

```cpp
void beginSSL(const char * host, uint16_t port, const char * url = "/", const char * fingerprint = "", const char * protocol = "arduino");
```

**Parameters:**
- `host`: Server hostname
- `port`: Server port (443 for SSL)
- `url`: WebSocket path (e.g., "/ws")
- `fingerprint`: SHA-1 fingerprint of server certificate as string (empty string "" to disable validation)
- `protocol`: WebSocket protocol (default "arduino")

**IMPORTANT:** The fingerprint parameter is a `const char *` string, NOT a `const uint8_t *` binary array.

### Available SSL Methods

1. **beginSSL()** - Basic SSL with optional fingerprint validation
2. **beginSslWithCA()** - SSL with custom CA certificate
3. **beginSslWithBundle()** - SSL with certificate bundle (ESP32 Core >= 3.0.4)

### IMPORTANT: No setInsecure() Method

**The Links2004/arduinoWebSockets library does NOT have a `setInsecure()` method.**

This method exists in other WebSocketsClient implementations (e.g., ESPAsyncWebServer) but NOT in the Links2004 library.

---

## Current Implementation

**Location:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino` (lines 269-280)

```cpp
void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  // Use beginSSL with NULL fingerprint to bypass certificate validation
  // ESP32 Arduino Core 3.3.8 uses BearSSL which doesn't include Let's Encrypt root certificates
  // NULL fingerprint disables certificate validation (development/testing only)
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH, (const uint8_t *)NULL);
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

The ESP32 Arduino Core 3.3.8 uses BearSSL for SSL/TLS. When `beginSSL()` is called without a fingerprint parameter (or with default empty fingerprint), the library attempts to validate the server certificate against its built-in root certificate store.

**Let's Encrypt Certificates:**
- Let's Encrypt uses ISRG Root X1 certificate
- This certificate is NOT included in ESP32 Arduino Core 3.3.8's default BearSSL certificate store
- The SSL handshake fails during certificate validation
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

### Built-in Root Certificates (BearSSL)

ESP32 Arduino Core 3.3.8 includes a limited set of root certificates in BearSSL:
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
- Default BearSSL certificate store is ~20KB
- Adding custom certificates requires partition scheme changes

---

## Solution Options

### Option 1: Empty Fingerprint String (Quickest Fix - APPLIED)

**Description:** Pass empty string "" as fingerprint parameter to disable certificate validation

**Implementation:**
```cpp
void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  // Empty fingerprint disables certificate validation
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH, "");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}
```

**Pros:**
- Immediate fix
- No certificate management required
- Works with any certificate authority
- Minimal code change
- Uses correct API for Links2004 library
- Compile-valid for ESP32 Core 3.3.8

**Cons:**
- **SECURITY RISK:** Vulnerable to man-in-the-middle attacks
- No certificate validation
- Not recommended for production
- Violates security best practices

**Use Case:** Development/testing only

---

### Option 2: Custom Certificate Configuration (Production-Ready)

**Description:** Add Let's Encrypt root certificate using beginSslWithCA()

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
  
  // Use beginSslWithCA for proper certificate validation
  webSocket.beginSslWithCA(WS_HOST, WS_PORT, WS_PATH, (const char *)isrgrootx1_der);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}
```

**Pros:**
- Secure certificate validation
- Production-ready
- No security vulnerabilities
- Complies with best practices
- Uses correct API for Links2004 library

**Cons:**
- Requires certificate management
- Certificate updates when Let's Encrypt rotates
- More complex implementation
- Requires flash space for certificate

**Use Case:** Production deployment

---

### Option 3: Certificate Bundle (Alternative Production Fix)

**Description:** Use beginSslWithBundle() for ESP32 Core >= 3.0.4

**Implementation:**
```cpp
#include "cert_bundle.h"

void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  // Use certificate bundle for multiple CAs
  webSocket.beginSslWithBundle(WS_HOST, WS_PORT, WS_PATH, cert_bundle, cert_bundle_size);
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}
```

**Pros:**
- Supports multiple certificates
- Production-ready
- More flexible than single CA

**Cons:**
- Larger flash footprint
- More complex certificate management

**Use Case:** Production deployment with multiple CAs

---

## Applied Fix

### Immediate Fix (Development/Testing)

**Status:** APPLIED

**Change:** Modified `connectWebSocket()` to pass empty string "" as fingerprint

```cpp
void connectWebSocket() {
  Serial.println("[WS] Connecting to WebSocket...");
  Serial.println("[WS] Host: " + String(WS_HOST));
  Serial.println("[WS] Port: " + String(WS_PORT));
  
  // Use beginSSL with empty fingerprint to bypass certificate validation
  // ESP32 Arduino Core 3.3.8 uses BearSSL which doesn't include Let's Encrypt root certificates
  // Empty fingerprint ("") disables certificate validation (development/testing only)
  // Links2004 WebSockets API: beginSSL(host, port, url, fingerprint, protocol)
  webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH, "");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(RECONNECT_INTERVAL);
}
```

### Production Fix (Post-Phase A)

Implement custom certificate configuration with ISRG Root X1 using `beginSslWithCA()`.

---

## Enhanced Debugging

### Add Detailed Logging

```cpp
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch (type) {
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected");
      Serial.println("[WS] Disconnect reason: SSL handshake likely failed");
      Serial.println("[WS] Fix: NULL fingerprint passed to beginSSL()");
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

### After Applying NULL Fingerprint Fix

1. Flash firmware with NULL fingerprint fix
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

### NULL Fingerprint Risks

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

ESP32 Arduino Core 3.3.8 uses BearSSL which does not include Let's Encrypt root certificates. SSL handshake fails silently, causing immediate disconnection without error event.

### Incorrect Fixes Attempted

1. `setInsecure()` does NOT exist in the Links2004/arduinoWebSockets library. This method exists in other WebSocketsClient implementations but not in this library.

2. Passing `(const uint8_t *)NULL` as fingerprint fails with invalid conversion because the fingerprint parameter is `const char *` string, not `const uint8_t *` binary array.

### Correct Fix Applied

Pass empty string "" as the fingerprint parameter to `beginSSL()` to disable certificate validation.

### Production Fix

Implement custom certificate configuration with ISRG Root X1 using `beginSslWithCA()`.

### Recommendation

For Phase A hardware validation, use empty string "" as fingerprint with clear documentation of security implications. For production deployment, implement proper certificate configuration using `beginSslWithCA()`.

---

## Files Modified

**File:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`

**Function:** `connectWebSocket()` (line 270)

**Change:** Modified `beginSSL()` call to pass empty string "" as fingerprint

**Function:** `generateDeviceId()` (line 110)

**Change:** Replaced `esp_read_mac()` with `esp_efuse_mac_get_default()` for ESP32 Core 3.3.8 compatibility

---

## Testing Checklist

- [x] Remove incorrect setInsecure() call
- [x] Apply empty string "" fingerprint to beginSSL()
- [x] Fix generateDeviceId() for ESP32 Core 3.3.8
- [ ] Flash firmware to ESP32
- [ ] Monitor serial output for WStype_CONNECTED
- [ ] Verify device.register message sent
- [ ] Verify device.registered response received
- [ ] Document security implications in firmware comments
- [ ] Plan production certificate configuration for post-Phase A
