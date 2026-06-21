# BITMIND F5-P2 ONBOARDING ALIGNMENT CONTRACT

**Phase:** F5-P2 - Onboarding Alignment Implementation  
**Date:** 2026-06-21  
**Status:** IMPLEMENTED  
**Base Commit:** f5ff237 (F5-P1 Identity Architecture)

---

## SECTION 1: REGISTRATION PAYLOAD CONTRACT

### 1.1 device.register Message (ESP32 → Server)

**Direction:** ESP32 → Backend  
**Message Type:** device.register  
**Protocol Version:** 1.0

**Payload Schema:**
```json
{
  "type": "device.register",
  "deviceId": "esp32-a1b2c3d4",
  "deviceType": "miner",
  "firmwareVersion": "1.0.0",
  "workerName": "my-miner-01",
  "walletAddress": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
  "capabilities": {
    "oled": false,
    "wifi": true,
    "stratum": true
  }
}
```

**Field Specifications:**
- `type` (required): "device.register"
- `deviceId` (required): Device identifier, pattern `^esp32-[a-f0-9]{4,12}$`
- `deviceType` (required): Device type, enum ["oled_miner", "miner", "test_client"]
- `firmwareVersion` (required): Firmware version, pattern `^\d+\.\d+\.\d+$`
- `workerName` (optional): Worker name, minLength 3, maxLength 50
- `walletAddress` (optional): Bitcoin wallet address, pattern `^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}$`
- `capabilities` (optional): Device capabilities object
  - `oled` (boolean): OLED screen presence
  - `wifi` (boolean): WiFi capability
  - `stratum` (boolean): Stratum protocol support

**Backward Compatibility:**
- `workerName` and `walletAddress` are optional fields
- Devices without these fields will be registered with null values
- Existing firmware (without these fields) will continue to work
- New firmware (with these fields) will be fully aligned with onboarding

### 1.2 device.registered Message (Server → ESP32)

**Direction:** Backend → ESP32  
**Message Type:** device.registered  
**Protocol Version:** 1.0

**Payload Schema:**
```json
{
  "type": "device.registered",
  "status": "accepted",
  "deviceId": "esp32-a1b2c3d4",
  "token": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "serverTime": 1718985600
}
```

**Field Specifications:**
- `type` (required): "device.registered"
- `status` (required): "accepted"
- `deviceId` (required): Device identifier
- `token` (required): 32-byte hex token (64 characters)
- `serverTime` (required): Server timestamp (Unix epoch)

**Token Lifecycle:**
- Token generated once on first registration
- Token persisted in RegistrationStore (SQLite)
- Token reused on all subsequent connections
- Token survives backend/PM2/VPS restarts

---

## SECTION 2: REGISTRATION FLOW

### 2.1 ESP32 Registration Flow

**Step 1: AP Provisioning**
- Device boots in AP mode
- User connects to "Bitmind-Setup" WiFi
- User configures WiFi credentials
- User configures workerName
- User configures walletAddress
- Configuration saved to NV storage (Preferences)

**Step 2: WiFi Connection**
- Device connects to configured WiFi
- Device generates deviceId from MAC address
- Device loads configuration from NV storage

**Step 3: WebSocket Connection**
- Device connects to backend WebSocket
- Device sends device.register message with:
  - deviceId (from MAC)
  - deviceType (miner)
  - firmwareVersion (1.0.0)
  - workerName (from NV storage)
  - walletAddress (from NV storage)
  - capabilities (oled: false, wifi: true, stratum: true)

**Step 4: Backend Processing**
- Backend validates payload (deviceGateway.validateRegistration)
- Backend checks if device is registered (RegistrationStore.isRegistered)
- If not registered, backend auto-registers ESP32 device
- Backend stores registration in SQLite:
  - deviceId (PK)
  - token (generated once)
  - workerName (from payload)
  - walletAddress (from payload)
  - deviceType (from payload)
  - firmwareVersion (from payload)
  - registeredAt (timestamp)
  - lastSeen (timestamp)

**Step 5: Registration Response**
- Backend sends device.registered message with token
- Device receives token
- Device saves token to NV storage (Preferences)
- Device marks itself as registered

**Step 6: Mining**
- Device receives mining job
- Device starts mining
- Device sends shares
- Device sends telemetry

### 2.2 Virtual Device Registration Flow (Connect Miner)

**Step 1: User Input**
- User opens "Connect Miner" modal in frontend
- User enters walletAddress
- User enters workerName
- User selects deviceType (optional, defaults to esp32)

**Step 2: API Call**
- Frontend POST to /api/miners/connect
- Payload: { walletAddress, workerName, deviceType }

