# BITMIND CANONICAL STATE UPDATE REQUEST

**Date:** 2026-06-21  
**Purpose:** Update BITMIND_CANONICAL_STATE.md to reflect F5-P0, F5-P1, and F5-P2 implementations  
**Status:** DOCUMENTATION AUDIT ONLY  
**No Implementation Required**

---

## SECTION 1: OUTDATED SECTIONS

### 1.1 Document Metadata

**Current:**
```
Last Updated: 2026-06-08
```

**Issue:** Document is 13 days outdated

**Required Update:**
```
Last Updated: 2026-06-21
```

### 1.2 SYSTEM ARCHITECTURE

**Current Section (Lines 78-109):**
- Shows high-level architecture diagram
- Does not mention RegistrationStore
- Does not mention SQLite database
- Does not mention persistent identity layer

**Issue:** Missing identity architecture components

**Required Additions:**
- Add RegistrationStore layer between Backend API and WebSocket
- Add SQLite database as persistent storage
- Update architecture diagram to show identity persistence

**Proposed Updated Architecture:**
```
                                   INTERNET
                                        |
                                        |
                                BITMIND VPS
                                        |
                  ------------------------------------------------
                  |                                              |
                  |                                              |
             BACKEND API                                   STRATUM
                  |                                              |
                  |                                              |
             REGISTRATION STORE (SQLite)                    MINING JOBS
                  |                                              |
                  |                                              |
             WEBSOCKET                                    STATE (Memory)
                  |                                              |
                  ------------------------------------------------
                                        |
                                        |
                                 TAILSCALE VPN
                                        |
                                        |
                            BITCOIN CORE NODE
                              (Windows Host)
                                        |
                                        |
                                  BITCOIN NETWORK

                                        |
                                        |
                              ESP32 DEVICES WORLDWIDE
```

### 1.3 PHASE A OBJECTIVES - DEVICE MANAGEMENT

**Current Section (Lines 257-265):**
```
5. DEVICE MANAGEMENT

Requirements:

[ ] Device registration
[ ] Device identification
[ ] Device status reporting
[ ] Device management
```

**Issue:** Checkboxes not updated to reflect completed features

**Required Update:**
```
5. DEVICE MANAGEMENT

Requirements:

[X] Device registration (persistent via RegistrationStore)
[X] Device identification (deviceId + token)
[X] Device status reporting (WebSocket + API)
[X] Device management (API endpoints)
```

**Additional Context:**
- Device registration now persistent via RegistrationStore (SQLite)
- Device identification uses deviceId + token model
- Device status reporting via WebSocket and REST API
- Device management via /api/miners, /api/telemetry/:deviceId

### 1.4 KNOWN COMPLETED FEATURES

**Current Section (Lines 320-332):**
```
[ ] Stratum integration complete
[ ] Real mining tested
[ ] Reward path verified
[ ] QR onboarding functional
[ ] Device registration working
[ ] Worker name storage working
[ ] Firmware architecture defined
```

**Issue:** Checkboxes not updated to reflect completed features

**Required Update:**
```
[X] Stratum integration complete
[ ] Real mining tested
[ ] Reward path verified
[ ] QR onboarding functional
[X] Device registration working (persistent via RegistrationStore)
[X] Worker name storage working (RegistrationStore + NV storage)
[X] Firmware architecture defined
[X] Identity architecture implemented (RegistrationStore + SQLite)
[X] Token lifecycle fixed (generated once, preserved)
[X] Onboarding alignment implemented (workerName + walletAddress in payload)
```

### 1.5 WORKER IDENTITY MODEL

**Current Section (Lines 334-348):**
```
STATUS: FINAL

Worker Name:

Primary device identity

Requirements:

- Single identity source
- No duplicate naming systems
- No secondary worker mappings
```

**Issue:** Section is accurate but incomplete - doesn't mention walletAddress or token

**Required Update:**
```
STATUS: FINAL

Worker Identity Model:

Primary device identity consists of:
- workerName (user-provided, stored in NV storage and RegistrationStore)
- walletAddress (user-provided, stored in NV storage and RegistrationStore)
- deviceId (MAC-based for ESP32, random hex for virtual)
- token (backend-generated, 32-byte hex, persisted)

Requirements:

- Single identity source (RegistrationStore)
- No duplicate naming systems
- No secondary worker mappings
- Token-based authentication
- Persistent identity (survives backend/PM2/VPS restarts)
```

---

## SECTION 2: NEW CANONICAL ARCHITECTURE DECISIONS

### 2.1 Identity Architecture (F5-P0)

**Decision:** Implement persistent device identity architecture

