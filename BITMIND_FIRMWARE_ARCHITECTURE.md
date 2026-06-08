# BITMIND FIRMWARE ARCHITECTURE SPECIFICATION

**Version:** 1.0  
**Status:** FINAL  
**Last Updated:** 2026-06-08  
**Authority:** This document defines the canonical firmware architecture for Bitmind Phase A.

---

## OVERVIEW

Bitmind firmware runs on ESP32 devices and provides:

- WiFi connectivity and provisioning
- Device registration and identity management
- Real SHA256 Bitcoin mining
- WebSocket communication with Bitmind backend
- Protocol v1 compliance
- AP mode for initial setup
- Configuration persistence

**Two Firmware Variants:**

1. **Legacy ESP Firmware** - No screen, minimal UI, cost-optimized
2. **OLED Firmware** - With screen, visual feedback, enhanced UX

---

## SHARED ARCHITECTURE

Both firmware variants share the following core architecture:

### Device Identity

**Device ID Generation:**
- Source: ESP32 EFuse MAC address
- Format: `esp32-{upper4hex}{lower8hex}`
- Example: `esp32-A1B2C3D4E5F6`
- Uniqueness: Guaranteed by hardware MAC
- Persistence: Computed at boot, not stored

**Worker Identity Model (Canonical):**
- Worker Name: Primary device identity
- Source: User-provided during onboarding
- Storage: Preferences (NV storage)
- Format: String, 3+ characters
- Uniqueness: Per-device, no global enforcement
- Display: Shown in dashboard as device name

**Wallet Address:**
- Source: User-provided during onboarding
- Storage: Preferences (NV storage)
- Format: Bitcoin address (bech32/legacy)
- Validation: Backend validates format
- Purpose: Reward destination (Phase B)

### Configuration Storage

**Storage Technology:** ESP32 Preferences (NV storage)

**Namespace:** `bitmind`

**Stored Fields:**
- `ssid` - WiFi network name
- `pass` - WiFi password
- `worker` - Worker name (primary identity)
- `wallet` - Bitcoin wallet address
- `registered` - Registration flag (boolean)
- `token` - Authentication token (from backend)

**Load Strategy:**
- Load on boot from Preferences
- Default values if missing
- AP mode if WiFi credentials missing

**Save Strategy:**
- Save immediately on user input
- Save on successful registration
- No batch writes

### WebSocket Communication

**Protocol:** Bitmind Device Protocol v1

**Connection Parameters:**
- Host: `getbitmind.com`
- Port: 443 (SSL) or 3001 (dev)
- Path: `/ws`
- SSL: Required for production
- Reconnect Interval: 5000ms

**Message Types (Protocol v1):**
- `device.register` - Device registration
- `device.registered` - Registration acknowledgment
- `device.heartbeat` - Keep-alive signal
- `device.heartbeat.ack` - Heartbeat acknowledgment
- `mining.job` - Mining job distribution
- `mining.share` - Share submission
- `mining.share.result` - Share validation result
- `device.status` - Status update (OLED)
- `device.error` - Error notification

**Reconnect Strategy:**
- Automatic reconnect on disconnect
- Exponential backoff: 5s, 10s, 20s, 30s (max)
- Re-register on reconnect
- Resume mining after reconnect

### Mining Architecture

**Hashing Algorithm:** Double SHA256 (Bitcoin standard)

**Implementation:** mbedtls SHA256 (ESP32 3.3.8+)

**Mining Loop:**
- Interval: 100ms per hash attempt
- Nonce increment: +1 per attempt
- Hash rate calculation: Per-second rolling window
- Share condition: Hash < target (pseudo-target for testing)

**Block Header Construction:**
- Version: 4 bytes (little endian)
- Previous block hash: 32 bytes (reversed)
- Merkle root: 32 bytes (zeros for Phase A)
- Timestamp: 4 bytes (little endian)
- Bits: 4 bytes (little endian)
- Nonce: 4 bytes (little endian)
- Total: 80 bytes

**Share Submission:**
- Trigger: Hash < target
- Payload: jobId, nonce, hash, deviceId
- Rate limit: Max 10 per second (protocol)
- Validation: Backend cryptographic validation

---

## FIRMWARE VARIANT 1: LEGACY ESP FIRMWARE

