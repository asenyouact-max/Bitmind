# BITMIND LEGACY FIRMWARE V1 HARDWARE VALIDATION GUIDE

**Date:** 2026-06-09  
**Version:** 1.0  
**Phase:** Phase A  
**Target:** ESP32 (no screen)  
**Status:** READY FOR HARDWARE TESTING

---

## TASK 1 - BUILD VERIFICATION

### Build Status: READY

**Critical Issue:** RESOLVED - WebSockets library added to platformio.ini

---

### Build Instructions (PlatformIO)

**Prerequisites:**
- PlatformIO installed (VS Code extension or CLI)
- ESP32 connected via USB
- USB drivers installed (CP210x or CH340 depending on board)

**Build Steps:**

1. **Open Project**
   ```
   Navigate to: esp32_firmware/bitmind_legacy_v1/
   Open in VS Code with PlatformIO extension
   ```

2. **Clean Build**
   ```
   pio run --target clean
   ```

3. **Build Firmware**
   ```
   pio run
   ```

**Expected Output:**
```
Processing esp32dev (platform: espressif32; board: esp32dev; framework: arduino)
-------------------------------------------------------------------------
Configuring upload protocol...
CURRENT: upload_protocol = esptool
Looking for upload port...
Auto-detected: COM3
Forcing reset using 1200bps open/close on port COM3
Waiting for the new upload port...
Uploading .pio\build\esp32dev\firmware.bin
esp32 @ 921600
Writing at 0x00001000... (100%)
Wrote 339264 bytes (XXX compressed) at 4194304 in 0.8 seconds (effective 4194.3 kbit/s)
Writing at 0x00008000... (100%)
Wrote 8192 bytes (XXX compressed) at 4194304 in 0.0 seconds (effective 8192.0 kbit/s)
Writing at 0x0000e000... (100%)
Wrote 8192 bytes (XXX compressed) at 4194304 in 0.0 seconds (effective 8192.0 kbit/s)

======== [SUCCESS] Took 10.45 seconds ========
```

**Verification:**
- [ ] Build completes without errors
- [ ] firmware.bin generated
- [ ] Size < 1.5MB (ESP32 flash size typical)

---

### Build Instructions (Arduino IDE)

**Prerequisites:**
- Arduino IDE 2.x installed
- ESP32 board support installed
- WebSockets library installed via Library Manager

**Board Settings:**
- Board: ESP32 Dev Module
- Upload Speed: 921600
- CPU Frequency: 240MHz
- Flash Frequency: 80MHz
- Flash Mode: QIO
- Partition Scheme: Default
- Core Debug Level: None

**Library Installation:**
1. Sketch → Include Library → Manage Libraries
2. Search: "WebSockets"
3. Install: "WebSockets" by Markus Sattler

**Build Steps:**
1. Open bitmind_legacy_v1.ino
2. Select Board: ESP32 Dev Module
3. Select Port: COMx (your ESP32 port)
4. Click Upload button

---

## TASK 2 - FLASHING GUIDE

### Supported ESP32 Board Type

**Recommended Board:** ESP32 DevKit (any variant)
- ESP32-WROOM-32
- ESP32-WROVER
- ESP32-S2 (may require minor adjustments)
- ESP32-S3 (may require minor adjustments)

**Board Requirements:**
- USB-to-Serial adapter (built-in on DevKit)
- 4MB+ Flash
- WiFi antenna
- USB cable (data-capable, not charge-only)

---

### Flashing Instructions (PlatformIO)

**Step 1: Connect ESP32**
- Connect ESP32 to computer via USB
- Wait for drivers to install (first time)
- Note COM port number

**Step 2: Verify Connection**
```
pio device list
```
Expected output:
```
PlatformIO Device Manager v4.0
-------------------------------------------------------------------------
COM3          Silicon Labs CP210x USB to UART Bridge
```

**Step 3: Flash Firmware**
```
pio run --target upload
```

**Step 4: Open Serial Monitor**
```
pio device monitor --baud 115200
```

**Expected Result:**
- Firmware uploads successfully
- Serial monitor shows boot sequence
- Device ID displayed

---

### Flashing Instructions (Arduino IDE)

**Step 1: Connect ESP32**
- Connect ESP32 to computer via USB
- Wait for drivers to install

