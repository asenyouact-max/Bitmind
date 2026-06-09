# BITMIND BACKEND CONTRACT FREEZE VERIFICATION REPORT

**Date:** 2026-06-09  
**Phase:** Phase A  
**Task:** Backend Contract Freeze Verification  
**Status:** FAILED - Protocol NOT frozen

---

## SECTION 1 - MESSAGE CONTRACT AUDIT

### Firmware → Backend Messages

#### 1. register (device.register)

**Schema:**
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

**Required Fields:**
- type (const: "device.register")
- deviceId (string, pattern: ^esp32-[a-f0-9]{4,12}$)
- deviceType (enum: ["oled_miner", "miner", "test_client"])
- firmwareVersion (string, pattern: ^\d+\.\d+\.\d+$)

**Optional Fields:**
- capabilities (object: oled, wifi, stratum booleans)

**Source File:** docs/device-protocol-v1.json

**Backend Implementation:** server/ws/handlers.js (register handler, lines 50-172)

**Current Implementation Status:** PASS
- Protocol v1 compliant
- Backend validates via deviceGateway.validateRegistration
- Backend checks DeviceRegistry for pre-registration
- Backend sends device.registered response with token
- Backend stores workerName with fallback logic

---

#### 2. heartbeat (device.heartbeat)

**Schema:**
```json
{
  "type": "device.heartbeat",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "uptime": 3600,
  "wifiRssi": -45
}
```

**Required Fields:**
- type (const: "device.heartbeat")
- deviceId (string)
- uptime (integer, minimum: 0)
- wifiRssi (integer, maximum: 0, minimum: -100)

**Optional Fields:** none

**Source File:** docs/device-protocol-v1.json

**Backend Implementation:** server/ws/handlers.js (heartbeat handler, lines 176-201)

**Current Implementation Status:** PASS
- Protocol v1 compliant
- Backend validates deviceId
- Backend updates device state via state module
- Backend sends device.heartbeat.ack response via deviceGateway

---

#### 3. share (mining.share)

