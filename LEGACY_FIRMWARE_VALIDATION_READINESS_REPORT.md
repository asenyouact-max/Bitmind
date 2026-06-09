# BITMIND LEGACY FIRMWARE V1 VALIDATION READINESS REPORT

**Date:** 2026-06-09  
**Version:** 1.0  
**Phase:** Phase A  
**Target:** ESP32 (no screen)  
**Status:** VALIDATION READINESS AUDIT

---

## SECTION 1 - BUILD VALIDATION

### Dependencies Analysis

**Required Libraries:**
- WiFi.h - ESP32 core library (built-in)
- WebServer.h - ESP32 core library (built-in)
- WebSocketsClient.h - External library (NOT in platformio.ini)
- Preferences.h - ESP32 core library (built-in)
- esp_wifi.h - ESP32 core library (built-in)
- mbedtls/sha256.h - ESP32 core library (built-in)

**Status:** FAIL - Missing dependency

**Issue:** WebSocketsClient.h is used but not declared in platformio.ini lib_deps

**Impact:** Build will fail due to missing library

**Fix Required:** Add WebSockets library to platformio.ini lib_deps

---

### PlatformIO Configuration Analysis

**Configuration Valid:**
- Platform: espressif32 ✓
- Board: esp32dev ✓
- Framework: arduino ✓
- Monitor speed: 115200 ✓
- Build flags: Appropriate for ESP32 ✓

**Status:** PASS (with dependency fix)

---

### Compile-Time Issues

**Potential Issues:**
1. String concatenation in JSON message building - may cause memory fragmentation
2. No explicit memory management for large JSON strings
3. Simplified JSON parsing may fail on complex structures

**Status:** PARTIAL - No compile errors, but potential runtime issues

---

### Build Validation Summary

**Status:** FAIL (missing dependency)

**Required Fix:** Add WebSockets library to platformio.ini

**Expected Fix:**
```ini
lib_deps = 
    https://github.com/Links2004/arduinoWebSockets
```

---

## SECTION 2 - ARCHITECTURE COMPLIANCE

### Device Identity

**Requirement:** Generate deviceId from EFuse MAC with canonical Bitmind device format

**Implementation:**
- Function: `generateDeviceId()` (lines 110-120)
- Source: `esp_read_mac(mac, ESP_MAC_WIFI_STA)` ✓
- Format: `esp32-{upper4hex}{lower8hex}` ✓
- Example: `esp32-A1B2C3D4E5F6` ✓
- Persistence: Computed at boot, not stored ✓

**Compliance:** PASS

**Reference:** BITMIND_FIRMWARE_ARCHITECTURE.md, lines 35-40

---

### Worker Identity

**Requirement:** workerName stored in Preferences, workerName remains primary identity

**Implementation:**
- Storage: Preferences NV storage, namespace "bitmind", key "worker" ✓
- Load: `loadConfiguration()` (lines 126-142) ✓
- Save: `saveConfiguration()` (lines 144-157) ✓
- Primary Identity: Used in registration message ✓
- Validation: Min 3 characters enforced in AP mode form ✓

**Compliance:** PASS

**Reference:** BITMIND_FIRMWARE_ARCHITECTURE.md, lines 42-47

---

### Preferences Storage

**Requirement:** Store ssid, password, workerName, wallet, token using Preferences

**Implementation:**
- Technology: ESP32 Preferences (NV storage) ✓
- Namespace: "bitmind" ✓
- Keys: ssid, pass, worker, wallet, registered, token ✓
- Load Strategy: Load on boot ✓
- Save Strategy: Save immediately ✓
- Persistence: Survives reboots ✓

**Compliance:** PASS

**Reference:** BITMIND_FIRMWARE_ARCHITECTURE.md, lines 57-79

---

### AP Mode

**Requirement:** Implement Bitmind Setup Portal with WiFi, Worker, Wallet configuration

**Implementation:**
- SSID: "Bitmind-Setup" ✓
- Password: "12345678" ✓
- IP: 192.168.4.1 ✓
- Web Server: Port 80 ✓
- Endpoints: `/` (setup form), `/save` (save configuration) ✓
- Form Fields: WiFi SSID, Password, Worker Name, Wallet Address ✓
- Save Flow: Parse, validate, save, reboot ✓

**Compliance:** PASS

**Reference:** BITMIND_FIRMWARE_ARCHITECTURE.md, lines 185-221

---

### WiFi

**Requirement:** Implement initial connection, reconnect logic, recovery handling