**Target:** ESP32 without OLED screen  
**Use Case:** Cost-optimized mining device  
**UI:** Serial output only  
**User Interaction:** AP mode web portal

### Boot Sequence

1. **Initialize Serial** (115200 baud)
   - Print firmware version
   - Print device ID
   - Print boot status

2. **Load Configuration** (Preferences)
   - Read WiFi credentials
   - Read worker name
   - Read wallet address
   - Check registration flag

3. **WiFi Connection Decision**
   - If WiFi credentials missing → AP Mode
   - If WiFi credentials present → Connect to WiFi

4. **WiFi Connection** (if credentials present)
   - Begin WiFi with credentials
   - Wait for connection (timeout: 30s)
   - If timeout → AP Mode
   - If success → Continue

5. **WebSocket Connection**
   - Begin SSL WebSocket to backend
   - Set reconnect interval (5000ms)
   - Register event handlers

6. **Device Registration**
   - Send `device.register` message
   - Include: deviceId, deviceType, firmwareVersion
   - Wait for `device.registered` response
   - Store token from response
   - Set registration flag

7. **Mining Start**
   - Wait for `mining.job` message
   - Start mining loop
   - Begin heartbeat timer

### AP Mode Flow

**Trigger:** WiFi credentials missing or WiFi connection timeout

**AP Configuration:**
- SSID: `Bitmind-Setup`
- Password: `12345678`
- IP: `192.168.4.1` (default)
- Channel: 1
- Hidden: No

**Web Server:**
- Port: 80
- Endpoints:
  - `/` - Setup form
  - `/save` - Save configuration

**Setup Form Fields:**
- WiFi SSID (required)
- WiFi Password (required)
- Worker Name (required, min 3 chars)
- Wallet Address (required, Bitcoin format)

**Save Flow:**
1. Parse URL parameters from `/save` request
2. Validate all fields present
3. Save to Preferences
4. Return HTTP 200 with success message
5. Delay 1 second
6. Reboot ESP32

**User Experience:**
- User connects to `Bitmind-Setup` WiFi
- User opens browser to `http://192.168.4.1`
- User fills form and submits
- Device reboots and connects to user's WiFi
- Device registers with backend automatically

### QR Onboarding Flow

**Status:** NOT IMPLEMENTED in Legacy Firmware

**Rationale:** No screen to display QR code

**Alternative:** AP mode web portal (above)

### WiFi Provisioning

**Method:** AP mode web portal (see above)

**Storage:** Preferences NV storage

**Validation:**
- SSID: Non-empty string
- Password: Non-empty string
- Worker: Min 3 characters
- Wallet: Bitcoin address format (backend validates)

**Fallback:** If WiFi connection fails after provisioning, return to AP mode

### Device Registration

**Protocol Message:**
```json
{
  "type": "device.register",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "deviceType": "miner",
  "firmwareVersion": "1.0.0",
  "capabilities": {
    "oled": false,
    "wifi": true,
    "stratum": true
  }
}
```

**Expected Response:**
```json
{
  "type": "device.registered",
  "status": "accepted",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "token": "32-char-auth-token",
  "serverTime": 1717891200
}
```

**Registration Flow:**
1. WebSocket connected
2. Send `device.register` immediately
3. Wait for `device.registered` response
4. Store token in Preferences
5. Set registration flag in Preferences
6. Log success to Serial

**Re-registration:**
- On WebSocket reconnect
- Send `device.register` again
- Backend validates existing registration
- Token may be refreshed

### Worker Identity Handling

**Canonical Model Compliance:**
- Worker name is primary identity
- Stored in Preferences as `worker`
- Sent in registration message
- Displayed in dashboard
- No secondary naming systems

**Default Value:** `worker-1` (if not set)

**Validation:**
- Min 3 characters
- Alphanumeric + hyphen + underscore
- No spaces
- Backend validates format

**Persistence:**
- Stored in Preferences
- Survives reboots
- Survives firmware updates (if namespace preserved)

### Mining Workflow

**Job Reception:**
- Message type: `mining.job`
- Parse: jobId, data, target, difficulty
- Store job in memory
- Set mining flag to true
- Reset nonce to 0
- Log job details to Serial

**Mining Loop:**
- Check mining flag
- Check interval (100ms)
- Build block header with current nonce
- Double SHA256 hash
- Compare hash to target
- If valid → Submit share
- Increment nonce
- Calculate hashrate
- Log progress every 1000 hashes

