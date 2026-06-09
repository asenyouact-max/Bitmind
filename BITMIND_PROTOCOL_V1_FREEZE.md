# BITMIND PROTOCOL V1 FREEZE SPECIFICATION

**Version:** 1.0  
**Status:** FINAL  
**Date:** 2026-06-09  
**Authority:** This document defines the canonical Bitmind Device Protocol v1 for Phase A firmware implementation.

---

## SECTION 1 - CURRENT STATE ANALYSIS

### A) Current Backend Protocol

**Mining Job Schema (server/services/jobManager.js):**
- type: "mining_job"
- sessionId: UUID
- jobId: UUID
- height: number
- target: hex string
- pseudoTarget: hex string
- pseudoMining: boolean
- createdAt: timestamp
- version: number
- previousblockhash: hex string
- merkleroot: hex string
- nbits: number
- ntime: timestamp
- coinbasevalue: number
- coinbaseaddress: string
- transactions: array
- rules: array
- deviceContext: object (sessionId, nonceStart, nonceEnd, extranonce1)

**Characteristics:**
- Full Bitcoin block template data
- Rich Bitcoin-specific fields
- Session-based job management
- Device-specific nonce ranges
- Pseudo-mining support

---

### B) Firmware Architecture Requirements

**Mining Job Schema (BITMIND_FIRMWARE_ARCHITECTURE.md):**
- type: "mining.job"
- jobId: string
- data: hex string (block header data)
- target: hex string
- difficulty: number
- version: number
- previousblockhash: hex string
- curtime: number
- bits: number
- nonceStart: number

**Characteristics:**
- Simplified block header data
- Expects "data" field for block header construction
- Difficulty as number
- Basic Bitcoin fields
- No session management
- No pseudo-mining

---

### C) Historical Firmware Requirements

**Mining Job Schema (FIRMWARE Real SHA256.txt):**
- type: "mining_job"
- jobId: string
- height: number
- difficulty: hex string
- target: hex string
- pseudoTarget: hex string
- pseudoMining: boolean

**Characteristics:**
- Simplified job data
- Pseudo-mining support
- No full block template
- Difficulty as hex string

---

### D) Protocol v1 Current Schema

**Mining Job Schema (docs/device-protocol-v1.json):**
- type: "mining.job"
- jobId: string
- algorithm: "sha256"
- data: hex string
- target: hex string
- difficulty: number

**Characteristics:**
- Simplified abstraction
- Algorithm field
- Data field for block header
- Difficulty as number
- No Bitcoin-specific fields

---

### Comparison Summary

**Matches:**
- type field (all)
- jobId field (all)
- target field (all)

**Mismatches:**
- "data" field: Protocol v1 + Firmware expect, Backend does NOT provide
- "algorithm" field: Protocol v1 expects, Backend does NOT provide
- "difficulty" field: Protocol v1 + Firmware expect as number, Backend provides target only
- "sessionId" field: Backend provides, Protocol v1 + Firmware do NOT expect
- "height" field: Backend provides, Protocol v1 + Firmware do NOT expect
- "pseudoTarget" field: Backend provides, Protocol v1 + Firmware do NOT expect
- "pseudoMining" field: Backend provides, Protocol v1 + Firmware do NOT expect
- "version" field: Backend + Firmware expect, Protocol v1 does NOT define
- "previousblockhash" field: Backend + Firmware expect, Protocol v1 does NOT define
- "merkleroot" field: Backend provides, Firmware does NOT expect
- "nbits" field: Backend provides, Firmware expects "bits"
- "ntime" field: Backend provides, Firmware expects "curtime"
- "coinbasevalue" field: Backend provides, Protocol v1 + Firmware do NOT expect
- "coinbaseaddress" field: Backend provides, Protocol v1 + Firmware do NOT expect
- "transactions" field: Backend provides, Protocol v1 + Firmware do NOT expect
- "rules" field: Backend provides, Protocol v1 + Firmware do NOT expect
- "deviceContext" field: Backend provides, Firmware expects "nonceStart" only

**Redundant Fields (Backend Only):**
- coinbasevalue, coinbaseaddress, transactions, rules (not needed for Phase A)

**Missing Fields (Protocol v1 + Firmware Expect):**
- "data" field (critical for firmware block header construction)
- "algorithm" field (redundant, always sha256)
- "difficulty" field (redundant, target is sufficient)

---

## SECTION 2 - CANONICAL MINING.JOB SCHEMA

### Decision: Full Block Template Data