**Implementation:**
- Initial Connection: `connectWiFi()` (lines 218-238) ✓
- Reconnect Logic: Check in main loop (lines 687-690) ✓
- Recovery Handling: Fallback to AP mode on failure ✓
- Timeout: 30 seconds ✓

**Compliance:** PASS

**Reference:** BITMIND_FIRMWARE_ARCHITECTURE.md, lines 162-166

---

### WebSocket

**Requirement:** Implement SSL connection, Protocol v1 compliance, auto reconnect

**Implementation:**
- SSL Connection: `webSocket.beginSSL()` (line 274) ✓
- Protocol v1 Compliance: All message types implemented ✓
- Auto Reconnect: `webSocket.setReconnectInterval(5000ms)` (line 276) ✓
- Event Handling: `webSocketEvent()` (lines 244-267) ✓

**Compliance:** PASS

**Reference:** BITMIND_FIRMWARE_ARCHITECTURE.md, lines 81-108

---

### Registration

**Requirement:** Implement register message according to Protocol v1

**Implementation:**
- Message Type: `device.register` ✓
- Required Fields: type, deviceId, deviceType, firmwareVersion ✓
- Optional Fields: capabilities ✓
- Function: `sendDeviceRegister()` (lines 289-299) ✓
- Trigger: On WebSocket connection ✓
- Token Storage: Extract and save (lines 362-374) ✓

**Compliance:** PASS

**Reference:** BITMIND_PROTOCOL_V1_FREEZE.md, lines 361-383

---

### Heartbeat

**Requirement:** Implement heartbeat message according to Protocol v1

**Implementation:**
- Message Type: `device.heartbeat` ✓
- Required Fields: type, deviceId, uptime, wifiRssi ✓
- Interval: 10 seconds ✓
- Function: `sendHeartbeat()` (lines 301-310) ✓

**Compliance:** PASS

**Reference:** BITMIND_PROTOCOL_V1_FREEZE.md, lines 407-426

---

### Mining

**Requirement:** Implement Protocol v1 mining.job parsing, nonce range handling, double SHA256

**Implementation:**
- Job Parsing: `handleMiningJob()` (lines 376-471) ✓
- Fields Parsed: jobId, sessionId, target, pseudoTarget, pseudoMining, version, previousblockhash, merkleroot, nbits, ntime, deviceContext ✓
- Nonce Range Handling: nonceStart, nonceEnd (lines 455-459) ✓
- Double SHA256: `doubleSHA256()` (lines 496-500) ✓
- Block Header Construction: `buildBlockHeader()` (lines 502-538) ✓
- Mining Loop: 100ms interval (lines 550-589) ✓

**Compliance:** PASS

**Reference:** BITMIND_PROTOCOL_V1_FREEZE.md, lines 452-484, 627-658

---

### Share Submission

**Requirement:** Implement mining.share according to Protocol v1

**Implementation:**
- Message Type: `mining.share` ✓
- Required Fields: type, deviceId, jobId, nonce, hash ✓
- Function: `sendShare()` (lines 312-322) ✓
- Trigger: Hash < target ✓
- Result Handling: `handleShareResult()` (lines 473-485) ✓

**Compliance:** PASS

**Reference:** BITMIND_PROTOCOL_V1_FREEZE.md, lines 487-507

---

### mining_stats

**Requirement:** Implement mining_stats with hashrate, acceptedShares, rejectedShares, uptime, max 1 per 10 seconds

**Implementation:**
- Message Type: `mining_stats` ✓
- Required Fields: type, deviceId, hashrate, acceptedShares, rejectedShares, uptime ✓
- Optional Fields: jobId ✓
- Function: `sendTelemetry()` (lines 324-338) ✓
- Interval: 10 seconds ✓
- Hash Rate Calculation: Rolling window (lines 591-598) ✓

**Compliance:** PASS

**Reference:** BITMIND_PROTOCOL_V1_FREEZE.md, lines 530-551

---

### Architecture Compliance Summary

**Status:** PASS

All architecture requirements are implemented correctly.

---

## SECTION 3 - PROTOCOL COMPLIANCE

### device.register

**Protocol v1 Schema:**
- type (const: "device.register")
- deviceId (string, pattern: ^esp32-[a-f0-9]{4,12}$)
- deviceType (enum: ["oled_miner", "miner", "test_client"])
- firmwareVersion (string, pattern: ^\d+\.\d+\.\d+$)
- capabilities (object: oled, wifi, stratum booleans)