**Share Submission:**
- Message type: `mining.share`
- Payload: deviceId, jobId, nonce, hash
- Send via WebSocket
- Log to Serial
- Wait for `mining.share.result`

**Share Result Handling:**
- Message type: `mining.share.result`
- Parse: accepted, reason
- If accepted → Increment accepted count
- If rejected → Increment rejected count
- Log result to Serial

**Job Update:**
- New `mining.job` message
- Replace current job
- Reset nonce
- Continue mining

### Heartbeat Workflow

**Interval:** 10 seconds

**Message:**
```json
{
  "type": "device.heartbeat",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "uptime": 3600,
  "wifiRssi": -45
}
```

**Payload:**
- deviceId: Hardware ID
- uptime: Seconds since boot
- wifiRssi: Signal strength (-100 to 0)

**Expected Response:**
```json
{
  "type": "device.heartbeat.ack",
  "systemState": {
    "status": "ok",
    "mode": "LIVE",
    "rpc": "CONNECTED",
    "mining": "LIVE_MINING"
  }
}
```

**Response Handling:**
- Parse system state
- Log to Serial
- No action required (informational)

### Reconnect Workflow

**WebSocket Disconnect:**
- Set mining flag to false
- Log disconnect to Serial
- Wait for reconnect interval (5s)
- Attempt reconnect automatically

**Reconnect Strategy:**
- Interval: 5s, 10s, 20s, 30s (max)
- Max attempts: Unlimited
- On success: Re-register device
- On success: Resume mining (if job active)

**WiFi Disconnect:**
- Set mining flag to false
- Log disconnect to Serial
- Attempt WiFi reconnect (10s interval)
- If WiFi reconnects: Reconnect WebSocket
- If WiFi fails after 3 attempts: Reboot

**Boot Loop Protection:**
- Track reboot count in Preferences
- If > 5 reboots in 5 minutes: Safe mode
- Safe mode: AP mode only, no auto-connect
- Reset reboot count after 10 minutes uptime

### Error Recovery

**WebSocket Error:**
- Log error to Serial
- Attempt reconnect
- Continue normal operation

**JSON Parse Error:**
- Log error to Serial
- Ignore message
- Continue normal operation

**Mining Job Error:**
- Log error to Serial
- Request new job (send stats)
- Continue with current job if valid

**Share Submit Error:**
- Log error to Serial
- Discard share
- Continue mining

**Memory Error:**
- Log to Serial
- Free unused objects
- Continue operation
- Consider reboot if critical

**Watchdog:**
- Hardware watchdog: 30s timeout
- Feed watchdog in main loop
- Reboot if watchdog triggers

### Configuration Storage

**Preferences Namespace:** `bitmind`

**Keys:**
- `ssid` - String (WiFi SSID)
- `pass` - String (WiFi password)
- `worker` - String (Worker name)
- `wallet` - String (Wallet address)
- `registered` - Bool (Registration flag)
- `token` - String (Auth token)
- `reboot_count` - Int (Reboot counter)
- `last_reboot` - Int (Last reboot timestamp)

**Read/Write:**
- Begin: `prefs.begin("bitmind", true/false)`
- End: `prefs.end()`
- True = read-only
- False = read-write

**Clear All:**
- `prefs.clear()`
- Used in safe mode or factory reset

### Future OTA Compatibility

**OTA Requirements:**
- WiFi connection required
- Sufficient flash space (partition layout)
- Stable power during update
- Backend OTA endpoint (Phase B)

**Partition Layout:**
- App partition: 1.4MB
- OTA partition: 1.4MB
- NVS partition: 20KB
- Phy init: 4KB

**Update Flow (Phase B):**
1. Check for update via API
2. Download firmware to OTA partition
3. Verify signature
4. Set boot partition to OTA
5. Reboot
6. Rollback on failure

**Configuration Migration:**
- Preserve Preferences namespace
- Migrate keys if schema changes
- Default values for new keys
- Backward compatibility for old keys

---

## FIRMWARE VARIANT 2: OLED FIRMWARE

**Target:** ESP32 with OLED screen (SSD1306 or similar)  
**Use Case:** Enhanced UX mining device  
**UI:** OLED screen + Serial output  
**User Interaction:** AP mode web portal + QR onboarding