**Canonical Decision:**
- Device identity consists of deviceId + token + registration persistence
- Token generated once on first registration, preserved across reconnections
- Token validated on every WebSocket connection
- RegistrationStore abstraction layer for storage-agnostic persistence
- SQLite as Phase A storage backend
- PostgreSQL as Phase B+ storage backend (future)
- Redis + PostgreSQL as Phase C storage backend (future)

**Authority Document:** BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md

**Implementation Status:** COMPLETED (F5-P1)

### 2.2 RegistrationStore Abstraction (F5-P1)

**Decision:** Create storage-agnostic RegistrationStore interface

**Canonical Decision:**
- RegistrationStore interface defines contract for device registration storage
- Methods: registerDevice(), getDevice(), updateDevice(), removeDevice(), validateToken(), isRegistered(), getAllRegistrations(), getRegistrationCount(), clear(), initialize(), close()
- Storage backend can be replaced without protocol changes
- SQLite implementation for Phase A
- PostgreSQL implementation for Phase B+ (future)
- Redis + PostgreSQL implementation for Phase C (future)

**Authority Document:** server/services/registrationStore.js

**Implementation Status:** COMPLETED

### 2.3 SQLite Storage Backend (F5-P1)

**Decision:** Use SQLite as Phase A storage backend

**Canonical Decision:**
- SQLite database at server/data/registrations.db
- Schema: registrations table with deviceId (PK), token, workerName, walletAddress, deviceType, firmwareVersion, registeredAt, lastSeen
- Indexes on token and lastSeen for performance
- WAL mode for write concurrency
- Supports 10,000+ devices
- File-based backup strategy
- Easy migration to PostgreSQL

**Authority Document:** server/services/registrationStore/sqlite.js

**Implementation Status:** COMPLETED

### 2.4 Token Lifecycle (F5-P1)

**Decision:** Fix token lifecycle to be stable

**Canonical Decision:**
- Token generated once on first registration
- Token persisted in RegistrationStore (SQLite)
- Token persisted in firmware NV storage (Preferences)
- Token reused on all reconnections
- Token validated on every WebSocket connection
- Token survives backend/PM2/VPS restarts
- Token format: 32-byte hex (64 hex characters)

**Authority Document:** BITMIND_F5_P1_IMPLEMENTATION_REPORT.md

**Implementation Status:** COMPLETED

### 2.5 Onboarding Alignment (F5-P2)

**Decision:** Align firmware registration with onboarding flow

**Canonical Decision:**
- Firmware device.register payload includes workerName and walletAddress
- workerName and walletAddress are optional fields (backward compatible)
- workerName and walletAddress stored in NV storage and RegistrationStore
- Protocol schema updated to document optional fields
- Virtual devices already send workerName and walletAddress via Connect Miner
- No backend changes required beyond F5-P1

**Authority Document:** BITMIND_F5_P2_IMPLEMENTATION_REPORT.md

**Implementation Status:** COMPLETED

### 2.6 Protocol Schema Update (F5-P2)

**Decision:** Update device-protocol-v1.json to include workerName and walletAddress

**Canonical Decision:**
- device.register schema includes optional workerName field (minLength 3, maxLength 50)
- device.register schema includes optional walletAddress field (Bitcoin address pattern)
- Fields marked as optional for backward compatibility
- Validation rules defined for both fields
- Protocol version remains 1.0 (backward compatible)

**Authority Document:** docs/device-protocol-v1.json

**Implementation Status:** COMPLETED

### 2.7 Identity Preservation (F5-P1)

**Decision:** Ensure identity preservation across all restart scenarios

**Canonical Decision:**
- Registrations persist across backend restarts
- Registrations persist across PM2 restarts
- Registrations persist across VPS reboots
- Token preserved across all restart scenarios
- workerName and walletAddress preserved across all restart scenarios
- deviceId immutable (MAC-based for ESP32, random hex for virtual)

**Authority Document:** BITMIND_F5_P1_IMPLEMENTATION_REPORT.md

**Implementation Status:** COMPLETED

---

## SECTION 3: NEW SECTIONS TO ADD

### 3.1 IDENTITY ARCHITECTURE

**Proposed New Section (after SYSTEM ARCHITECTURE):**