**Rationale:**

1. **Backend Already Provides Full Data:** The backend already generates full Bitcoin block templates from Bitcoin Core. This is production-ready and tested.

2. **Firmware Architecture Expects Bitcoin Fields:** The firmware architecture expects version, previousblockhash, curtime, bits - which are individual Bitcoin fields, not a single "data" field.

3. **Phase A Scope:** Phase A is about mining stability. Full block template data enables real Bitcoin mining, not simplified challenges.

4. **Future Compatibility:** Full block template data enables Phase B features (real rewards, full Stratum compatibility).

5. **No Simplification Needed:** ESP32 has sufficient memory and processing power to handle full block template data.

### Final mining.job Schema

**Required Fields:**
```json
{
  "type": "mining.job",
  "jobId": "string (UUID)",
  "sessionId": "string (UUID)",
  "height": "number",
  "target": "hex string",
  "pseudoTarget": "hex string or null",
  "pseudoMining": "boolean",
  "createdAt": "timestamp",
  "version": "number",
  "previousblockhash": "hex string",
  "merkleroot": "hex string",
  "nbits": "number",
  "ntime": "timestamp",
  "deviceContext": {
    "sessionId": "string (UUID)",
    "nonceStart": "number",
    "nonceEnd": "number",
    "extranonce1": "hex string"
  }
}
```

**Optional Fields (Phase A):**
- coinbasevalue (Phase B)
- coinbaseaddress (Phase B)
- transactions (Phase B)
- rules (Phase B)

**Deprecated Fields:**
- "data" (replaced by individual Bitcoin fields)
- "algorithm" (always sha256, redundant)
- "difficulty" (target is sufficient)

**Field Definitions:**
- type: Message type identifier
- jobId: Unique job identifier (UUID)
- sessionId: Mining session identifier (UUID)
- height: Bitcoin block height
- target: Bitcoin target (hex string)
- pseudoTarget: Pseudo target for testing (hex string or null)
- pseudoMining: Pseudo-mining mode flag
- createdAt: Job creation timestamp
- version: Block version
- previousblockhash: Previous block hash (hex string)
- merkleroot: Merkle root (hex string)
- nbits: Block difficulty bits
- ntime: Block timestamp
- deviceContext: Device-specific work assignment
  - sessionId: Session identifier
  - nonceStart: Starting nonce for device
  - nonceEnd: Ending nonce for device
  - extranonce1: Extra nonce 1 (hex string)

---

## SECTION 3 - CANONICAL SHARE SCHEMA

### Final mining.share Schema

**Required Fields:**
```json
{
  "type": "mining.share",
  "deviceId": "string",
  "jobId": "string (UUID)",
  "nonce": "hex string (8 chars)",
  "hash": "hex string (64 chars)"
}
```

**Optional Fields:** none

**Field Definitions:**
- type: Message type identifier
- deviceId: Device identifier (esp32-{hex})
- jobId: Job identifier (UUID)
- nonce: Nonce value (hex string, 8 characters)
- hash: Double SHA256 hash (hex string, 64 characters)

**Validation Requirements:**
- deviceId must match registered device
- jobId must match current job
- nonce must be within device's assigned nonce range
- hash must be below target
- hash must be recomputed from block header + nonce

---

## SECTION 4 - CONFIGURATION MODEL

### Decision: AP Onboarding Only

**Rationale:**

1. **Phase A Scope:** Phase A is about mining stability, not advanced onboarding features.

2. **QR Onboarding Complexity:** QR onboarding requires backend implementation of device.config, setup page, configuration delivery, and device reboot handling. This is significant complexity.

3. **AP Mode is Sufficient:** AP mode web portal is already defined in firmware architecture and provides complete configuration capability.

4. **No User Demand:** No evidence of user demand for QR onboarding in Phase A.

5. **Simpler Protocol:** Removing device.config simplifies protocol v1 and reduces implementation risk.

### Final Configuration Architecture

**Option A: AP Onboarding Only (SELECTED)**

**Configuration Flow:**
1. Device boots without WiFi credentials
2. Device enters AP mode (SSID: Bitmind-Setup)
3. User connects to AP and opens browser to http://192.168.4.1
4. User fills form: WiFi SSID, Password, Worker Name, Wallet Address
5. Device saves to Preferences NV storage
6. Device reboots
7. Device connects to user's WiFi
8. Device registers with backend