### Boot Sequence

1. **Initialize Serial** (115200 baud)
   - Print firmware version
   - Print device ID
   - Print boot status

2. **Initialize OLED**
   - I2C address: 0x3C (default)
   - Resolution: 128x64
   - Clear screen
   - Display boot logo

3. **Load Configuration** (Preferences)
   - Read WiFi credentials
   - Read worker name
   - Read wallet address
   - Check registration flag

4. **WiFi Connection Decision**
   - If WiFi credentials missing → AP Mode + QR Display
   - If WiFi credentials present → Connect to WiFi

5. **WiFi Connection** (if credentials present)
   - Begin WiFi with credentials
   - Display "Connecting..." on OLED
   - Wait for connection (timeout: 30s)
   - If timeout → AP Mode + QR Display
   - If success → Display "Connected" on OLED

6. **WebSocket Connection**
   - Begin SSL WebSocket to backend
   - Display "Registering..." on OLED
   - Set reconnect interval (5000ms)
   - Register event handlers

7. **Device Registration**
   - Send `device.register` message
   - Include: deviceId, deviceType, firmwareVersion
   - Wait for `device.registered` response
   - Store token from response
   - Set registration flag
   - Display "Registered" on OLED

8. **Mining Start**
   - Wait for `mining.job` message
   - Display "Mining" on OLED
   - Start mining loop
   - Begin heartbeat timer
   - Begin OLED update loop

### AP Mode Flow

**Trigger:** WiFi credentials missing or WiFi connection timeout

**AP Configuration:**
- SSID: `Bitmind-Setup`
- Password: `12345678`
- IP: `192.168.4.1` (default)
- Channel: 1
- Hidden: No

**OLED Display in AP Mode:**
- Line 1: "BITMIND SETUP"
- Line 2: "IP: 192.168.4.1"
- Line 3: "Connect WiFi"
- Line 4: "Scan QR or open browser"

**Web Server:**
- Port: 80
- Endpoints:
  - `/` - Setup form
  - `/save` - Save configuration
  - `/qr` - QR code image (optional)

**Setup Form Fields:**
- WiFi SSID (required)
- WiFi Password (required)
- Worker Name (required, min 3 chars)
- Wallet Address (required, Bitcoin format)

**Save Flow:**
1. Parse URL parameters from `/save` request
2. Validate all fields present
3. Save to Preferences
4. Return HTTP 200 with success message
5. Display "Saved. Rebooting..." on OLED
6. Delay 1 second
7. Reboot ESP32

**User Experience:**
- User connects to `Bitmind-Setup` WiFi
- User sees OLED with setup instructions
- User scans QR code (optional) or opens browser
- User fills form and submits
- Device reboots and connects to user's WiFi
- Device registers with backend automatically
- OLED shows mining status

### QR Onboarding Flow

**QR Code Content:**
```
https://getbitmind.com/setup?device=esp32-A1B2C3D4E5F6
```

**QR Display:**
- Shown on OLED in AP mode
- Scannable by mobile phone
- Opens setup page in browser
- Pre-fills device ID

**Setup Page (Backend):**
- URL: `https://getbitmind.com/setup`
- Parameters: device ID
- Form fields: WiFi SSID, Password, Worker, Wallet
- Submit via API to backend
- Backend sends configuration to device via WebSocket

**Alternative Flow (Direct):**
- User opens setup page manually
- Enters device ID manually
- Fills form
- Backend sends config to device

**Configuration Delivery:**
- Backend sends `device.config` message via WebSocket
- Device saves to Preferences
- Device reboots
- Device connects to user's WiFi

**Status:** PROPOSED for Phase A completion

### WiFi Provisioning

**Method 1:** AP mode web portal (see above)

**Method 2:** QR onboarding (see above)

**Storage:** Preferences NV storage

**Validation:**
- SSID: Non-empty string
- Password: Non-empty string
- Worker: Min 3 characters
- Wallet: Bitcoin address format (backend validates)

**Fallback:** If WiFi connection fails after provisioning, return to AP mode

### Device Registration

**Protocol Message:**
```json
{
  "type": "device.register",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "deviceType": "oled_miner",
  "firmwareVersion": "1.0.0",
  "capabilities": {
    "oled": true,
    "wifi": true,
    "stratum": true
  }
}
```