```
==============================================================================
IDENTITY ARCHITECTURE
==============================================================================

STATUS: FINAL

Authority Document:

BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md

Identity Model:

deviceId + token + registration persistence

Components:

- RegistrationStore: Storage-agnostic abstraction layer
- SQLite: Phase A storage backend (server/data/registrations.db)
- Token: 32-byte hex, generated once, preserved across reconnections
- workerName: User-provided, stored in NV storage and RegistrationStore
- walletAddress: User-provided, stored in NV storage and RegistrationStore

Persistence:

- Registrations persist across backend/PM2/VPS restarts
- Token persists across all restart scenarios
- Identity preserved across firmware reboots

Scalability:

- Phase A: SQLite (10,000+ devices)
- Phase B+: PostgreSQL (100,000+ devices)
- Phase C: Redis + PostgreSQL (1,000,000+ devices)

No identity architecture changes without updating BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md first.
```

### 3.2 REGISTRATION STORE

**Proposed New Section (after IDENTITY ARCHITECTURE):**

```
==============================================================================
REGISTRATION STORE
==============================================================================

STATUS: FINAL

Purpose:

Persistent device registration storage

Implementation:

- Interface: server/services/registrationStore.js
- Backend: server/services/registrationStore/sqlite.js
- Database: server/data/registrations.db

Schema:

registrations table:
- deviceId (PK)
- token
- workerName
- walletAddress
- deviceType
- firmwareVersion
- registeredAt
- lastSeen

Methods:

- registerDevice()
- getDevice()
- updateDevice()
- removeDevice()
- validateToken()
- isRegistered()
- getAllRegistrations()
- getRegistrationCount()
- clear()
- initialize()
- close()

No RegistrationStore changes without updating BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md first.
```

### 3.3 TOKEN LIFECYCLE

**Proposed New Section (after REGISTRATION STORE):**

```
==============================================================================
TOKEN LIFECYCLE
==============================================================================

STATUS: FINAL

Token Format:

32-byte hex (64 hex characters)

Generation:

- Generated once on first registration
- Generated by backend (RegistrationStore)
- Cryptographically random

Persistence:

- Backend: SQLite database (registrations table)
- Firmware: NV storage (Preferences)

Lifecycle:

1. First Registration: Token generated, stored in database and NV storage
2. Reconnection: Same token reused, retrieved from database
3. Backend Restart: Token preserved in database
4. PM2 Restart: Token preserved in database
5. VPS Reboot: Token preserved in database
6. Factory Reset: Token cleared, new token generated on next registration

Validation:

- Token validated on every WebSocket connection
- Token validation logging-only (Phase A)
- Token mismatch: Connection rejected (Phase B+)

No token lifecycle changes without updating BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md first.
```

### 3.4 ONBOARDING ALIGNMENT

**Proposed New Section (after TOKEN LIFECYCLE):**

```
==============================================================================
ONBOARDING ALIGNMENT
==============================================================================

STATUS: FINAL

Purpose:

Align firmware registration with onboarding flow

Implementation:

- Firmware device.register includes workerName and walletAddress
- Protocol schema updated (device-protocol-v1.json)
- workerName and walletAddress are optional (backward compatible)
- Virtual devices already aligned (Connect Miner)

Flow:

1. AP Provisioning: User configures workerName and walletAddress
2. NV Storage: workerName and walletAddress saved to Preferences
3. Device Registration: device.register includes workerName and walletAddress
4. RegistrationStore: workerName and walletAddress stored in database
5. Mining: workerName and walletAddress used for pool identification

Backward Compatibility:

- Old firmware (without fields) continues to work
- New firmware (with fields) fully aligned
- No protocol breaking changes

No onboarding alignment changes without updating BITMIND_F5_P2_ONBOARDING_CONTRACT.md first.
```

---

## SECTION 4: DECISION LOG UPDATES

### 4.1 New Decision Entries

**Entry 1:**
```
Date: 2026-06-21
Decision: Implement persistent device identity architecture (F5-P0)
Reason: Critical architectural defect - in-memory DeviceRegistry lost on restart
Approved By: F5-P0 Design Document
```

**Entry 2:**
```
Date: 2026-06-21
Decision: Replace DeviceRegistry with RegistrationStore (F5-P1)
Reason: Enable persistent device identity across backend/PM2/VPS restarts
Approved By: F5-P1 Implementation
```

**Entry 3:**
```
Date: 2026-06-21
Decision: Use SQLite as Phase A storage backend (F5-P1)
Reason: Simple, file-based, no external dependencies, sufficient for 10,000 devices
Approved By: F5-P1 Implementation
```

**Entry 4:**
```
Date: 2026-06-21
Decision: Fix token lifecycle to be stable (F5-P1)
Reason: Token was regenerated on every connection, causing identity instability
Approved By: F5-P1 Implementation
```