**Configuration Storage:**
- Technology: ESP32 Preferences (NV storage)
- Namespace: bitmind
- Keys: ssid, pass, worker, wallet, registered, token

**Configuration Updates:**
- User must manually re-enter AP mode to update configuration
- No backend-initiated configuration updates in Phase A

**device.config Status:** NOT IMPLEMENTED in Phase A

---

## SECTION 5 - TELEMETRY MODEL

### Decision: Include Telemetry in Protocol v1

**Rationale:**

1. **Backend Already Implements:** Backend already handles stats message in handlers.js.

2. **Operational Visibility:** Telemetry provides critical operational visibility for mining performance.

3. **Dashboard Requirements:** Dashboard requires hashrate, accepted shares, rejected shares for device monitoring.

4. **Low Complexity:** Telemetry schema is simple and well-defined.

5. **Phase A Scope:** Mining stability requires monitoring capability.

### Final mining_stats Schema

**Required Fields:**
```json
{
  "type": "mining_stats",
  "deviceId": "string",
  "hashrate": "number",
  "acceptedShares": "number",
  "rejectedShares": "number",
  "uptime": "number"
}
```

**Optional Fields:**
- jobId: string (current job identifier)

**Field Definitions:**
- type: Message type identifier
- deviceId: Device identifier (esp32-{hex})
- hashrate: Hash rate in hashes per second
- acceptedShares: Total accepted shares
- rejectedShares: Total rejected shares
- uptime: Device uptime in seconds
- jobId: Current job identifier (optional)

**Rate Limit:** Max 1 per 10 seconds (to prevent flooding)

---

## SECTION 6 - PROTOCOL V1 FREEZE DECISION

### Message Types

**Firmware → Backend:**
1. device.register - Device registration
2. device.heartbeat - Keep-alive signal
3. mining.share - Share submission
4. mining_stats - Telemetry data

**Backend → Firmware:**
1. device.registered - Registration acknowledgment
2. device.heartbeat.ack - Heartbeat acknowledgment
3. mining.job - Mining job distribution
4. mining.share.result - Share validation result
5. device.status - Device status update (OLED use case)
6. device.error - Error notification

---

### Message Schemas

#### device.register

**Direction:** Firmware → Backend

**Schema:**
```json
{
  "type": "device.register",
  "deviceId": "string (pattern: ^esp32-[a-f0-9]{4,12}$)",
  "deviceType": "enum: [\"oled_miner\", \"miner\", \"test_client\"]",
  "firmwareVersion": "string (pattern: ^\\d+\\.\\d+\\.\\d+$)",
  "capabilities": {
    "oled": "boolean",
    "wifi": "boolean",
    "stratum": "boolean"
  }
}
```

**Required Fields:** type, deviceId, deviceType, firmwareVersion

**Optional Fields:** capabilities

---

#### device.registered

**Direction:** Backend → Firmware

**Schema:**
```json
{
  "type": "device.registered",
  "status": "const: \"accepted\"",
  "deviceId": "string",
  "token": "string (minLength: 32)",
  "serverTime": "integer"
}
```

**Required Fields:** type, status, deviceId, token, serverTime

**Optional Fields:** none

---

#### device.heartbeat

**Direction:** Firmware → Backend

**Schema:**
```json
{
  "type": "device.heartbeat",
  "deviceId": "string",
  "uptime": "integer (minimum: 0)",
  "wifiRssi": "integer (maximum: 0, minimum: -100)"
}
```

**Required Fields:** type, deviceId, uptime, wifiRssi

**Optional Fields:** none

**Rate Limit:** Max 1 per 5 seconds

---

#### device.heartbeat.ack

**Direction:** Backend → Firmware

**Schema:**
```json
{
  "type": "device.heartbeat.ack",
  "systemState": {
    "status": "enum: [\"ok\", \"degraded\", \"critical\"]",
    "mode": "enum: [\"FALLBACK\", \"LIVE\"]",
    "rpc": "enum: [\"CONNECTED\", \"AUTH_FAILED\", \"UNREACHABLE\", \"DISABLED\"]",
    "mining": "enum: [\"LIVE_MINING\", \"SIMULATED_WORK_ONLY\", \"IDLE\"]"
  }
}
```

**Required Fields:** type, systemState

**Optional Fields:** none

---

#### mining.job

**Direction:** Backend → Firmware