**Expected Response:**
```json
{
  "type": "device.registered",
  "status": "accepted",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "token": "32-char-auth-token",
  "serverTime": 1717891200
}
```

**Registration Flow:**
1. WebSocket connected
2. Send `device.register` immediately
3. Display "Registering..." on OLED
4. Wait for `device.registered` response
5. Store token in Preferences
6. Set registration flag in Preferences
7. Display "Registered" on OLED
8. Log success to Serial

**Re-registration:**
- On WebSocket reconnect
- Send `device.register` again
- Backend validates existing registration
- Token may be refreshed

### Worker Identity Handling

**Canonical Model Compliance:**
- Worker name is primary identity
- Stored in Preferences as `worker`
- Sent in registration message
- Displayed on OLED (line 1)
- Displayed in dashboard
- No secondary naming systems

**Default Value:** `worker-1` (if not set)

**Validation:**
- Min 3 characters
- Alphanumeric + hyphen + underscore
- No spaces
- Backend validates format

**Persistence:**
- Stored in Preferences
- Survives reboots
- Survives firmware updates (if namespace preserved)

**OLED Display:**
- Line 1: Worker name (truncated to 12 chars)
- Updated on registration
- Updated on config change

### Mining Workflow

**Job Reception:**
- Message type: `mining.job`
- Parse: jobId, data, target, difficulty
- Store job in memory
- Set mining flag to true
- Reset nonce to 0
- Log job details to Serial
- Update OLED: "Mining"

**Mining Loop:**
- Check mining flag
- Check interval (100ms)
- Build block header with current nonce
- Double SHA256 hash
- Compare hash to target
- If valid → Submit share
- Increment nonce
- Calculate hashrate
- Log progress every 1000 hashes
- Update OLED every 5 seconds

**OLED Mining Display:**
- Line 1: Worker name
- Line 2: Hash rate (H/s)
- Line 3: Accepted shares
- Line 4: Temperature (°C)

**Share Submission:**
- Message type: `mining.share`
- Payload: deviceId, jobId, nonce, hash
- Send via WebSocket
- Log to Serial
- Flash OLED on submission
- Wait for `mining.share.result`

**Share Result Handling:**
- Message type: `mining.share.result`
- Parse: accepted, reason
- If accepted → Increment accepted count
- If rejected → Increment rejected count
- Log result to Serial
- Update OLED

**Job Update:**
- New `mining.job` message
- Replace current job
- Reset nonce
- Continue mining
- Update OLED

### Heartbeat Workflow

**Interval:** 10 seconds

**Message:**
```json
{
  "type": "device.heartbeat",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "uptime": 3600,
  "wifiRssi": -45
}
```

**Payload:**
- deviceId: Hardware ID
- uptime: Seconds since boot
- wifiRssi: Signal strength (-100 to 0)

**Expected Response:**
```json
{
  "type": "device.heartbeat.ack",
  "systemState": {
    "status": "ok",
    "mode": "LIVE",
    "rpc": "CONNECTED",
    "mining": "LIVE_MINING"
  }
}
```

**Response Handling:**
- Parse system state
- Log to Serial
- Update OLED based on state
- Map state to display message

**OLED State Display:**
- LIVE: "MINING ACTIVE" (green)
- FALLBACK: "FALLBACK MODE" (yellow)
- IDLE: "IDLE" (white)
- ERROR: "ERROR" (red)

### Reconnect Workflow

**WebSocket Disconnect:**
- Set mining flag to false
- Log disconnect to Serial
- Display "Disconnected" on OLED
- Wait for reconnect interval (5s)
- Attempt reconnect automatically
- Display "Reconnecting..." on OLED

**Reconnect Strategy:**
- Interval: 5s, 10s, 20s, 30s (max)
- Max attempts: Unlimited
- On success: Re-register device
- On success: Resume mining (if job active)
- Display "Connected" on OLED

**WiFi Disconnect:**
- Set mining flag to false
- Log disconnect to Serial
- Display "WiFi Lost" on OLED
- Attempt WiFi reconnect (10s interval)
- If WiFi reconnects: Reconnect WebSocket
- If WiFi fails after 3 attempts: Reboot
- Display "Rebooting..." on OLED

**Boot Loop Protection:**
- Track reboot count in Preferences
- If > 5 reboots in 5 minutes: Safe mode
- Safe mode: AP mode only, no auto-connect
- Display "SAFE MODE" on OLED
- Reset reboot count after 10 minutes uptime