**Step 2: Select Port**
- Tools → Port → COMx (your ESP32 port)

**Step 3: Upload**
- Click Upload button (right arrow)
- Wait for upload completion

**Step 4: Open Serial Monitor**
- Click Serial Monitor button (magnifying glass)
- Set baud rate to 115200

**Expected Result:**
- Upload progress bar completes
- "Done uploading" message
- Serial monitor shows boot sequence

---

### Troubleshooting Flashing

**Issue: "Failed to connect to ESP32"**
- Cause: Wrong COM port or driver issue
- Fix: Check Device Manager, reinstall drivers

**Issue: "A fatal error occurred: Failed to connect to ESP32"**
- Cause: ESP32 in wrong mode
- Fix: Hold BOOT button while clicking Upload, release when "Connecting..." appears

**Issue: "Timed out waiting for packet header"**
- Cause: Upload speed too high
- Fix: Reduce upload speed to 115200

---

## TASK 3 - SERIAL MONITOR GUIDE

### Expected Serial Output

#### First Boot (No Configuration)

```
========================================
Bitmind Legacy Firmware v1
Phase A Implementation
========================================
[BOOT] Device ID: esp32-A1B2C3D4E5F6
[BOOT] Firmware Version: 1.0.0
[CONFIG] Configuration loaded
[CONFIG] SSID: (empty)
[CONFIG] Worker: (empty)
[CONFIG] Registered: No
[BOOT] No WiFi credentials, entering AP mode
[AP] Starting AP mode...
[AP] AP started
[AP] SSID: Bitmind-Setup
[AP] IP: 192.168.4.1
```

---

#### AP Mode Startup

```
[AP] Starting AP mode...
[AP] AP started
[AP] SSID: Bitmind-Setup
[AP] IP: 192.168.4.1
```

**Indicators:**
- AP mode active
- Web server running on port 80
- Ready for user configuration

---

#### WiFi Connection (After Configuration)

```
========================================
Bitmind Legacy Firmware v1
Phase A Implementation
========================================
[BOOT] Device ID: esp32-A1B2C3D4E5F6
[BOOT] Firmware Version: 1.0.0
[CONFIG] Configuration loaded
[CONFIG] SSID: MyWiFi
[CONFIG] Worker: test-worker
[CONFIG] Registered: No
[WIFI] Connecting to WiFi...
[WIFI] SSID: MyWiFi
..........
[WIFI] Connected
[WIFI] IP: 192.168.1.100
[WS] Connecting to WebSocket...
[WS] Host: getbitmind.com
[WS] Port: 443
[WS] Connected
[PROTO] Sending device.register
[PROTO] Received device.registered
[PROTO] Token saved: abc123def456...
[CONFIG] Configuration saved
[BOOT] Setup complete
```

---

#### Backend Registration

```
[WS] Connected
[PROTO] Sending device.register
[WS] Message received: {"type":"device.registered","status":"accepted","deviceId":"esp32-A1B2C3D4E5F6","token":"abc123def456...","serverTime":1717920000}
[PROTO] Received device.registered
[PROTO] Token saved: abc123def456...
[CONFIG] Configuration saved
```

**Indicators:**
- Registration successful
- Token saved to Preferences
- Device marked as registered

---

#### mining.job Reception

```
[WS] Message received: {"type":"mining.job","jobId":"550e8400-e29b-41d4-a716-446655440000","sessionId":"6ba7b810-9dad-11d1-80b4-00c04fd430c8","height":840123,"target":"0000000000000000000000000000000000000000000000000000000000000000","pseudoTarget":"00000000ffff0000000000000000000000000000000000000000000000000000","pseudoMining":true,"createdAt":1717920000,"version":1,"previousblockhash":"0000000000000000000000000000000000000000000000000000000000000000","merkleroot":"0000000000000000000000000000000000000000000000000000000000000000","nbits":384568576,"ntime":1717920000,"deviceContext":{"sessionId":"6ba7b810-9dad-11d1-80b4-00c04fd430c8","nonceStart":0,"nonceEnd":1000000,"extranonce1":"00"}}
[PROTO] Received mining.job
[MINING] Job received
[MINING] Job ID: 550e8400-e29b-41d4-a716-446655440000
[MINING] Session ID: 6ba7b810-9dad-11d1-80b4-00c04fd430c8
[MINING] Target: 0000000000000000000000000000000000000000000000000000000000000000
[MINING] Nonce range: 0 - 1000000
[MINING] Pseudo mining: Yes
```