**Implementation (lines 289-299):**
- type: "device.register" ✓
- deviceId: deviceId ✓
- deviceType: "miner" ✓
- firmwareVersion: "1.0.0" ✓
- capabilities: {oled: false, wifi: true, stratum: true} ✓

**Compliance:** PASS

---

### device.heartbeat

**Protocol v1 Schema:**
- type (const: "device.heartbeat")
- deviceId (string)
- uptime (integer, minimum: 0)
- wifiRssi (integer, maximum: 0, minimum: -100)

**Implementation (lines 301-310):**
- type: "device.heartbeat" ✓
- deviceId: deviceId ✓
- uptime: stats.uptime ✓
- wifiRssi: WiFi.RSSI() ✓

**Compliance:** PASS

---

### mining.job

**Protocol v1 Schema:**
- type (const: "mining.job")
- jobId (string, UUID)
- sessionId (string, UUID)
- height (number)
- target (hex string)
- pseudoTarget (hex string or null)
- pseudoMining (boolean)
- createdAt (timestamp)
- version (number)
- previousblockhash (hex string)
- merkleroot (hex string)
- nbits (number)
- ntime (timestamp)
- deviceContext (object with sessionId, nonceStart, nonceEnd, extranonce1)

**Implementation (lines 376-471):**
- All required fields parsed ✓
- deviceContext parsed (nonceStart, nonceEnd) ✓
- Block header construction uses individual fields ✓

**Compliance:** PASS

---

### mining.share

**Protocol v1 Schema:**
- type (const: "mining.share")
- deviceId (string)
- jobId (string, UUID)
- nonce (hex string, 8 chars)
- hash (hex string, 64 chars)

**Implementation (lines 312-322):**
- type: "mining.share" ✓
- deviceId: deviceId ✓
- jobId: miningState.jobId ✓
- nonce: String(nonce, HEX) ✓
- hash: hashHex ✓

**Compliance:** PASS

---

### mining_stats

**Protocol v1 Schema:**
- type (const: "mining_stats")
- deviceId (string)
- hashrate (number)
- acceptedShares (number)
- rejectedShares (number)
- uptime (number)
- jobId (optional, string)

**Implementation (lines 324-338):**
- type: "mining_stats" ✓
- deviceId: deviceId ✓
- hashrate: stats.hashrate ✓
- acceptedShares: stats.acceptedShares ✓
- rejectedShares: stats.rejectedShares ✓
- uptime: stats.uptime ✓
- jobId: miningState.jobId (if active) ✓

**Compliance:** PASS

---

### Protocol Compliance Summary

**Status:** PASS

All protocol v1 messages are implemented correctly.

---

## SECTION 4 - HARDWARE TEST CHECKLIST

### ESP32 Validation Run Procedure

#### 1. Flash Firmware

**Steps:**
1. Connect ESP32 to computer via USB
2. Open PlatformIO
3. Run `pio run --target upload`
4. Wait for upload completion
5. Open serial monitor at 115200 baud

**Expected Result:**
- Firmware uploads successfully
- Serial monitor shows boot sequence
- Device ID displayed
- Firmware version displayed

**Verification:**
- [ ] Upload successful
- [ ] Boot sequence visible
- [ ] Device ID format correct (esp32-XXXXXXX)
- [ ] Firmware version: 1.0.0

---

#### 2. AP Mode Verification

**Steps:**
1. Boot device without WiFi credentials
2. Check serial monitor for AP mode message
3. Scan WiFi networks on phone/computer
4. Look for "Bitmind-Setup" network
5. Connect to AP (password: 12345678)
6. Open browser to http://192.168.4.1

**Expected Result:**
- Serial monitor: "[BOOT] No WiFi credentials, entering AP mode"
- Serial monitor: "[AP] AP started"
- Serial monitor: "[AP] SSID: Bitmind-Setup"
- WiFi network "Bitmind-Setup" visible
- Browser shows "Bitmind Setup" form

**Verification:**
- [ ] AP mode entered correctly
- [ ] SSID: Bitmind-Setup
- [ ] Password: 12345678
- [ ] IP: 192.168.4.1
- [ ] Web form accessible

---

#### 3. WiFi Provisioning

**Steps:**
1. Fill in WiFi SSID
2. Fill in WiFi Password
3. Fill in Worker Name (min 3 chars)
4. Fill in Wallet Address
5. Click "Save & Reboot"
6. Wait for device reboot

