# CANONICAL STATE UPDATE REQUEST

**Date:** 2026-06-09  
**Task:** Backend Contract Freeze Verification  
**Status:** FAILED - Protocol NOT frozen

---

## SECTION AFFECTED

**Phase A Objectives → 3. FIRMWARE STABILITY**

---

## EVIDENCE

**Verification Report:** BACKEND_CONTRACT_FREEZE_VERIFICATION.md

**Critical Findings:**
1. mining.job schema mismatch between protocol v1, backend, and firmware architecture
2. device.config not implemented in backend
3. telemetry/stats not defined in protocol v1

**Verification Performed:**
- Audited all firmware/backend message types
- Audited worker identity model
- Audited device identity model
- Audited share submission flow
- Audited mining job schema
- Compared protocol v1, backend implementation, and firmware architecture

---

## RECOMMENDED UPDATES

### 1. Update Protocol v1 - mining.job Schema

**Current Protocol v1 Schema:**
```json
{
  "type": "mining.job",
  "jobId": "string",
  "algorithm": "sha256",
  "data": "hex string",
  "target": "hex string",
  "difficulty": "number"
}
```

**Backend Implementation Schema:**
```json
{
  "type": "mining_job",
  "sessionId": "uuid",
  "jobId": "uuid",
  "height": "number",
  "target": "hex string",
  "pseudoTarget": "hex string",
  "pseudoMining": "boolean",
  "createdAt": "timestamp",
  "version": "number",
  "previousblockhash": "hex string",
  "merkleroot": "hex string",
  "nbits": "number",
  "ntime": "timestamp",
  "coinbasevalue": "number",
  "coinbaseaddress": "string",
  "transactions": "array",
  "rules": "array",
  "deviceContext": "object"
}
```

**Firmware Architecture Expected Schema:**
```json
{
  "type": "mining.job",
  "jobId": "string",
  "data": "hex string",
  "target": "hex string",
  "difficulty": "number",
  "version": "number",
  "previousblockhash": "hex string",
  "curtime": "number",
  "bits": "number",
  "nonceStart": "number"
}
```

**Recommended Update to Protocol v1:**
```json
{
  "type": "mining.job",
  "jobId": "string",
  "sessionId": "string",
  "height": "number",
  "target": "hex string",
  "pseudoTarget": "hex string",
  "pseudoMining": "boolean",
  "createdAt": "timestamp",
  "version": "number",
  "previousblockhash": "hex string",
  "merkleroot": "hex string",
  "nbits": "number",
  "ntime": "timestamp",
  "coinbasevalue": "number",
  "coinbaseaddress": "string",
  "transactions": "array",
  "rules": "array",
  "deviceContext": {
    "sessionId": "string",
    "nonceStart": "number",
    "nonceEnd": "number",
    "extranonce1": "hex string"
  }
}
```

**Rationale:** Backend provides richer Bitcoin-specific fields that firmware architecture already expects. Align protocol v1 with backend implementation.

---

### 2. Add device.config to Protocol v1

**Proposed Schema:**
```json
{
  "type": "device.config",
  "ssid": "string",
  "pass": "string",
  "worker": "string",
  "wallet": "string"
}
```

**Direction:** Backend → ESP

**Required Fields:**
- type (const: "device.config")
- ssid (string)
- pass (string)
- worker (string)
- wallet (string)

**Rationale:** Required for QR onboarding functionality proposed in firmware architecture.

---

### 3. Add mining_stats to Protocol v1

**Proposed Schema:**
```json
{
  "type": "mining_stats",
  "deviceId": "string",
  "jobId": "string",
  "hashrate": "number",
  "acceptedShares": "number",
  "rejectedShares": "number",
  "uptime": "number"
}
```

**Direction:** ESP → Backend

**Required Fields:**
- type (const: "mining_stats")
- deviceId (string)
- hashrate (number)
- acceptedShares (number)
- rejectedShares (number)
- uptime (number)

**Optional Fields:**
- jobId (string)

**Rationale:** Backend already handles stats message. Add to protocol v1 for compliance.

---

### 4. Update BITMIND_FIRMWARE_ARCHITECTURE.md

**Section: Shared Architecture → WebSocket Communication → Message Types**

**Update mining.job schema to match protocol v1:**
- Remove "data" field
- Remove "algorithm" field
- Remove "difficulty" field
- Add sessionId, height, pseudoTarget, pseudoMining, createdAt
- Add version, previousblockhash, merkleroot, nbits, ntime
- Add coinbasevalue, coinbaseaddress, transactions, rules
- Add deviceContext

**Add device.config to Message Types:**
- device.config - Configuration update (for QR onboarding)

**Add mining_stats to Message Types:**
- mining_stats - Telemetry data

---

### 5. Update BITMIND_CANONICAL_STATE.md

**Section: FIRMWARE ARCHITECTURE**

**Add:**
```
Protocol Status:

[ ] Protocol v1 finalized
[ ] Backend aligned with protocol v1
[ ] Firmware aligned with protocol v1
[ ] Protocol frozen for Phase A
```

**Section: KNOWN COMPLETED FEATURES**

**Add:**
```
[ ] Backend contract freeze verification complete
```

---

## AWAITING APPROVAL

**Action Required:** Review and approve recommended protocol updates

**After Approval:**
1. Update docs/device-protocol-v1.json
2. Update BITMIND_FIRMWARE_ARCHITECTURE.md
3. Update BITMIND_CANONICAL_STATE.md
4. Implement device.config in backend
5. Re-verify contract freeze
6. Declare protocol frozen for Phase A

---

## BLOCKERS REMAINING

1. **CRITICAL:** mining.job schema mismatch
2. **CRITICAL:** device.config not implemented
3. **MEDIUM:** telemetry/stats not protocol compliant

**Estimated Time to Fix:** 2-4 hours

---

## END OF REQUEST