**Schema:**
```json
{
  "type": "mining.job",
  "jobId": "string (UUID)",
  "sessionId": "string (UUID)",
  "height": "number",
  "target": "hex string",
  "pseudoTarget": "hex string or null",
  "pseudoMining": "boolean",
  "createdAt": "timestamp",
  "version": "number",
  "previousblockhash": "hex string",
  "merkleroot": "hex string",
  "nbits": "number",
  "ntime": "timestamp",
  "deviceContext": {
    "sessionId": "string (UUID)",
    "nonceStart": "number",
    "nonceEnd": "number",
    "extranonce1": "hex string"
  }
}
```

**Required Fields:** type, jobId, sessionId, height, target, pseudoTarget, pseudoMining, createdAt, version, previousblockhash, merkleroot, nbits, ntime, deviceContext

**Optional Fields (Phase A):** coinbasevalue, coinbaseaddress, transactions, rules

---

#### mining.share

**Direction:** Firmware → Backend

**Schema:**
```json
{
  "type": "mining.share",
  "deviceId": "string",
  "jobId": "string (UUID)",
  "nonce": "hex string (8 chars)",
  "hash": "hex string (64 chars)"
}
```

**Required Fields:** type, deviceId, jobId, nonce, hash

**Optional Fields:** none

**Rate Limit:** Max 10 per second

---

#### mining.share.result

**Direction:** Backend → Firmware

**Schema:**
```json
{
  "type": "mining.share.result",
  "jobId": "string",
  "accepted": "boolean",
  "reason": "enum: [\"valid\", \"stale\", \"invalid\", \"duplicate\"]"
}
```

**Required Fields:** type, jobId, accepted, reason

**Optional Fields:** none

---

#### mining_stats

**Direction:** Firmware → Backend

**Schema:**
```json
{
  "type": "mining_stats",
  "deviceId": "string",
  "hashrate": "number",
  "acceptedShares": "number",
  "rejectedShares": "number",
  "uptime": "number"
}
```

**Required Fields:** type, deviceId, hashrate, acceptedShares, rejectedShares, uptime

**Optional Fields:** jobId

**Rate Limit:** Max 1 per 10 seconds

---

#### device.status

**Direction:** Backend → Firmware

**Schema:**
```json
{
  "type": "device.status",
  "system": {
    "mode": "enum: [\"FALLBACK\", \"LIVE\"]",
    "rpc": "enum: [\"CONNECTED\", \"AUTH_FAILED\", \"UNREACHABLE\", \"DISABLED\"]"
  },
  "mining": {
    "hashrate": "number (minimum: 0)",
    "acceptedShares": "integer (minimum: 0)",
    "rejectedShares": "integer (minimum: 0)"
  },
  "display": {
    "message": "string (maxLength: 32)",
    "color": "enum: [\"green\", \"yellow\", \"red\", \"blue\", \"white\"]"
  }
}
```

**Required Fields:** type, system, mining, display

**Optional Fields:** none

**Use Case:** OLED firmware only

---

#### device.error

**Direction:** Backend → Firmware

**Schema:**
```json
{
  "type": "device.error",
  "code": "enum: [\"AUTH_INVALID\", \"VERSION_MISMATCH\", \"PAYLOAD_INVALID\", \"RATE_LIMIT\"]",
  "message": "string"
}
```

**Required Fields:** type, code, message

**Optional Fields:** none

---

### Identity Rules

**Worker Identity:**
- Worker name is primary device identity
- Source: User-provided during onboarding
- Storage: Preferences NV storage
- Format: String, 3+ characters, alphanumeric + hyphen + underscore
- Uniqueness: Per-device, no global enforcement
- Display: Shown in dashboard as device name

**Device Identity:**
- Device ID is secondary identity (hardware identifier)
- Source: ESP32 EFuse MAC address
- Format: esp32-{upper4hex}{lower8hex}
- Uniqueness: Guaranteed by hardware MAC
- Persistence: Computed at boot, not stored

**Hierarchy:**
- Worker name > Device ID (primary > secondary)

---

### Mining Rules

**Mining Algorithm:**
- Double SHA256 (Bitcoin standard)
- Implementation: mbedtls SHA256 (ESP32 3.3.8+)

**Mining Loop:**
- Interval: 100ms per hash attempt
- Nonce increment: +1 per attempt
- Hash rate calculation: Per-second rolling window
- Share condition: Hash < target

**Block Header Construction:**
- Version: 4 bytes (little endian)
- Previous block hash: 32 bytes (reversed)
- Merkle root: 32 bytes (reversed)
- Timestamp: 4 bytes (little endian)
- Bits: 4 bytes (little endian)
- Nonce: 4 bytes (little endian)
- Total: 80 bytes