### Error Recovery

**WebSocket Error:**
- Log error to Serial
- Display "WS Error" on OLED
- Attempt reconnect
- Continue normal operation

**JSON Parse Error:**
- Log error to Serial
- Ignore message
- Continue normal operation

**Mining Job Error:**
- Log error to Serial
- Display "Job Error" on OLED
- Request new job (send stats)
- Continue with current job if valid

**Share Submit Error:**
- Log error to Serial
- Discard share
- Continue mining

**Memory Error:**
- Log to Serial
- Display "Mem Error" on OLED
- Free unused objects
- Continue operation
- Consider reboot if critical

**Watchdog:**
- Hardware watchdog: 30s timeout
- Feed watchdog in main loop
- Reboot if watchdog triggers

**OLED Error:**
- Log to Serial
- Continue operation (OLED non-critical)
- Attempt OLED reinit every 60 seconds

### Configuration Storage

**Preferences Namespace:** `bitmind`

**Keys:**
- `ssid` - String (WiFi SSID)
- `pass` - String (WiFi password)
- `worker` - String (Worker name)
- `wallet` - String (Wallet address)
- `registered` - Bool (Registration flag)
- `token` - String (Auth token)
- `reboot_count` - Int (Reboot counter)
- `last_reboot` - Int (Last reboot timestamp)
- `oled_flip` - Bool (OLED flip setting)

**Read/Write:**
- Begin: `prefs.begin("bitmind", true/false)`
- End: `prefs.end()`
- True = read-only
- False = read-write

**Clear All:**
- `prefs.clear()`
- Used in safe mode or factory reset
- Display "Factory Reset" on OLED

### Future OTA Compatibility

**OTA Requirements:**
- WiFi connection required
- Sufficient flash space (partition layout)
- Stable power during update
- Backend OTA endpoint (Phase B)
- OLED progress display

**Partition Layout:**
- App partition: 1.4MB
- OTA partition: 1.4MB
- NVS partition: 20KB
- Phy init: 4KB

**Update Flow (Phase B):**
1. Check for update via API
2. Display "Updating..." on OLED
3. Download firmware to OTA partition
4. Display progress bar on OLED
5. Verify signature
6. Set boot partition to OTA
7. Display "Rebooting..." on OLED
8. Reboot
9. Rollback on failure
10. Display "Update Failed" on OLED

**Configuration Migration:**
- Preserve Preferences namespace
- Migrate keys if schema changes
- Default values for new keys
- Backward compatibility for old keys
- Display "Migrating..." on OLED

---

## PROTOCOL COMPLIANCE

### Device Protocol v1 Compliance

**Both firmware variants MUST:**

- Use protocol version 1.0 exactly
- Implement all required message types
- Follow message schemas exactly
- Validate incoming messages
- Handle version mismatch errors
- Respect rate limits (heartbeat: 1/5s, share: 10/s)
- Use token-based authentication after registration

**Message Type Mapping:**

| Protocol Message | Legacy Firmware | OLED Firmware |
|------------------|-----------------|---------------|
| device.register | ✓ Implemented | ✓ Implemented |
| device.registered | ✓ Handled | ✓ Handled |
| device.heartbeat | ✓ Implemented | ✓ Implemented |
| device.heartbeat.ack | ✓ Handled | ✓ Handled |
| mining.job | ✓ Handled | ✓ Handled |
| mining.share | ✓ Implemented | ✓ Implemented |
| mining.share.result | ✓ Handled | ✓ Handled |
| device.status | ✗ Ignored | ✓ Handled |
| device.error | ✓ Handled | ✓ Handled |

**Device Type Values:**
- Legacy: `miner`
- OLED: `oled_miner`

**Firmware Version Format:** `MAJOR.MINOR.PATCH` (e.g., `1.0.0`)

---

## CANONICAL STATE COMPLIANCE

### Worker Identity Model

**COMPLIANT:**
- Worker name is primary device identity
- Single identity source (Preferences)
- No duplicate naming systems
- No secondary worker mappings
- Displayed in dashboard
- Stored persistently

### Bitcoin Core Architecture

**COMPLIANT:**
- No local Bitcoin Core assumptions
- Mining jobs received from backend
- Backend communicates with remote Bitcoin Core
- Firmware does not communicate with Bitcoin Core directly