**Schema:**
```json
{
  "type": "mining.share",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "jobId": "a1b2c3d4e5f6",
  "nonce": "a1b2c3d4",
  "hash": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

**Required Fields:**
- type (const: "mining.share")
- deviceId (string)
- jobId (string)
- nonce (string, pattern: ^[a-f0-9]{8}$)
- hash (string, pattern: ^[a-f0-9]{64}$)

**Optional Fields:** none

**Source File:** docs/device-protocol-v1.json

**Backend Implementation:** server/ws/handlers.js (shareFound handler, lines 244-314)

**Current Implementation Status:** PASS
- Protocol v1 compliant
- Backend validates share format
- Backend validates via BitcoinValidation.validateShare
- Backend rebuilds block header and recomputes hash
- Backend sends mining.share.result response

---

#### 4. telemetry (stats)

**Schema:**
```json
{
  "type": "mining_stats",
  "deviceId": "esp32-A1B2C3D4E5F6",
  "jobId": "a1b2c3d4e5f6",
  "hashrate": 100.5,
  "acceptedShares": 50,
  "rejectedShares": 2,
  "uptime": 3600
}
```

**Required Fields:**
- type (string)
- deviceId (string)
- hashrate (number)
- accepted (number)
- rejected (number)
- uptime (number)

**Optional Fields:** none

**Source File:** server/ws/handlers.js (stats handler, lines 204-241)

**Backend Implementation:** server/ws/handlers.js (stats handler, lines 204-241)

**Current Implementation Status:** PARTIAL
- NOT defined in protocol v1
- Backend handles stats message
- Backend sends device.status response (OLED use case)
- Firmware architecture mentions stats but protocol v1 doesn't define it
- **Issue:** Stats message not protocol compliant

---

### Backend → Firmware Messages

#### 1. mining_job

**Protocol v1 Schema:**
```json
{
  "type": "mining.job",
  "jobId": "a1b2c3d4e5f6",
  "algorithm": "sha256",
  "data": "0000000000000000000000000000000000000000000000000000000000000000",
  "target": "00000ffffffffffffffffffffffffffffffffffffffff",
  "difficulty": 1
}
```

**Protocol v1 Required Fields:**
- type (const: "mining.job")
- jobId (string, pattern: ^[a-f0-9]{8,32}$)
- algorithm (const: "sha256")
- data (string, pattern: ^[a-f0-9]+$)
- target (string, pattern: ^[a-f0-9]+$)
- difficulty (number, minimum: 1)

**Backend Implementation Schema:** server/services/jobManager.js (lines 52-72)
```json
{
  "type": "mining_job",
  "sessionId": "uuid",
  "jobId": "uuid",
  "height": 948958,
  "target": "00000ffffffffffffffffffffffffffffffffffffffff",
  "pseudoTarget": null,
  "pseudoMining": false,
  "createdAt": 1717891200,
  "version": 1,
  "previousblockhash": "0000000000000000000000000000000000000000000000000000000000000000",
  "merkleroot": "",
  "nbits": 386439200,
  "ntime": 1717891200,
  "coinbasevalue": 0,
  "coinbaseaddress": "",
  "transactions": [],
  "rules": ["segwit"],
  "deviceContext": {
    "sessionId": "uuid",
    "nonceStart": 0,
    "nonceEnd": 1000000,
    "extranonce1": "hex"
  }
}
```

**Firmware Architecture Expected:** BITMIND_FIRMWARE_ARCHITECTURE.md (lines 311-318)
- jobId
- data (block header data)
- target
- difficulty
- version
- previousblockhash
- curtime
- bits
- nonceStart

**Current Implementation Status:** FAIL
- Backend does NOT provide "data" field (required by protocol v1)
- Backend does NOT provide "algorithm" field (required by protocol v1)
- Backend does NOT provide "difficulty" field (required by protocol v1)
- Backend provides extra fields: sessionId, height, pseudoTarget, pseudoMining, createdAt, merkleroot, coinbasevalue, coinbaseaddress, transactions, rules, deviceContext
- Backend provides individual Bitcoin fields instead of "data" field
- Firmware expects "data" field for block header construction
- **CRITICAL:** Schema mismatch between protocol v1, backend, and firmware architecture

---

#### 2. system_state (device.heartbeat.ack)

**Schema:**
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

**Required Fields:**
- type (const: "device.heartbeat.ack")
- systemState (object with status, mode, rpc, mining)

**Optional Fields:** none

**Source File:** docs/device-protocol-v1.json

**Backend Implementation:** server/gateway/deviceGateway.js (createHeartbeatAck)

**Current Implementation Status:** PASS
- Protocol v1 compliant
- Backend sends correct schema
- Firmware expects correct schema

---

#### 3. configuration (device.config)

**Schema:** NOT DEFINED

**Required Fields:** NOT DEFINED

**Optional Fields:** NOT DEFINED

**Source File:** BITMIND_FIRMWARE_ARCHITECTURE.md (proposed for QR onboarding, line 634)

**Backend Implementation:** NOT IMPLEMENTED

**Current Implementation Status:** FAIL
- Not implemented in backend
- Protocol v1 does not define device.config
- Firmware architecture proposes device.config for QR onboarding
- **CRITICAL:** QR onboarding cannot work without this

---

## SECTION 2 - WORKER IDENTITY AUDIT

### Registration Flow

**Firmware → Backend:**
- Firmware sends workerName in device.register message
- Backend receives workerName in handlers.js (lines 120-135)
- Backend validates workerName format (min 3 chars, alphanumeric + hyphen + underscore)
- Backend provides fallback if workerName missing: `miner-{deviceId.substring(0, 8)}`
- Backend stores workerName in state module

**Status:** PASS - Canonical model compliant

### Storage Flow

**Firmware:**
- Stores workerName in Preferences NV storage as `worker`
- Survives reboots
- Survives firmware updates (if namespace preserved)

**Backend:**
- Stores workerName in state module
- Persists across reboots
- No duplicate naming systems

**Status:** PASS - Canonical model compliant

### Dashboard Flow

**Backend:**
- Displays workerName in dashboard
- Frontend shows workerName as device name
- WorkerName is primary display identity

**Status:** PASS - Canonical model compliant

### Mining Flow

**Backend:**
- WorkerName used for identification
- Mining uses deviceId for share submission
- WorkerName not included in mining messages

**Status:** PASS - Canonical model compliant

### Conflicting Identity Systems

**Analysis:**
- WorkerName is primary identity (canonical model)
- deviceId is secondary identity (hardware identifier)
- No duplicate naming systems found
- No secondary worker mappings found

**Status:** PASS - No conflicts

---

## SECTION 3 - DEVICE IDENTITY AUDIT

### Registration Usage

**Firmware → Backend:**
- deviceId required in device.register
- Format: `esp32-{upper4hex}{lower8hex}`
- Source: ESP32 EFuse MAC address

**Backend:**
- Validates deviceId format (esp32-[a-f0-9]{4,12})
- Uses deviceId for device tracking
- Checks DeviceRegistry for pre-registration

**Status:** PASS

### Dashboard Usage

**Backend:**
- Displays deviceId in dashboard
- Frontend shows deviceId as device ID
- deviceId used for device identification

**Status:** PASS

### Mining Usage

**Backend:**
- deviceId required in mining.share
- deviceId required in device.heartbeat
- deviceId used for share validation
- deviceId used for session context

**Status:** PASS

### Primary vs Secondary Identity

**Analysis:**
- workerName is primary identity (canonical model)
- deviceId is secondary identity (hardware identifier)
- No conflict found
- Correct hierarchy maintained

**Status:** PASS

---

## SECTION 4 - SHARE SUBMISSION AUDIT

### Message Schema

**Protocol v1:**
- type (const: "mining.share")
- deviceId (string)
- jobId (string)
- nonce (string, pattern: ^[a-f0-9]{8}$)
- hash (string, pattern: ^[a-f0-9]{64}$)

**Backend Expects:**
- type, deviceId, jobId, nonce, hash (validation.isValidShare, lines 29-34)

**Firmware Sends:**
- type, deviceId, jobId, nonce, hash

**Status:** PASS - Schema aligned

### Validation Path

**Backend Flow:**
1. Receives share in handlers.js (shareFound handler, lines 244-314)
2. Validates share format (validation.isValidShare)
3. Gets device context from sessionManager
4. Validates share via BitcoinValidation.validateShare
5. Rebuilds block header (shareValidator.js, lines 25-62)
6. Recomputes double SHA256 hash (shareValidator.js, lines 69-78)
7. Compares recomputed hash to submitted hash
8. Compares hash to target
9. Returns validation result

**Status:** PASS - Validation path complete

### Processing Path

**Backend Flow:**
1. Updates device state (lastSeen, status, nonceCounter)
2. Increments acceptedShares or rejectedShares
3. Records share in state module
4. Sends mining.share.result response via deviceGateway

**Status:** PASS - Processing path complete

### Compatibility with Firmware Architecture

**Firmware Expects:**
- mining.share.result with jobId, accepted, reason

**Backend Sends:**
- mining.share.result with jobId, accepted, reason (deviceGateway.createShareResult)

**Status:** PASS - Compatible

---

## SECTION 5 - MINING JOB AUDIT

### Fields Provided

**Protocol v1 Requires:**
- type, jobId, algorithm, data, target, difficulty

**Backend Provides:**
- type, sessionId, jobId, height, target, pseudoTarget, pseudoMining, createdAt, version, previousblockhash, merkleroot, nbits, ntime, coinbasevalue, coinbaseaddress, transactions, rules, deviceContext

**Firmware Expects:**
- type, jobId, data, target, difficulty, version, previousblockhash, curtime, bits, nonceStart

**Status:** FAIL - Schema mismatch

**Issues:**
- Backend does NOT provide "data" field (required by protocol v1)
- Backend does NOT provide "algorithm" field (required by protocol v1)
- Backend does NOT provide "difficulty" field (required by protocol v1)
- Backend provides extra fields not in protocol v1
- Firmware expects "data" field for block header construction
- Backend provides individual Bitcoin fields instead of "data" field

### Difficulty Information

**Protocol v1:**
- difficulty (number, minimum: 1)

**Backend:**
- target (hex string)
- pseudoTarget (hex string)
- pseudoMining (boolean)

**Firmware:**
- target (hex string)
- pseudoTarget (hex string for testing)

**Status:** PARTIAL - Protocol v1 defines difficulty as number, but backend uses target (hex string)

### Job Identifier Handling

**Protocol v1:**
- jobId (string, pattern: [a-f0-9]{8,32})

**Backend:**
- jobId (UUID)
- sessionId (UUID)

**Firmware:**
- jobId (string)

**Status:** PASS - jobId handling compatible

### Compatibility with Firmware Architecture

**Firmware Expects:**
- jobId, data, target, difficulty, version, previousblockhash, curtime, bits, nonceStart

**Backend Provides:**
- jobId, sessionId, height, target, pseudoTarget, pseudoMining, createdAt, version, previousblockhash, merkleroot, nbits, ntime, coinbasevalue, coinbaseaddress, transactions, rules, deviceContext

**Status:** FAIL - Incompatible

**Issues:**
- Backend provides sessionId, height, pseudoTarget, pseudoMining, createdAt, merkleroot, coinbasevalue, coinbaseaddress, transactions, rules, deviceContext which firmware doesn't expect
- Firmware expects "data" field which backend doesn't provide
- Firmware expects "difficulty" field which backend doesn't provide
- Firmware expects "nonceStart" which backend provides in deviceContext

---

## SECTION 6 - CONTRACT FREEZE ASSESSMENT

### Critical Issues

#### 1. mining.job Schema Mismatch (CRITICAL)

**Protocol v1 Schema:**
- type, jobId, algorithm, data, target, difficulty

**Backend Schema:**
- type, sessionId, jobId, height, target, pseudoTarget, pseudoMining, createdAt, version, previousblockhash, merkleroot, nbits, ntime, coinbasevalue, coinbaseaddress, transactions, rules, deviceContext

**Firmware Expected Schema:**
- type, jobId, data, target, difficulty, version, previousblockhash, curtime, bits, nonceStart

**Issues:**
- Backend does NOT provide "data" field (required by protocol v1)
- Backend does NOT provide "algorithm" field (required by protocol v1)
- Backend does NOT provide "difficulty" field (required by protocol v1)
- Backend provides extra fields not in protocol v1
- Firmware expects "data" field for block header construction
- Backend provides individual Bitcoin fields instead of "data" field

**Impact:** Firmware cannot receive mining jobs correctly

**Required Fix:**
- Option A: Backend must provide "data", "algorithm", "difficulty" fields per protocol v1
- Option B: Update protocol v1 to match backend implementation
- Option C: Update backend to match protocol v1

---

#### 2. device.config Not Implemented (CRITICAL)

**Firmware Architecture:**
- Proposes device.config message for QR onboarding
- Backend sends device.config via WebSocket when configuration is updated
- Device saves to Preferences and reboots

**Backend:**
- device.config message NOT implemented
- Protocol v1 does NOT define device.config

**Impact:** QR onboarding cannot work

**Required Fix:**
- Implement device.config message in backend
- Define device.config schema in protocol v1
- Backend must send device.config via WebSocket

---

#### 3. telemetry/stats Not in Protocol v1 (MEDIUM)

**Backend:**
- Handles stats message
- Sends device.status response

**Protocol v1:**
- Does NOT define stats message
- Does NOT define device.status message (only for OLED use case)

**Impact:** Stats message not protocol compliant

**Required Fix:**
- Add stats message to protocol v1
- OR remove stats handling from backend and firmware

---

### Assessment Result

**NO** - Protocol is NOT frozen for Phase A firmware implementation

**Reason:**
- Critical schema mismatch in mining.job
- device.config not implemented
- telemetry/stats not protocol compliant

---

## SECTION 7 - CANONICAL STATE UPDATE REQUEST

### Recommended Actions

#### 1. Fix mining.job Schema Mismatch

**Option A: Align Backend to Protocol v1**
- Backend must provide "data" field (hex string of block header data)
- Backend must provide "algorithm" field (const: "sha256")
- Backend must provide "difficulty" field (number)
- Remove extra fields or make them optional

**Option B: Update Protocol v1 to Match Backend**
- Add sessionId, height, pseudoTarget, pseudoMining, createdAt to protocol v1
- Add version, previousblockhash, merkleroot, nbits, ntime to protocol v1
- Add coinbasevalue, coinbaseaddress, transactions, rules to protocol v1
- Add deviceContext to protocol v1
- Remove "data", "algorithm", "difficulty" from protocol v1
- Update firmware architecture to match

**Recommendation:** Option B - Update protocol v1 to match backend implementation, as backend provides richer Bitcoin-specific fields that firmware architecture already expects.

---

#### 2. Implement device.config

**Required Changes:**
- Add device.config message to protocol v1
- Define device.config schema (ssid, pass, worker, wallet)
- Implement device.config handler in backend
- Backend must send device.config via WebSocket when configuration is updated
- Update firmware architecture to match protocol v1

---

#### 3. Define telemetry/stats in Protocol v1

**Required Changes:**
- Add mining_stats message to protocol v1
- Define mining_stats schema (deviceId, hashrate, acceptedShares, rejectedShares, uptime)
- OR remove stats handling from backend and firmware

**Recommendation:** Add mining_stats to protocol v1, as it provides useful telemetry.

---

### Canonical State Updates Required

**Section: FIRMWARE ARCHITECTURE**
- Update to reflect protocol v1 changes
- Update mining.job schema to match protocol v1
- Add device.config schema
- Add mining_stats schema

**Section: KNOWN COMPLETED FEATURES**
- Add "Backend protocol frozen for Phase A" (after fixes)

**Section: PHASE A OBJECTIVES**
- Update FIRMWARE STABILITY to reflect protocol freeze status

---

## CONCLUSION

**Status:** FAILED - Protocol NOT frozen

**Blockers:**
1. mining.job schema mismatch (CRITICAL)
2. device.config not implemented (CRITICAL)
3. telemetry/stats not protocol compliant (MEDIUM)

**Required Before Firmware Implementation:**
1. Align mining.job schema between protocol v1, backend, and firmware architecture
2. Implement device.config message
3. Define telemetry/stats in protocol v1

**Estimated Time to Fix:** 2-4 hours

**Recommendation:** Fix protocol mismatches before beginning firmware implementation to avoid rework.

---

## END OF REPORT