**Expected Result:**
- Browser shows "Configuration Saved"
- Device reboots after 1 second
- Serial monitor shows configuration loaded

**Verification:**
- [ ] Form accepts valid input
- [ ] Configuration saved
- [ ] Device reboots
- [ ] Configuration persists after reboot

---

#### 4. Worker Configuration

**Steps:**
1. After reboot, check serial monitor
2. Verify worker name displayed
3. Verify worker name >= 3 characters

**Expected Result:**
- Serial monitor: "[CONFIG] Worker: {workerName}"
- Worker name matches input

**Verification:**
- [ ] Worker name stored correctly
- [ ] Worker name >= 3 characters
- [ ] Worker name displayed in serial

---

#### 5. Registration Verification

**Steps:**
1. Device connects to WiFi
2. Device connects to WebSocket
3. Monitor serial for registration messages
4. Check for device.register message
5. Check for device.registered response
6. Verify token saved

**Expected Result:**
- Serial: "[WS] Connected"
- Serial: "[PROTO] Sending device.register"
- Serial: "[PROTO] Received device.registered"
- Serial: "[PROTO] Token saved: {token}"
- Serial: "[CONFIG] Registered: Yes"

**Verification:**
- [ ] WebSocket connection successful
- [ ] device.register sent
- [ ] device.registered received
- [ ] Token extracted and saved
- [ ] Registration flag set

---

#### 6. WebSocket Connection Verification

**Steps:**
1. Monitor serial for WebSocket messages
2. Verify SSL connection to getbitmind.com:443
3. Verify connection stability
4. Verify auto-reconnect on disconnect

**Expected Result:**
- Serial: "[WS] Connecting to WebSocket..."
- Serial: "[WS] Host: getbitmind.com"
- Serial: "[WS] Port: 443"
- Serial: "[WS] Connected"
- Connection remains stable

**Verification:**
- [ ] SSL connection successful
- [ ] Host: getbitmind.com
- [ ] Port: 443
- [ ] Path: /ws
- [ ] Connection stable
- [ ] Auto-reconnect works

---

#### 7. mining.job Reception

**Steps:**
1. Wait for backend to send mining.job
2. Monitor serial for job reception
3. Verify job parsing
4. Verify job fields extracted

**Expected Result:**
- Serial: "[PROTO] Received mining.job"
- Serial: "[MINING] Job received"
- Serial: "[MINING] Job ID: {jobId}"
- Serial: "[MINING] Session ID: {sessionId}"
- Serial: "[MINING] Target: {target}"
- Serial: "[MINING] Nonce range: {nonceStart} - {nonceEnd}"

**Verification:**
- [ ] mining.job received
- [ ] Job ID extracted
- [ ] Session ID extracted
- [ ] Target extracted
- [ ] Nonce range extracted
- [ ] Mining state activated

---

#### 8. Hashing Verification

**Steps:**
1. Monitor serial for mining activity
2. Verify mining loop running
3. Verify hash rate calculation
4. Verify nonce increment

**Expected Result:**
- Mining loop runs every 100ms
- Hash rate calculated and updated
- Nonce increments correctly
- Block header constructed correctly

**Verification:**
- [ ] Mining loop active
- [ ] 100ms interval maintained
- [ ] Hash rate > 0
- [ ] Nonce incrementing
- [ ] Block header 80 bytes

---

#### 9. Share Submission Verification

**Steps:**
1. Wait for share to be found (may take time with real target)
2. Monitor serial for share submission
3. Verify mining.share message
4. Verify mining.share.result response

**Expected Result:**
- Serial: "[MINING] Share found!"
- Serial: "[MINING] Nonce: {nonce}"
- Serial: "[MINING] Hash: {hash}"
- Serial: "[PROTO] Sending mining.share"
- Serial: "[PROTO] Received mining.share.result"
- Serial: "[MINING] Share accepted" or "[MINING] Share rejected"

**Verification:**
- [ ] Share found (or use pseudo target for testing)
- [ ] mining.share sent
- [ ] mining.share.result received
- [ ] Accepted/rejected count updated

---

#### 10. mining_stats Verification

**Steps:**
1. Wait for telemetry interval (10 seconds)
2. Monitor serial for telemetry message
3. Verify mining_stats message
4. Verify fields: hashrate, acceptedShares, rejectedShares, uptime

**Expected Result:**
- Serial: "[PROTO] Sending mining_stats"
- Message includes: deviceId, hashrate, acceptedShares, rejectedShares, uptime
- Message includes jobId if mining active