**Share Submission:**
- Trigger: Hash < target
- Payload: jobId, nonce, hash, deviceId
- Rate limit: Max 10 per second
- Validation: Backend cryptographic validation

**Job Assignment:**
- Device-specific nonce ranges via deviceContext
- Session-based job management
- Nonce increment within assigned range

---

### Configuration Rules

**Configuration Method:**
- AP mode web portal only (Phase A)
- QR onboarding: NOT IMPLEMENTED (Phase B)

**Configuration Storage:**
- Technology: ESP32 Preferences (NV storage)
- Namespace: bitmind
- Keys: ssid, pass, worker, wallet, registered, token

**Configuration Update:**
- Manual re-entry to AP mode
- No backend-initiated updates (Phase A)

---

## SECTION 7 - IMPLEMENTATION IMPACT

### Alignment Required: Both Backend and Firmware Architecture

### Backend Changes Required

**1. Remove Optional Phase B Fields from mining.job**
- Remove coinbasevalue
- Remove coinbaseaddress
- Remove transactions
- Remove rules

**2. Keep mining.job Schema As-Is**
- Backend already provides correct schema
- No changes required to core mining.job structure

**3. Add mining_stats to Protocol v1**
- Backend already handles stats message
- No implementation changes required
- Only documentation update required

**4. Remove device.config (Phase A)**
- No implementation required
- Out of scope for Phase A

---

### Firmware Architecture Changes Required

**1. Update BITMIND_FIRMWARE_ARCHITECTURE.md**

**Section: Shared Architecture → WebSocket Communication → Message Types**

**Update mining.job schema:**
- Remove "data" field
- Remove "algorithm" field
- Remove "difficulty" field
- Add sessionId, height, pseudoTarget, pseudoMining, createdAt
- Add version, previousblockhash, merkleroot, nbits, ntime
- Add deviceContext (sessionId, nonceStart, nonceEnd, extranonce1)

**Remove device.config:**
- Remove device.config from Message Types
- Remove QR onboarding flow (mark as Phase B)

**Add mining_stats:**
- Add mining_stats to Message Types
- Define mining_stats schema

**Section: Mining Workflow → Job Reception**

**Update job parsing:**
- Parse sessionId, height, pseudoTarget, pseudoMining, createdAt
- Parse version, previousblockhash, merkleroot, nbits, ntime
- Parse deviceContext (nonceStart, nonceEnd, extranonce1)
- Remove "data" field parsing
- Remove "algorithm" field parsing
- Remove "difficulty" field parsing

**Section: Mining Workflow → Mining Loop**

**Update block header construction:**
- Use individual Bitcoin fields (version, previousblockhash, merkleroot, ntime, nbits)
- Remove "data" field usage
- Use deviceContext.nonceStart as starting nonce
- Respect deviceContext.nonceEnd as ending nonce

**Section: Telemetry**

**Add mining_stats implementation:**
- Send mining_stats message every 10 seconds
- Include hashrate, acceptedShares, rejectedShares, uptime

---

### Protocol v1 Changes Required

**1. Update docs/device-protocol-v1.json**

**Update mining.job schema:**
- Remove "algorithm" field
- Remove "data" field
- Remove "difficulty" field
- Add sessionId, height, pseudoTarget, pseudoMining, createdAt
- Add version, previousblockhash, merkleroot, nbits, ntime
- Add deviceContext
- Mark coinbasevalue, coinbaseaddress, transactions, rules as optional (Phase B)

**Add mining_stats schema:**
- Define mining_stats message type
- Define required fields
- Define optional fields
- Define rate limit

**Remove device.config:**
- Remove device.config from protocol v1 (Phase B)

---

### Summary of Changes

**Backend:**
- Remove optional Phase B fields from mining.job (documentation only)
- No implementation changes required
- mining_stats already implemented

**Firmware Architecture:**
- Update mining.job schema documentation
- Update job parsing logic
- Update block header construction logic
- Add mining_stats implementation
- Remove device.config (Phase B)

**Protocol v1:**
- Update mining.job schema
- Add mining_stats schema
- Remove device.config (Phase B)

**Estimated Implementation Time:** 2-3 hours

---

## SECTION 8 - CANONICAL STATE UPDATE REQUEST

### Section Affected

**Phase A Objectives → 3. FIRMWARE STABILITY**

---

### Evidence

**Protocol Freeze Specification:** BITMIND_PROTOCOL_V1_FREEZE.md