### RPC Architecture

**COMPLIANT:**
- No RPC calls from firmware
- RPC handled by backend only
- Firmware receives mining jobs via WebSocket
- Single source of truth: backend

### Phase A Scope

**COMPLIANT:**
- No Phase B features (MoonPay, e-commerce)
- No reward path implementation
- No commerce features
- Focused on mining stability

---

## HISTORICAL REFERENCE

### Proven Functionality from Historical Firmware

**From `FIRMWARE Real SHA256.txt`:**

**AP Mode Implementation:**
- SoftAP with configurable SSID/password
- HTTP server on port 80
- Form-based configuration save
- Reboot after save

**Preferences Storage:**
- NV storage using Preferences library
- Keys: ssid, pass, worker, wallet
- Load/save functions implemented

**Device ID Generation:**
- ESP32 EFuse MAC based
- Format: `esp32-{upper4hex}{lower8hex}`
- Unique per device

**SHA256 Implementation:**
- mbedtls SHA256 library
- Double SHA256 function
- ESP32 3.3.8 compatible

**WebSocket SSL:**
- SSL WebSocket to getbitmind.com:443
- Event handler architecture
- Reconnect interval: 5000ms

**Mining Loop:**
- Real SHA256 hashing
- Nonce increment
- Share condition: hash[0] == 0x00 && hash[1] == 0x00
- Stats reporting

**Heartbeat:**
- 10-second interval
- Device ID, uptime payload
- WebSocket transmission

**Adopted for Production:**
- AP mode flow
- Preferences storage schema
- Device ID generation
- SHA256 implementation
- WebSocket SSL connection
- Mining loop structure
- Heartbeat interval

**Not Adopted:**
- Hardcoded server address (should be configurable)
- Simplified share condition (should use real target)
- Missing OLED support (OLED firmware variant)
- Missing QR onboarding (to be implemented)

---

## SECURITY CONSIDERATIONS

### WiFi Security

- WPA2/WPA3 support
- Password stored in NV storage (encrypted if possible)
- No open WiFi networks
- No default credentials in production

### WebSocket Security

- SSL/TLS required for production
- Certificate validation
- Token-based authentication
- Token rotation on registration

### Configuration Security

- Preferences namespace isolation
- No plaintext secrets if possible
- Factory reset capability
- Safe mode on boot loops

### Firmware Security

- OTA signature verification (Phase B)
- Secure boot (optional, Phase B)
- Flash encryption (optional, Phase B)
- Anti-rollback protection (Phase B)

---

## TESTING REQUIREMENTS

### Unit Tests

- Device ID generation
- SHA256 hashing
- Block header construction
- Preferences read/write
- Message serialization/deserialization

### Integration Tests

- AP mode web server
- WebSocket connection
- Device registration
- Mining job reception
- Share submission
- Heartbeat loop

### Hardware Tests

- WiFi connection stability
- WebSocket reconnect stability
- Mining hash rate accuracy
- OLED display (OLED variant)
- Power consumption
- Thermal performance

### Stress Tests

- 24-hour continuous mining
- WebSocket disconnect/reconnect cycles
- WiFi disconnect/reconnect cycles
- Memory leak detection
- Watchdog verification

---

## DEPLOYMENT REQUIREMENTS

### Build Configuration

- Platform: ESP32
- Framework: Arduino Core
- Board: ESP32 Dev Module
- Flash Size: 4MB (default)
- Partition Scheme: default (with OTA)
- Core Version: 3.3.8+

### Dependencies

- WiFi.h
- WebSocketsClient.h
- ArduinoJson.h
- Preferences.h
- mbedtls/sha256.h
- Wire.h (OLED variant only)
- Adafruit_SSD1306.h (OLED variant only)

### Build Output

- .bin file for flashing
- .elf file for debugging
- Partition table
- Bootloader

### Flashing

- Tool: esptool.py
- Baud rate: 921600
- Port: USB serial
- Verification: Enabled

---

## VERSION HISTORY

**v1.0 (2026-06-08)**
- Initial firmware architecture specification
- Defined Legacy ESP Firmware variant
- Defined OLED Firmware variant
- Protocol v1 compliance
- Canonical state compliance
- Historical reference integration

---

## END OF DOCUMENT