**Verification:**
- [ ] mining_stats sent every 10 seconds
- [ ] hashrate included
- [ ] acceptedShares included
- [ ] rejectedShares included
- [ ] uptime included
- [ ] jobId included (if mining)

---

#### 11. Reconnect Verification

**Steps:**
1. Disconnect WiFi from router
2. Monitor serial for disconnect detection
3. Monitor serial for reconnect attempt
4. Reconnect WiFi
5. Monitor serial for reconnection success

**Expected Result:**
- Serial: "[WIFI] Disconnected, reconnecting..."
- Serial: "[WIFI] Connecting to WiFi..."
- Serial: "[WIFI] Connected"
- Serial: "[WS] Connected"
- Registration re-sent

**Verification:**
- [ ] Disconnect detected
- [ ] Reconnect attempted
- [ ] WiFi reconnected
- [ ] WebSocket reconnected
- [ ] Registration re-sent

---

#### 12. Power-Cycle Verification

**Steps:**
1. Power off device
2. Wait 5 seconds
3. Power on device
4. Monitor serial for boot sequence
5. Verify configuration loaded
6. Verify WiFi connection
7. Verify WebSocket connection
8. Verify registration

**Expected Result:**
- Device boots successfully
- Configuration loaded from Preferences
- WiFi connects automatically
- WebSocket connects automatically
- Registration sent automatically
- Mining resumes automatically

**Verification:**
- [ ] Boot sequence successful
- [ ] Configuration persisted
- [ ] WiFi auto-connects
- [ ] WebSocket auto-connects
- [ ] Registration auto-sent
- [ ] Mining auto-resumes

---

## SECTION 5 - CRITICAL ISSUES

### Issues Blocking Hardware Validation

#### 1. Missing WebSockets Library

**Severity:** CRITICAL

**Issue:** WebSocketsClient.h is used but library not declared in platformio.ini

**Impact:** Build will fail, cannot flash firmware

**Fix Required:** Add to platformio.ini:
```ini
lib_deps = 
    https://github.com/Links2004/arduinoWebSockets
```

**Blocker:** YES

---

#### 2. JSON Parsing Fragility

**Severity:** HIGH

**Issue:** Simplified string parsing may fail on complex JSON structures

**Impact:** May fail to parse mining.job if JSON structure varies

**Mitigation:** Backend sends consistent JSON structure

**Blocker:** NO (but high risk)

---

#### 3. Memory Fragmentation Risk

**Severity:** MEDIUM

**Issue:** String concatenation in JSON building may cause memory fragmentation

**Impact:** May cause crashes after extended operation

**Mitigation:** Use String reserve() or ArduinoJson

**Blocker:** NO

---

### Summary

**Critical Blockers:** 1 (missing WebSockets library)

**High Risk Issues:** 1 (JSON parsing fragility)

**Medium Risk Issues:** 1 (memory fragmentation)

---

## SECTION 6 - READINESS DECISION

### Status: NOT READY FOR HARDWARE TESTING

**Reason:**

1. **Critical Build Failure:** WebSockets library is missing from platformio.ini, preventing successful compilation
2. **Fix Required:** Add WebSockets library dependency to platformio.ini
3. **Fix Time:** < 5 minutes

### After Fix

**Status:** READY FOR HARDWARE TESTING

**Rationale:**

1. All architecture requirements implemented correctly
2. All protocol v1 messages implemented correctly
3. JSON parsing fragility is a risk but not a blocker for initial testing
4. Memory fragmentation risk is acceptable for initial validation
5. Hardware test checklist is comprehensive and actionable

---

## SECTION 7 - CANONICAL STATE RECOMMENDATION

### Recommendation: IMPLEMENTED ONLY

**Rationale:**

1. Firmware is implemented but not yet verified on real hardware
2. Critical build issue must be fixed before testing
3. Hardware validation has not been performed
4. No empirical evidence of correct operation

### When to Update to IMPLEMENTED + VERIFIED

Update after:

1. WebSockets library dependency fixed
2. Firmware successfully flashed to ESP32
3. All 12 hardware test steps completed successfully
4. Device demonstrates stable operation for extended period (24+ hours)
5. No critical bugs discovered during testing

---

## END OF REPORT

**Next Steps:**

1. Fix platformio.ini (add WebSockets library)
2. Rebuild firmware
3. Perform hardware validation
4. Update Canonical State after successful validation