**Decisions Made:**
1. mining.job schema: Full block template data (backend implementation)
2. mining.share schema: Current protocol v1 (no changes)
3. Configuration model: AP onboarding only (device.config out of scope)
4. Telemetry model: Include mining_stats in protocol v1

**Verification Performed:**
- Analyzed current backend protocol
- Analyzed firmware architecture requirements
- Analyzed historical firmware requirements
- Compared all three schemas
- Identified matches, mismatches, redundant fields, missing fields
- Made canonical decisions for Phase A

---

### Recommended Updates

### 1. Update docs/device-protocol-v1.json

**Update mining.job schema:**
```json
{
  "type": "mining.job",
  "direction": "Server → ESP",
  "description": "Mining job distribution with full block template data",
  "schema": {
    "type": "object",
    "required": ["type", "jobId", "sessionId", "height", "target", "pseudoTarget", "pseudoMining", "createdAt", "version", "previousblockhash", "merkleroot", "nbits", "ntime", "deviceContext"],
    "properties": {
      "type": { "const": "mining.job" },
      "jobId": { "type": "string", "format": "uuid" },
      "sessionId": { "type": "string", "format": "uuid" },
      "height": { "type": "number" },
      "target": { "type": "string", "pattern": "^[a-f0-9]+$" },
      "pseudoTarget": { "type": ["string", "null"], "pattern": "^[a-f0-9]+$" },
      "pseudoMining": { "type": "boolean" },
      "createdAt": { "type": "integer" },
      "version": { "type": "number" },
      "previousblockhash": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
      "merkleroot": { "type": "string", "pattern": "^[a-f0-9]{64}$" },
      "nbits": { "type": "number" },
      "ntime": { "type": "integer" },
      "deviceContext": {
        "type": "object",
        "required": ["sessionId", "nonceStart", "nonceEnd", "extranonce1"],
        "properties": {
          "sessionId": { "type": "string", "format": "uuid" },
          "nonceStart": { "type": "number" },
          "nonceEnd": { "type": "number" },
          "extranonce1": { "type": "string", "pattern": "^[a-f0-9]+$" }
        }
      }
    }
  }
}
```

**Add mining_stats schema:**
```json
{
  "mining_stats": {
    "direction": "ESP → Server",
    "description": "Device telemetry data",
    "schema": {
      "type": "object",
      "required": ["type", "deviceId", "hashrate", "acceptedShares", "rejectedShares", "uptime"],
      "properties": {
        "type": { "const": "mining_stats" },
        "deviceId": { "type": "string" },
        "hashrate": { "type": "number", "minimum": 0 },
        "acceptedShares": { "type": "integer", "minimum": 0 },
        "rejectedShares": { "type": "integer", "minimum": 0 },
        "uptime": { "type": "integer", "minimum": 0 }
      }
    }
  }
}
```

**Remove device.config schema** (Phase B)

---

### 2. Update BITMIND_FIRMWARE_ARCHITECTURE.md

**Section: Shared Architecture → WebSocket Communication → Message Types**

**Update mining.job schema to match protocol v1 freeze specification**

**Add mining_stats to Message Types**

**Remove device.config from Message Types (Phase B)**

**Section: Mining Workflow → Job Reception**

**Update job parsing to match canonical mining.job schema**

**Section: Mining Workflow → Mining Loop**

**Update block header construction to use individual Bitcoin fields**

**Section: Telemetry**

**Add mining_stats implementation**

---

### 3. Update BITMIND_CANONICAL_STATE.md

**Section: FIRMWARE ARCHITECTURE**

**Add:**
```
Protocol Status:

[X] Protocol v1 finalized
[X] Backend aligned with protocol v1
[ ] Firmware aligned with protocol v1
[ ] Protocol frozen for Phase A
```

**Section: KNOWN COMPLETED FEATURES**

**Add:**
```
[ ] Protocol v1 freeze specification complete
[ ] Backend aligned with protocol v1
[ ] Firmware architecture aligned with protocol v1
```

---

### Awaiting Approval

**Action Required:** Review and approve protocol v1 freeze specification

**After Approval:**
1. Update docs/device-protocol-v1.json
2. Update BITMIND_FIRMWARE_ARCHITECTURE.md
3. Update BITMIND_CANONICAL_STATE.md
4. Commit protocol v1 freeze
5. Push to GitHub
6. Declare protocol frozen for Phase A

---

## END OF DOCUMENT