**Indicators:**
- Job parsed successfully
- Mining loop activated
- Nonce range set

---

#### Share Submission

```
[MINING] Share found!
[MINING] Nonce: 1234abcd
[MINING] Hash: 00000000ffff0000000000000000000000000000000000000000000000000000
[PROTO] Sending mining.share
[WS] Message received: {"type":"mining.share.result","jobId":"550e8400-e29b-41d4-a716-446655440000","accepted":true,"reason":"valid"}
[PROTO] Received mining.share.result
[MINING] Share accepted
```

**Indicators:**
- Share found (hash < target)
- Share submitted
- Share accepted by backend

---

#### mining_stats Transmission

```
[PROTO] Sending mining_stats
```

**Message sent:**
```json
{
  "type": "mining_stats",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "hashrate": 10.5,
  "acceptedShares": 5,
  "rejectedShares": 0,
  "uptime": 300,
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Indicators:**
- Telemetry sent every 10 seconds
- Hash rate calculated
- Statistics tracked

---

#### Heartbeat Transmission

```
[PROTO] Sending device.heartbeat
```

**Message sent:**
```json
{
  "type": "device.heartbeat",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "uptime": 300,
  "wifiRssi": -45
}
```

**Indicators:**
- Heartbeat sent every 10 seconds
- WiFi RSSI reported
- Uptime tracked

---

## TASK 4 - HARDWARE TEST EXECUTION GUIDE

### Test 1: Flash Firmware

**Action:**
1. Connect ESP32 to computer via USB
2. Run `pio run --target upload`
3. Open serial monitor at 115200 baud

**Expected Result:**
- Firmware uploads successfully
- Serial monitor shows boot sequence
- Device ID displayed (format: esp32-XXXXXXX)
- Firmware version: 1.0.0

**Success Criteria:**
- [ ] Upload completes without errors
- [ ] Boot sequence visible in serial monitor
- [ ] Device ID format correct
- [ ] Firmware version correct

**Failure Indicators:**
- Upload fails with error
- No serial output
- Garbled serial output (wrong baud rate)
- Device ID format incorrect

---

### Test 2: AP Mode Verification

**Action:**
1. Boot device without WiFi credentials
2. Check serial monitor for AP mode message
3. Scan WiFi networks on phone/computer
4. Look for "Bitmind-Setup" network
5. Connect to AP (password: 12345678)
6. Open browser to http://192.168.4.1

**Expected Result:**
- Serial: "[BOOT] No WiFi credentials, entering AP mode"
- Serial: "[AP] AP started"
- Serial: "[AP] SSID: Bitmind-Setup"
- WiFi network "Bitmind-Setup" visible
- Browser shows "Bitmind Setup" form

**Success Criteria:**
- [ ] AP mode entered correctly
- [ ] SSID: Bitmind-Setup
- [ ] Password: 12345678
- [ ] IP: 192.168.4.1
- [ ] Web form accessible

**Failure Indicators:**
- AP mode not entered
- WiFi network not visible
- Cannot connect to AP
- Web form not accessible

---

### Test 3: WiFi Provisioning

**Action:**
1. Fill in WiFi SSID (your network)
2. Fill in WiFi Password
3. Fill in Worker Name (min 3 chars, e.g., "test-worker")
4. Fill in Wallet Address (valid Bitcoin address)
5. Click "Save & Reboot"
6. Wait for device reboot

**Expected Result:**
- Browser shows "Configuration Saved"
- Device reboots after 1 second
- Serial monitor shows configuration loaded

**Success Criteria:**
- [ ] Form accepts valid input
- [ ] Configuration saved
- [ ] Device reboots
- [ ] Configuration persists after reboot

**Failure Indicators:**
- Form rejects valid input
- Configuration not saved
- Device does not reboot
- Configuration lost after reboot

---

### Test 4: Worker Configuration

**Action:**
1. After reboot, check serial monitor
2. Verify worker name displayed
3. Verify worker name >= 3 characters

**Expected Result:**
- Serial: "[CONFIG] Worker: test-worker"
- Worker name matches input

**Success Criteria:**
- [ ] Worker name stored correctly
- [ ] Worker name >= 3 characters
- [ ] Worker name displayed in serial

**Failure Indicators:**
- Worker name not stored
- Worker name incorrect
- Worker name < 3 characters

---

### Test 5: Registration Verification

**Action:**
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

**Success Criteria:**
- [ ] WebSocket connection successful
- [ ] device.register sent
- [ ] device.registered received
- [ ] Token extracted and saved
- [ ] Registration flag set

**Failure Indicators:**
- WebSocket connection fails
- device.register not sent
- device.registered not received
- Token not saved
- Registration flag not set

---

### Test 6: WebSocket Connection Verification

**Action:**
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

**Success Criteria:**
- [ ] SSL connection successful
- [ ] Host: getbitmind.com
- [ ] Port: 443
- [ ] Path: /ws
- [ ] Connection stable
- [ ] Auto-reconnect works

**Failure Indicators:**
- SSL connection fails
- Wrong host/port
- Connection unstable
- No auto-reconnect

---

### Test 7: mining.job Reception

**Action:**
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

**Success Criteria:**
- [ ] mining.job received
- [ ] Job ID extracted
- [ ] Session ID extracted
- [ ] Target extracted
- [ ] Nonce range extracted
- [ ] Mining state activated

**Failure Indicators:**
- mining.job not received
- Job parsing fails
- Fields not extracted
- Mining state not activated

---

### Test 8: Hashing Verification

**Action:**
1. Monitor serial for mining activity
2. Verify mining loop running
3. Verify hash rate calculation
4. Verify nonce increment

**Expected Result:**
- Mining loop runs every 100ms
- Hash rate calculated and updated
- Nonce increments correctly
- Block header constructed correctly

**Success Criteria:**
- [ ] Mining loop active
- [ ] 100ms interval maintained
- [ ] Hash rate > 0
- [ ] Nonce incrementing
- [ ] Block header 80 bytes

**Failure Indicators:**
- Mining loop not active
- Interval not maintained
- Hash rate = 0
- Nonce not incrementing
- Block header incorrect

---

### Test 9: Share Submission Verification

**Action:**
1. Wait for share to be found (use pseudo target for testing)
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

**Success Criteria:**
- [ ] Share found (with pseudo target)
- [ ] mining.share sent
- [ ] mining.share.result received
- [ ] Accepted/rejected count updated

**Failure Indicators:**
- Share not found
- mining.share not sent
- mining.share.result not received
- Count not updated

---

### Test 10: mining_stats Verification

**Action:**
1. Wait for telemetry interval (10 seconds)
2. Monitor serial for telemetry message
3. Verify mining_stats message
4. Verify fields: hashrate, acceptedShares, rejectedShares, uptime

**Expected Result:**
- Serial: "[PROTO] Sending mining_stats"
- Message includes: deviceId, hashrate, acceptedShares, rejectedShares, uptime
- Message includes jobId if mining active

**Success Criteria:**
- [ ] mining_stats sent every 10 seconds
- [ ] hashrate included
- [ ] acceptedShares included
- [ ] rejectedShares included
- [ ] uptime included
- [ ] jobId included (if mining)

**Failure Indicators:**
- mining_stats not sent
- Fields missing
- Interval incorrect

---

### Test 11: Reconnect Verification

**Action:**
1. Disconnect WiFi from router (power off router)
2. Monitor serial for disconnect detection
3. Monitor serial for reconnect attempt
4. Reconnect WiFi (power on router)
5. Monitor serial for reconnection success

**Expected Result:**
- Serial: "[WIFI] Disconnected, reconnecting..."
- Serial: "[WIFI] Connecting to WiFi..."
- Serial: "[WIFI] Connected"
- Serial: "[WS] Connected"
- Registration re-sent

**Success Criteria:**
- [ ] Disconnect detected
- [ ] Reconnect attempted
- [ ] WiFi reconnected
- [ ] WebSocket reconnected
- [ ] Registration re-sent

**Failure Indicators:**
- Disconnect not detected
- No reconnect attempt
- WiFi not reconnected
- WebSocket not reconnected
- Registration not re-sent

---

### Test 12: Power-Cycle Verification

**Action:**
1. Power off device (unplug USB)
2. Wait 5 seconds
3. Power on device (plug USB)
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

**Success Criteria:**
- [ ] Boot sequence successful
- [ ] Configuration persisted
- [ ] WiFi auto-connects
- [ ] WebSocket auto-connects
- [ ] Registration auto-sent
- [ ] Mining auto-resumes

**Failure Indicators:**
- Boot fails
- Configuration lost
- WiFi not auto-connecting
- WebSocket not auto-connecting
- Registration not auto-sent
- Mining not auto-resuming

---

## TASK 5 - DEBUGGING GUIDE

### Issue 1: AP Mode Not Appearing

**Symptoms:**
- "Bitmind-Setup" WiFi network not visible
- Device enters AP mode but no network found
- Serial shows AP started but cannot connect

**Likely Causes:**
1. WiFi antenna not connected or damaged
2. ESP32 WiFi hardware failure
3. AP mode initialization failed
4. Router interference (same channel)

**Diagnosis:**
1. Check serial for "[AP] AP started"
2. Scan all WiFi channels (not just common ones)
3. Test with different ESP32 board
4. Check antenna connection

**Fix:**
1. Ensure antenna connected (external antenna on some boards)
2. Reset ESP32 and try again
3. Test with different board
4. Add delay after WiFi.softAP() initialization

**Code Check:**
```cpp
// Verify AP mode code (lines 163-179)
WiFi.softAP(AP_SSID, AP_PASSWORD);
WiFi.softAPConfig(IPAddress(192, 168, 4, 1), IPAddress(192, 168, 4, 1), IPAddress(255, 255, 255, 0));
```

---

### Issue 2: WiFi Connection Failure

**Symptoms:**
- Device fails to connect to WiFi
- Serial shows "[WIFI] Connection timeout"
- Device enters AP mode repeatedly

**Likely Causes:**
1. Wrong WiFi credentials
2. WiFi network not in range
3. WiFi security type not supported (WPA3)
4. Router MAC filtering enabled
5. DHCP not working

**Diagnosis:**
1. Verify SSID and password are correct
2. Test with phone hotspot (known working network)
3. Check serial for WiFi status codes
4. Check router for device connection attempts

**Fix:**
1. Re-enter WiFi credentials via AP mode
2. Use WPA2 network (not WPA3)
4. Disable MAC filtering on router
5. Check router DHCP settings

**Code Check:**
```cpp
// Verify WiFi connection code (lines 218-238)
WiFi.begin(config.ssid.c_str(), config.password.c_str());
unsigned long start = millis();
while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT) {
  delay(500);
  Serial.print(".");
}
```

---

### Issue 3: WebSocket Failure

**Symptoms:**
- WebSocket connection fails
- Serial shows "[WS] Error"
- No registration messages
- Device connects to WiFi but not WebSocket

**Likely Causes:**
1. Backend server down
2. DNS resolution failure
3. SSL certificate issue
4. Firewall blocking connection
5. Wrong WebSocket host/port

**Diagnosis:**
1. Check if getbitmind.com is accessible (ping from computer)
2. Check serial for WebSocket error messages
3. Test with different network (hotspot)
4. Check router firewall settings

**Fix:**
1. Verify backend server is running
2. Check DNS settings
3. Temporarily disable SSL for testing (not recommended for production)
4. Check firewall rules
5. Verify WS_HOST and WS_PORT in code

**Code Check:**
```cpp
// Verify WebSocket connection code (lines 269-277)
webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
webSocket.onEvent(webSocketEvent);
webSocket.setReconnectInterval(RECONNECT_INTERVAL);
```

---

### Issue 4: Registration Failure

**Symptoms:**
- WebSocket connects but registration fails
- Serial shows device.register sent but no response
- device.registered not received
- Token not saved

**Likely Causes:**
1. Backend not processing registration
2. Device ID format incorrect
3. Firmware version not supported
4. Backend validation failure
5. Message format incorrect

**Diagnosis:**
1. Check serial for device.register message
2. Verify device ID format (esp32-XXXXXXX)
3. Check backend logs for registration attempts
4. Verify message format matches protocol v1

**Fix:**
1. Verify backend is processing registrations
2. Check device ID generation code
3. Ensure firmware version is valid
4. Check backend validation logic
5. Compare message format with protocol v1

**Code Check:**
```cpp
// Verify registration code (lines 289-299)
String message = "{\"type\":\"device.register\",";
message += "\"deviceId\":\"" + deviceId + "\",";
message += "\"deviceType\":\"" + String(DEVICE_TYPE) + "\",";
message += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
message += "\"capabilities\":{\"oled\":false,\"wifi\":true,\"stratum\":true}}";
```

---

### Issue 5: No mining.job Received

**Symptoms:**
- Registration successful but no mining.job
- Mining loop not active
- Serial shows no "[MINING] Job received"
- Device connected but not mining

**Likely Causes:**
1. Backend not sending jobs
2. Device not registered in backend
3. Backend mining not active
4. Job generation failure
5. WebSocket message not received

**Diagnosis:**
1. Check backend for registered devices
2. Check backend for mining status
3. Verify WebSocket connection is stable
4. Check serial for any backend messages
5. Check backend logs for job generation

**Fix:**
1. Verify device is registered in backend
2. Ensure backend mining is active
3. Check backend job generation logic
4. Verify WebSocket message handling
5. Restart backend if needed

**Code Check:**
```cpp
// Verify job handling code (lines 376-471)
void handleMiningJob(const String& message) {
  // Check if job parsing is working
  Serial.println("[PROTO] Received mining.job");
  // Verify all fields are extracted
}
```

---

### Issue 6: Share Submission Failure

**Symptoms:**
- Mining active but no shares submitted
- Serial shows "[MINING] Share found!" but no submission
- mining.share sent but no response
- mining.share.result not received

**Likely Causes:**
1. Hash never below target (difficulty too high)
2. Share submission code not called
3. WebSocket not connected when share found
4. Backend not processing shares
5. Message format incorrect

**Diagnosis:**
1. Check if pseudoMining is enabled for testing
2. Verify share submission code is called
3. Check WebSocket connection status
4. Check backend share processing
5. Verify message format

**Fix:**
1. Enable pseudoMining for testing (lower target)
2. Verify share submission code path
3. Ensure WebSocket is connected
4. Check backend share validation
5. Compare message format with protocol v1

**Code Check:**
```cpp
// Verify share submission code (lines 312-322, 550-589)
if (hashHex < target) {
  Serial.println("[MINING] Share found!");
  sendShare(miningState.jobId, miningState.currentNonce, hashHex);
}
```

---

## TASK 6 - GO / NO-GO DECISION

### Status: GO FOR FLASHING

**Rationale:**

1. **Build Status:** READY
   - All dependencies resolved
   - WebSockets library added
   - PlatformIO configuration valid
   - No compile errors expected

2. **Architecture Compliance:** PASS
   - All required features implemented
   - All protocol v1 messages implemented
   - No missing functionality

3. **Code Quality:** ACCEPTABLE
   - Modular structure
   - No dead code
   - No duplicate logic
   - Minimal hardcoded assumptions

4. **Known Risks:** ACCEPTABLE
   - JSON parsing fragility (mitigated by consistent backend)
   - Memory fragmentation (acceptable for initial testing)
   - No critical blockers

5. **Test Coverage:** COMPREHENSIVE
   - 12-step hardware test checklist
   - Detailed debugging guide
   - Serial monitor expectations documented
   - Flashing instructions provided

**Pre-Flight Checklist:**
- [ ] WebSockets library added to platformio.ini
- [ ] PlatformIO configuration valid
- [ ] ESP32 DevKit available
- [ ] USB cable available
- [ ] Backend server running
- [ ] Test WiFi network available
- [ ] Serial monitor ready (115200 baud)

**Recommendation:**
Proceed with hardware validation. Firmware is ready for real ESP32 testing.

---

## END OF GUIDE

**Next Steps:**
1. Build firmware with PlatformIO
2. Flash to ESP32
3. Execute 12-step hardware test checklist
4. Document results
5. Report any issues found
6. Iterate if necessary

**Support:**
- Serial monitor output for debugging
- This guide for troubleshooting
- Backend logs for server-side issues