**Step 3: Backend Processing**
- Backend validates walletAddress (Bitcoin address regex)
- Backend validates workerName (minLength 3)
- Backend generates random deviceId (16-byte hex)
- Backend registers device in RegistrationStore:
  - deviceId (generated)
  - token (generated once)
  - workerName (from payload)
  - walletAddress (from payload)
  - deviceType (from payload)
- Backend creates runtime state in state/index.js

**Step 4: Response**
- Backend returns registration data:
  - deviceId
  - workerName
  - walletAddress
  - token
- Backend broadcasts miner_connected WebSocket event

**Step 5: Frontend Display**
- Frontend displays connected miner
- Frontend shows workerName
- Frontend shows walletAddress
- Frontend shows hashrate (when mining starts)

---

## SECTION 3: DATA PERSISTENCE

### 3.1 Firmware NV Storage

**Configuration Structure:**
```cpp
struct Config {
  String ssid;           // WiFi SSID
  String password;       // WiFi password
  String workerName;     // Worker name
  String wallet;         // Wallet address
  bool registered;       // Registration status
  String token;          // Device token
} config;
```

**Persistence:**
- Saved to ESP32 Preferences (NV storage)
- Survives firmware reboots
- Survives power cycles
- Survives factory reset (user-triggered)

### 3.2 Backend SQLite Storage

**registrations Table:**
```sql
CREATE TABLE registrations (
  deviceId TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  workerName TEXT,
  walletAddress TEXT,
  deviceType TEXT,
  firmwareVersion TEXT,
  registeredAt INTEGER NOT NULL,
  lastSeen INTEGER NOT NULL
);
```

**Persistence:**
- File-based database (server/data/registrations.db)
- Survives backend restarts
- Survives PM2 restarts
- Survives VPS reboots
- WAL mode for write concurrency

---

## SECTION 4: BACKWARD COMPATIBILITY

### 4.1 Firmware Compatibility

**Old Firmware (without workerName/walletAddress):**
- Sends device.register without workerName and walletAddress
- Backend accepts registration (fields are optional)
- Backend stores null values for workerName and walletAddress
- Device continues to work normally
- Token lifecycle works normally

**New Firmware (with workerName/walletAddress):**
- Sends device.register with workerName and walletAddress
- Backend accepts registration
- Backend stores workerName and walletAddress
- Device identity is fully aligned with onboarding
- Token lifecycle works normally

### 4.2 API Compatibility

**Existing API Endpoints:**
- /api/miners/connect - No changes
- /api/device/register - No changes
- /api/miners - No changes
- /api/telemetry/:deviceId - No changes

**Response Formats:**
- No changes to response schemas
- workerName and walletAddress included in responses (already supported via joinDeviceState)

### 4.3 Protocol Compatibility

**device.register Message:**
- workerName and walletAddress are optional
- Old devices (without fields) continue to work
- New devices (with fields) get full onboarding alignment

**device.registered Message:**
- No changes
- Token format unchanged
- Response format unchanged

---

## SECTION 5: VALIDATION RULES

### 5.1 workerName Validation

**Rules:**
- minLength: 3 characters
- maxLength: 50 characters
- Pattern: Alphanumeric, hyphens, underscores allowed
- Required for new onboarding flow
- Optional for backward compatibility

**Examples:**
- Valid: "my-miner-01", "worker1", "btc_miner_alpha"
- Invalid: "ab", "a", "worker name with spaces"

### 5.2 walletAddress Validation

**Rules:**
- Pattern: Bitcoin address format
- Supports: Legacy (1), P2SH (3), Bech32 (bc1)
- Length: 26-42 characters
- Required for new onboarding flow
- Optional for backward compatibility

**Examples:**
- Valid: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
- Invalid: "invalid", "123", "0x1234567890abcdef"

---

## SECTION 6: ERROR HANDLING

### 6.1 Registration Errors

**Error Codes:**
- `AUTH_INVALID` - Device not registered (non-ESP32, non-dev-client)
- `VERSION_MISMATCH` - Protocol version mismatch
- `PAYLOAD_INVALID` - Invalid payload format
- `RATE_LIMIT` - Too many registration attempts

**Error Response:**
```json
{
  "type": "device.error",
  "code": "PAYLOAD_INVALID",
  "message": "Invalid device ID format"
}
```

### 6.2 Validation Errors

**workerName Validation Error:**
- API: 400 Bad Request
- Message: "Worker name must be at least 3 characters"

**walletAddress Validation Error:**
- API: 400 Bad Request
- Message: "Invalid Bitcoin wallet address"

---

## SECTION 7: SECURITY CONSIDERATIONS

### 7.1 Token Security

**Token Properties:**
- 32-byte cryptographically random hex string
- Generated once per device identity
- Stored securely in NV storage (firmware)
- Stored securely in SQLite database (backend)
- Never transmitted in plaintext (WebSocket TLS)