**Entry 5:**
```
Date: 2026-06-21
Decision: Align firmware registration with onboarding flow (F5-P2)
Reason: Firmware device.register missing workerName and walletAddress
Approved By: F5-P2 Implementation
```

---

## SECTION 5: DO NOT CHANGE WITHOUT EXPLICIT APPROVAL

**Current Section (Lines 425-434):**
```
- Deployment workflow
- Bitcoin Core location
- Tailscale architecture
- Worker identity model
- RPC authority model
- Phase A scope
```

**Required Additions:**
```
- Deployment workflow
- Bitcoin Core location
- Tailscale architecture
- Worker identity model
- RPC authority model
- Phase A scope
- Identity architecture (F5-P0)
- RegistrationStore abstraction (F5-P1)
- Token lifecycle (F5-P1)
- Onboarding alignment (F5-P2)
```

---

## SECTION 6: IMPLEMENTATION STATUS SUMMARY

### 6.1 F5-P0: Identity Architecture Design

**Status:** COMPLETED

**Deliverables:**
- BITMIND_F5_IDENTITY_ARCHITECTURE_DESIGN.md
- Identity model specification
- Storage backend evaluation
- RegistrationStore interface design
- Token lifecycle specification

### 6.2 F5-P1: Identity Architecture Implementation

**Status:** COMPLETED

**Deliverables:**
- server/services/registrationStore.js (interface)
- server/services/registrationStore/sqlite.js (implementation)
- Updated handlers.js (async/await conversion)
- Updated routes.js (async/await conversion)
- Updated server.js (RegistrationStore initialization)
- Deleted server/services/deviceRegistry.js
- BITMIND_F5_P1_IMPLEMENTATION_REPORT.md

**Commit Hash:** f5ff237

### 6.3 F5-P2: Onboarding Alignment

**Status:** COMPLETED

**Deliverables:**
- Updated esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino (workerName, walletAddress)
- Updated docs/device-protocol-v1.json (optional fields)
- BITMIND_F5_P2_ONBOARDING_CONTRACT.md
- BITMIND_F5_P2_PAYLOAD_SCHEMA.md
- BITMIND_F5_P2_NAMING_RECOMMENDATION.md
- BITMIND_F5_P2_ONBOARDING_FLOW.md
- BITMIND_F5_P2_IMPLEMENTATION_REPORT.md

**Commit Hash:** d4945b5

### 6.4 Deployment Fix

**Status:** COMPLETED

**Deliverables:**
- Updated server/package.json (added sqlite3@^5.1.7)
- BITMIND_F5_P1_DEPLOYMENT_FIX.md

**Commit Hash:** a748f85

---

## SECTION 7: UPDATE PRIORITY

### 7.1 High Priority Updates

1. **Last Updated Date** - Update to 2026-06-21
2. **SYSTEM ARCHITECTURE** - Add RegistrationStore and SQLite
3. **PHASE A OBJECTIVES** - Update Device Management checkboxes
4. **KNOWN COMPLETED FEATURES** - Update checkboxes
5. **WORKER IDENTITY MODEL** - Add walletAddress and token

### 7.2 Medium Priority Updates

1. **Add IDENTITY ARCHITECTURE section**
2. **Add REGISTRATION STORE section**
3. **Add TOKEN LIFECYCLE section**
4. **Add ONBOARDING ALIGNMENT section**
5. **Update DECISION LOG**

### 7.3 Low Priority Updates

1. **Update DO NOT CHANGE section**
2. **Add IMPLEMENTATION STATUS SUMMARY**

---

## SECTION 8: APPROVAL REQUIRED

### 8.1 Changes Requiring Explicit Approval

**None** - All changes are documentation updates reflecting completed implementations.

### 8.2 Changes Not Requiring Approval

**All** - These are documentation updates to reflect canonical architecture decisions already implemented and committed to GitHub.

---

## CONCLUSION

**Status:** ✅ UPDATE REQUEST COMPLETE

**Summary:**
BITMIND_CANONICAL_STATE.md requires updates to reflect F5-P0, F5-P1, and F5-P2 implementations. Key outdated sections identified: document metadata, system architecture, Phase A objectives, known completed features, and worker identity model. New canonical architecture decisions identified: identity architecture, RegistrationStore abstraction, SQLite storage backend, token lifecycle, onboarding alignment, protocol schema update, and identity preservation. New sections proposed: identity architecture, registration store, token lifecycle, and onboarding alignment. All changes are documentation-only, no implementation required.

**Next Steps:**
1. Review this update request
2. Approve changes
3. Update BITMIND_CANONICAL_STATE.md
4. Commit and push updates

**Status:** READY FOR REVIEW AND APPROVAL