### 7.2 Data Privacy

**workerName:**
- User-provided identifier
- Stored in plaintext in database
- Displayed in frontend
- No encryption required (non-sensitive)

**walletAddress:**
- User-provided Bitcoin address
- Stored in plaintext in database
- Displayed in frontend
- Public address (not sensitive private key)

### 7.3 Input Validation

**All Inputs Validated:**
- deviceId format validation
- workerName length validation
- walletAddress format validation
- deviceType enum validation
- firmwareVersion pattern validation

---

## SECTION 8: TESTING SCENARIOS

### 8.1 First Registration (New Device)

**Scenario:**
- Device boots for first time
- User configures workerName and walletAddress
- Device connects to backend
- Device sends device.register with workerName and walletAddress

**Expected Result:**
- Backend auto-registers device
- Backend generates token
- Backend stores workerName and walletAddress
- Device receives token
- Device saves token
- Device starts mining

### 8.2 Reconnect (Existing Device)

**Scenario:**
- Device reboots
- Device reconnects to backend
- Device sends device.register with same workerName and walletAddress

**Expected Result:**
- Backend recognizes device (deviceId)
- Backend retrieves existing token
- Backend sends same token
- Device validates token
- Device continues mining
- No new registration created

### 8.3 Firmware Update (Old to New)

**Scenario:**
- Device registered with old firmware (no workerName/walletAddress)
- Device updates to new firmware
- Device sends device.register with workerName and walletAddress

**Expected Result:**
- Backend recognizes device (deviceId)
- Backend updates registration with workerName and walletAddress
- Backend preserves existing token
- Device continues mining
- Registration now fully aligned

### 8.4 Factory Reset

**Scenario:**
- User triggers factory reset
- Device clears NV storage
- Device boots in AP mode
- User reconfigures workerName and walletAddress
- Device connects to backend

**Expected Result:**
- Backend recognizes device (deviceId unchanged)
- Backend updates registration with new workerName and walletAddress
- Backend preserves existing token
- Device continues mining
- Registration updated with new identity

---

## SECTION 9: IMPLEMENTATION STATUS

### 9.1 Completed

**Firmware:**
- ✅ sendDeviceRegister() updated to include workerName and walletAddress
- ✅ Config struct already includes workerName and wallet
- ✅ NV storage already supports workerName and wallet

**Backend:**
- ✅ RegistrationStore already supports workerName and walletAddress
- ✅ SQLite schema includes workerName and walletAddress columns
- ✅ handlers.js already extracts workerName and walletAddress from payload
- ✅ routes.js already supports workerName and walletAddress

**Protocol:**
- ✅ device-protocol-v1.json updated to include workerName and walletAddress
- ✅ Fields marked as optional for backward compatibility
- ✅ Validation rules defined

### 9.2 Pending

**Frontend:**
- ⏳ Connect Miner modal already collects workerName and walletAddress
- ⏳ No UI changes required (already aligned)

**Testing:**
- ⏳ End-to-end testing required
- ⏳ Firmware deployment testing required
- ⏳ Backward compatibility testing required

---

## SECTION 10: DEPLOYMENT CHECKLIST

### 10.1 Pre-Deployment

- [ ] Firmware compiled with workerName and walletAddress support
- [ ] Protocol schema updated in docs/device-protocol-v1.json
- [ ] Backend deployed with F5-P1 (RegistrationStore)
- [ ] Database schema verified (workerName and walletAddress columns exist)
- [ ] Validation rules tested

### 10.2 Deployment

- [ ] Deploy firmware to test device
- [ ] Verify device.register includes workerName and walletAddress
- [ ] Verify backend stores workerName and walletAddress
- [ ] Verify token lifecycle works correctly
- [ ] Verify reconnection preserves token

### 10.3 Post-Deployment

- [ ] Monitor registration logs
- [ ] Monitor database for workerName and walletAddress values
- [ ] Verify backward compatibility with old firmware
- [ ] Verify Connect Miner flow still works

---

## CONCLUSION

**Status:** ✅ ONBOARDING ALIGNMENT IMPLEMENTED

**Summary:**
F5-P2 successfully implemented onboarding alignment by adding workerName and walletAddress to the device.register payload. The implementation maintains full backward compatibility (fields are optional) while enabling new firmware to provide complete onboarding identity. RegistrationStore already supported these fields, so no backend changes were required beyond the F5-P1 identity architecture. Protocol schema updated to document the new fields. Firmware updated to send workerName and walletAddress from NV storage. The onboarding flow is now fully aligned from firmware → backend → database.

**Next Steps:**
- Deploy firmware to test devices
- Verify end-to-end onboarding flow
- Monitor production for any issues
- Consider UI naming changes (Connect Miner → Add Device)

**Production Ready:** YES (pending testing)
