# BITMIND F5.1 REGISTRATION PERSISTENCE & TOKEN LIFECYCLE AUDIT

**Phase:** F5.1 - Registration Persistence & Token Lifecycle Audit  
**Date:** 2026-06-21  
**Status:** COMPREHENSIVE AUDIT  
**Purpose:** Determine whether Bitmind has a valid persistent device identity model

---

## EXECUTIVE SUMMARY

**Audit Result:** ❌ CRITICAL ARCHITECTURAL DEFECT FOUND

**Key Findings:**
1. **DeviceRegistry is in-memory only** - Does NOT survive PM2/backend/VPS restart
2. **No registration persistence** - All registrations lost on backend restart
3. **Token not validated** - Any device can claim any deviceId
4. **Token changes on every connection** - handlers.js generates new token on every WebSocket connection
5. **No device identity model** - deviceId is not authenticated or validated

**Impact:** CRITICAL
- No persistent device identity
- No authentication mechanism
- Device spoofing possible
- Cloning attacks possible
- All registrations lost on backend restart

**Root Cause:** D. Core Architectural Defect

**Recommendation:** MUST FIX identity architecture before proceeding with onboarding implementation

---

## SECTION 1: TOKEN GENERATION FLOW

### 1.1 Complete Token Lifecycle

**Flow Diagram:**
```
DeviceRegistry.register() (First Registration)
↓
crypto.randomBytes(32).toString('hex') (deviceRegistry.js line 16)
↓
Token stored in DeviceRegistry Map (in-memory)
↓
handlers.register() (WebSocket Connection)
↓
crypto.randomBytes(16).toString('hex') (handlers.js line 196) ← OVERWRITES
↓
Token sent to firmware via device.registered
↓
Firmware stores token in Preferences NV storage
↓
Firmware reboots
↓
Firmware loads token from Preferences (token survives reboot)
↓
Firmware reconnects to WebSocket
↓
handlers.register() (WebSocket Reconnection)
↓
crypto.randomBytes(16).toString('hex') (handlers.js line 196) ← NEW TOKEN
↓
New token sent to firmware
↓
Firmware overwrites token in Preferences
```

### 1.2 Token Generation Locations

**Location 1: DeviceRegistry (deviceRegistry.js line 16)**
```javascript
token: metadata.token || crypto.randomBytes(32).toString('hex')
```
- **Purpose:** Generate token on first registration
- **Storage:** In-memory Map
- **Persistence:** Lost on backend restart
- **Token Size:** 32 bytes (64 hex characters)

**Location 2: handlers.js (handlers.js line 196)**
```javascript
const token = crypto.randomBytes(16).toString('hex');
```
- **Purpose:** Generate token on every WebSocket connection
- **Storage:** Not stored (ephemeral)
- **Persistence:** Lost immediately after sending
- **Token Size:** 16 bytes (32 hex characters)
- **Issue:** Overwrites DeviceRegistry token

### 1.3 Token Storage Locations

**Backend Storage:**
- DeviceRegistry Map (in-memory)
- Lost on backend restart

**Firmware Storage:**
- Preferences NV storage
- Survives firmware reboot
- Overwritten on every WebSocket reconnection

### 1.4 Token Loading Locations

**Backend Loading:**
- DeviceRegistry.getRegistration(deviceId)
- Returns null after backend restart

**Firmware Loading:**
- preferences.getString("token", "")
- Loads on boot
- Loads correctly

### 1.5 Token Validation

**Backend Validation:** NONE
- No token validation in handlers.js
- No token validation in deviceGateway.js
- No token validation in deviceRegistry.js

**Firmware Validation:** NONE
- Firmware does not validate token
- Firmware accepts any token from backend

### 1.6 Token Replacement

**Replacement 1: handlers.js line 196**
- **Trigger:** Every WebSocket connection
- **Action:** Generate new token
- **Impact:** Overwrites DeviceRegistry token
- **Issue:** Token instability

**Replacement 2: Firmware handleDeviceRegistered (line 389)**
- **Trigger:** Every device.registered message
- **Action:** Overwrite config.token
- **Impact:** Overwrites stored token
- **Issue:** Token instability

---

## SECTION 2: DEVICE REGISTRY PERSISTENCE

### 2.1 DeviceRegistry Implementation

**Code:** deviceRegistry.js line 9
```javascript
const registry = new Map(); // deviceId -> deviceRegistration
```

**Storage Type:** In-memory Map

**Persistence:** NONE

### 2.2 Persistence Questions

**Q1. Is DeviceRegistry memory-only?**
**Answer:** ✅ YES
- **Evidence:** Line 9: `const registry = new Map()`
- **No database persistence**
- **No file persistence**
- **No Redis persistence**

**Q2. Does DeviceRegistry survive PM2 restart?**
**Answer:** ❌ NO
- **Evidence:** In-memory Map only
- **PM2 restart clears memory**
- **All registrations lost**

**Q3. Does DeviceRegistry survive backend process restart?**
**Answer:** ❌ NO
- **Evidence:** In-memory Map only
- **Process restart clears memory**
- **All registrations lost**

**Q4. Does DeviceRegistry survive VPS reboot?**
**Answer:** ❌ NO
- **Evidence:** In-memory Map only
- **VPS reboot clears memory**
- **All registrations lost**

**Q5. Is registration persisted anywhere?**
**Answer:** ❌ NO
- **Evidence:** No database persistence
- **No file persistence
- **No external storage**

**Q6. If yes, where?**
**Answer:** N/A (not persisted)

**Q7. If no, what happens after restart?**
**Answer:** All registrations are lost
- **Evidence:** DeviceRegistry.clear() is called on restart
- **All devices must re-register**
- **All tokens are regenerated
- **All identity is lost**

---

## SECTION 3: REGISTRATION PERSISTENCE

### 3.1 Registration Ownership

**Current State:**
- **Identity Storage:** DeviceRegistry (in-memory Map)
- **Runtime Storage:** state/index.js (in-memory Map)
- **Firmware Storage:** Preferences NV storage

**Ownership Model:**
- **Backend owns:** token (generated on every connection)
- **Firmware owns:** workerName, walletAddress, deviceType, deviceId, configuration
- **Backend syncs:** workerName, walletAddress from device.register (not implemented yet)

### 3.2 Registration Recovery

**Current Recovery Mechanism:** NONE

**After Backend Restart:**
- DeviceRegistry is empty
- state/index.js is empty
- Devices must re-register via WebSocket
- ESP32 devices auto-register (MODEL A)
- Virtual devices must be pre-registered (MODEL B)

**After Firmware Reboot:**
- Firmware loads configuration from Preferences
- Firmware loads token from Preferences
- Firmware reconnects to WebSocket
- Backend generates new token (handlers.js issue)
- Firmware overwrites token

### 3.3 Registration Recreation

**ESP32 Devices (MODEL A):**
- Auto-register on first connection
- Backend creates new registration
- Backend generates new token
- Device identity recreated

**Virtual Devices (MODEL B):**
- Must be pre-registered via REST API
- If registration lost, must be recreated
- Manual intervention required

### 3.4 Lifecycle Diagram

```
Device Boot
↓
Load Configuration from Preferences
↓
Connect to WebSocket
↓
Send device.register
↓
Backend: Check DeviceRegistry
↓
If not registered: Auto-register (ESP32) or Reject (Virtual)
↓
Backend: Generate token (handlers.js line 196)
↓
Backend: Send device.registered
↓
Firmware: Store token in Preferences
↓
Device Active
↓
Backend Restart
↓
DeviceRegistry Cleared
↓
Device Reconnects
↓
Backend: Check DeviceRegistry (empty)
↓
Backend: Auto-register (ESP32) or Reject (Virtual)
↓
Backend: Generate NEW token
↓
Backend: Send device.registered
↓
Firmware: Overwrite token in Preferences
↓
Device Active (NEW IDENTITY)
```

---

## SECTION 4: RECONNECT SCENARIOS

### 4.1 Scenario A: Normal Reconnect

**Flow:**
```
Device disconnects
↓
Device reconnects to WebSocket
↓
handlers.register() called
↓
DeviceRegistry.getRegistration(deviceId) returns existing registration
↓
handlers.js line 196: Generate NEW token
↓
Send device.registered with NEW token
↓
Firmware overwrites token in Preferences
```

**Token State:** CHANGED (new token generated)
**Registration State:** PRESERVED (DeviceRegistry still has registration)
**Device Identity State:** CHANGED (new token)
**Expected Behavior:** Token should be preserved (FAILS)

---

### 4.2 Scenario B: Firmware Reboot

**Flow:**
```
Device reboots
↓
Firmware loads token from Preferences
↓
Firmware connects to WebSocket
↓
handlers.register() called
↓
DeviceRegistry.getRegistration(deviceId) returns existing registration
↓
handlers.js line 196: Generate NEW token
↓
Send device.registered with NEW token
↓
Firmware overwrites token in Preferences
```

**Token State:** CHANGED (new token generated)
**Registration State:** PRESERVED (DeviceRegistry still has registration)
**Device Identity State:** CHANGED (new token)
**Expected Behavior:** Token should be preserved (FAILS)

---

### 4.3 Scenario C: Backend Restart

**Flow:**
```
Backend restarts
↓
DeviceRegistry cleared (in-memory Map)
↓
state/index.js cleared (in-memory Map)
↓
Device reconnects to WebSocket
↓
handlers.register() called
↓
DeviceRegistry.getRegistration(deviceId) returns null
↓
ESP32: Auto-register (MODEL A)
↓
Virtual: Reject (MODEL B)
↓
handlers.js line 196: Generate NEW token
↓
Send device.registered with NEW token
↓
Firmware overwrites token in Preferences
```

**Token State:** CHANGED (new token generated)
**Registration State:** RECREATED (auto-register or reject)
**Device Identity State:** CHANGED (new token, new registration)
**Expected Behavior:** Registration should be preserved (FAILS)

---

### 4.4 Scenario D: PM2 Restart

**Flow:**
```
PM2 restarts backend
↓
DeviceRegistry cleared (in-memory Map)
↓
state/index.js cleared (in-memory Map)
↓
Device reconnects to WebSocket
↓
handlers.register() called
↓
DeviceRegistry.getRegistration(deviceId) returns null
↓
ESP32: Auto-register (MODEL A)
↓
Virtual: Reject (MODEL B)
↓
handlers.js line 196: Generate NEW token
↓
Send device.registered with NEW token
↓
Firmware overwrites token in Preferences
```

**Token State:** CHANGED (new token generated)
**Registration State:** RECREATED (auto-register or reject)
**Device Identity State:** CHANGED (new token, new registration)
**Expected Behavior:** Registration should be preserved (FAILS)

---

### 4.5 Scenario E: VPS Reboot

**Flow:**
```
VPS reboots
↓
Backend process killed
↓
DeviceRegistry cleared (in-memory Map)
↓
state/index.js cleared (in-memory Map)
↓
Backend restarts
↓
Device reconnects to WebSocket
↓
handlers.register() called
↓
DeviceRegistry.getRegistration(deviceId) returns null
↓
ESP32: Auto-register (MODEL A)
↓
Virtual: Reject (MODEL B)
↓
handlers.js line 196: Generate NEW token
↓
Send device.registered with NEW token
↓
Firmware overwrites token in Preferences
```

**Token State:** CHANGED (new token generated)
**Registration State:** RECREATED (auto-register or reject)
**Device Identity State:** CHANGED (new token, new registration)
**Expected Behavior:** Registration should be preserved (FAILS)

---

### 4.6 Scenario F: Factory Reset

**Flow:**
```
Factory reset triggered
↓
Preferences.clear() called
↓
All configuration cleared
↓
Token cleared
↓
WiFi credentials cleared
↓
Worker name cleared
↓
Wallet address cleared
↓
Device reboots
↓
Device enters AP mode
↓
User reconfigures device
↓
Device reconnects to WebSocket
↓
handlers.register() called
↓
DeviceRegistry.getRegistration(deviceId) returns existing registration (if backend not restarted)
↓
handlers.js line 196: Generate NEW token
↓
Send device.registered with NEW token
↓
Firmware stores token in Preferences
```

**Token State:** CHANGED (new token generated)
**Registration State:** PRESERVED (DeviceRegistry still has registration, but firmware identity changed)
**Device Identity State:** CHANGED (new token, new configuration)
**Expected Behavior:** Token should be cleared (PASSES), registration should be preserved (PASSES)

---

## SECTION 5: TOKEN VALIDATION MODEL

### 5.1 Current Token Validation

**Backend Validation:** NONE

**Evidence:**
- handlers.js line 196: Generates token without validation
- handlers.js line 197: Sends token without validation
- deviceGateway.js line 83-91: createRegistrationResponse does not validate token
- deviceRegistry.js line 16: Generates token without validation
- No token validation in any handler

**Firmware Validation:** NONE

**Evidence:**
- bitmind_legacy_v1.ino line 389: Stores token without validation
- bitmind_legacy_v1.ino line 133: Loads token without validation
- No token validation in firmware

### 5.2 Spoofing Analysis

**Can any device claim any deviceId?**
**Answer:** ✅ YES
- **Evidence:** No deviceId validation beyond format check
- **Evidence:** No token validation
- **Evidence:** No authentication mechanism
- **Risk:** HIGH

**Can token be spoofed?**
**Answer:** ✅ YES
- **Evidence:** Token not validated
- **Evidence:** Token generated on every connection
- **Evidence:** No token authentication
- **Risk:** HIGH

**Can token be ignored?**
**Answer:** ✅ YES
- **Evidence:** Token not used for authentication
- **Evidence:** Token not validated
- **Evidence:** Token is optional in protocol
- **Risk:** MEDIUM

### 5.3 Security Implications

**Identity Collision:** HIGH RISK
- deviceId is MAC-based (can be spoofed)
- No token validation
- Any device can claim any deviceId

**Spoofing:** HIGH RISK
- No authentication mechanism
- Token not validated
- deviceId not validated

**Token Replay:** MEDIUM RISK
- Token changes on every connection
- Token not validated
- Replay not possible due to token instability

**Cloning:** HIGH RISK
- Firmware can be cloned to another ESP32
- Cloned device will have same deviceId
- Backend will accept cloned device
- No mechanism to detect cloning

---

## SECTION 6: PROPOSED FIX REVIEW

### 6.1 Proposed Fix

**Code:**
```javascript
const registration = DeviceRegistry.getRegistration(deviceId);
const token = registration ? registration.token : crypto.randomBytes(16).toString('hex');
```

### 6.2 Fix Sufficiency Analysis

**Will this fix reconnects?**
**Answer:** ✅ YES
- **Reason:** Uses existing token from DeviceRegistry
- **Condition:** DeviceRegistry still has registration
- **Gap:** None for normal reconnects

**Will this fix firmware reboot?**
**Answer:** ✅ YES
- **Reason:** Uses existing token from DeviceRegistry
- **Condition:** DeviceRegistry still has registration
- **Gap:** None for firmware reboot

**Will this fix PM2 restart?**
**Answer:** ❌ NO
- **Reason:** DeviceRegistry is cleared on PM2 restart
- **Gap:** No registration persistence
- **Required:** Database/file persistence

**Will this fix backend restart?**
**Answer:** ❌ NO
- **Reason:** DeviceRegistry is cleared on backend restart
- **Gap:** No registration persistence
- **Required:** Database/file persistence

**Will this fix VPS reboot?**
**Answer:** ❌ NO
- **Reason:** DeviceRegistry is cleared on VPS reboot
- **Gap:** No registration persistence
- **Required:** Database/file persistence

### 6.3 Remaining Gaps

**Gap 1: Registration Persistence (CRITICAL)**
- **Issue:** DeviceRegistry is in-memory only
- **Impact:** All registrations lost on backend restart
- **Required:** Database/file persistence (SQLite, Redis, or PostgreSQL)

**Gap 2: Token Validation (CRITICAL)**
- **Issue:** Token not validated
- **Impact:** Spoofing possible
- **Required:** Token validation in handlers.js

**Gap 3: DeviceId Validation (HIGH)**
- **Issue:** deviceId not validated beyond format
- **Impact:** Spoofing possible
- **Required:** deviceId authentication mechanism

---

## SECTION 7: DEVICE IDENTITY MODEL

### 7.1 Current Model

**MODEL A: deviceId only**

**Implementation:**
- deviceId is MAC-based (esp32-XXXX)
- Token is generated but not validated
- No authentication mechanism
- No persistence

**Issues:**
- No authentication
- No persistence
- Spoofing possible
- Cloning possible

---

### 7.2 Recommended Model

**MODEL C: deviceId + token + registration persistence**

**Implementation:**
- deviceId is MAC-based (esp32-XXXX)
- Token is generated once per device identity
- Token is validated on every connection
- Registration is persisted to database
- Token is persisted to database

**Benefits:**
- Authentication via token validation
- Persistence via database
- Spoofing protection via token validation
- Cloning protection via token validation

**Required Changes:**
1. Add database persistence (SQLite, Redis, or PostgreSQL)
2. Add token validation in handlers.js
3. Use token from DeviceRegistry (proposed fix)
4. Add deviceId authentication mechanism

---

### 7.3 Alternative Models

**MODEL B: deviceId + token**
- **Pros:** Better than current model
- **Cons:** No persistence
- **Verdict:** INSUFFICIENT

**MODEL D: deviceId + token + certificate**
- **Pros:** Strong authentication
- **Cons:** Complex implementation
- **Verdict:** OVERKILL for Phase A

---

## SECTION 8: SECURITY REVIEW

### 8.1 Identity Collision Risks

**Risk Level:** HIGH

**Scenario:** Two devices with same deviceId

**Current Behavior:**
- Backend accepts second device
- Backend overwrites first device's registration
- First device loses identity
- Second device takes over identity

**Evidence:**
- DeviceRegistry.register() overwrites existing registration (line 49)
- No collision detection
- No conflict resolution

**Mitigation:**
- Add collision detection
- Add conflict resolution
- Add deviceId authentication

---

### 8.2 Spoofing Risks

**Risk Level:** HIGH

**Scenario:** Attacker spoofs deviceId

**Current Behavior:**
- Attacker generates deviceId (esp32-XXXX)
- Attacker connects to WebSocket
- Backend accepts spoofed deviceId
- Attacker takes over identity

**Evidence:**
- No deviceId validation beyond format
- No token validation
- No authentication mechanism

**Mitigation:**
- Add token validation
- Add deviceId authentication
- Add certificate-based authentication

---

### 8.3 Token Replay Risks

**Risk Level:** MEDIUM

**Scenario:** Attacker replays token

**Current Behavior:**
- Token changes on every connection
- Replay not possible due to token instability
- But token is not validated anyway

**Evidence:**
- Token not validated
- Token changes on every connection

**Mitigation:**
- Add token validation
- Add token expiration
- Add token rotation

---

### 8.4 Cloning Risks

**Risk Level:** HIGH

**Scenario:** Firmware cloned to another ESP32

**Current Behavior:**
- Attacker clones firmware
- Cloned device has same deviceId
- Cloned device connects to WebSocket
- Backend accepts cloned device
- Original device loses identity

**Evidence:**
- deviceId is MAC-based (can be cloned)
- No token validation
- No authentication mechanism
- No cloning detection

**Mitigation:**
- Add token validation
- Add certificate-based authentication
- Add hardware fingerprinting
- Add device fingerprinting

---

## SECTION 9: FACTORY RESET DESIGN

### 9.1 Recommended Factory Reset Behavior

**Clear:**
- ✅ WiFi credentials (ssid, password)
- ✅ Worker name (worker)
- ✅ Wallet address (wallet)
- ✅ Token (token)
- ✅ Registration flag (registered)
- ✅ Statistics (acceptedShares, rejectedShares, uptime)

**Preserve:**
- ✅ Device ID (computed from MAC, cannot be cleared)
- ✅ Device type (hardcoded in firmware)

### 9.2 Factory Reset Implementation

**Code:**
```cpp
void factoryReset() {
  Serial.println("[FACTORY_RESET] Clearing configuration...");
  
  preferences.begin("bitmind", false);
  preferences.clear();
  preferences.end();
  
  Serial.println("[FACTORY_RESET] Configuration cleared");
  Serial.println("[FACTORY_RESET] Rebooting...");
  
  delay(1000);
  ESP.restart();
}
```

**Trigger Options:**
- Button press (GPIO pin)
- AP mode timeout (e.g., 10 minutes)
- Special command via serial
- Special command via WebSocket

### 9.3 Factory Reset Behavior

**After Factory Reset:**
- Device enters AP mode
- User must reconfigure WiFi
- User must reconfigure worker name
- User must reconfigure wallet address
- Device re-registers with backend
- Backend generates new token
- Device receives new token

**Registration State:**
- Backend registration preserved (if backend not restarted)
- Device identity changed (new configuration)
- Token changed (new token)

---

## SECTION 10: ROOT CAUSE ANALYSIS

### 10.1 Classification

**Answer:** D. Core Architectural Defect

### 10.2 Evidence

**Evidence 1: No Registration Persistence**
- DeviceRegistry is in-memory Map
- No database persistence
- No file persistence
- All registrations lost on backend restart

**Evidence 2: No Token Validation**
- Token not validated in handlers.js
- Token not validated in deviceGateway.js
- Token not validated in deviceRegistry.js
- No authentication mechanism

**Evidence 3: Token Instability**
- handlers.js generates new token on every connection
- Token changes on every WebSocket connection
- Token not stable across reconnections

**Evidence 4: No Device Identity Model**
- deviceId is not authenticated
- deviceId is not validated
- No mechanism to prevent spoofing
- No mechanism to prevent cloning

### 10.3 Impact

**Impact:** CRITICAL
- No persistent device identity
- No authentication mechanism
- Device spoofing possible
- Cloning attacks possible
- All registrations lost on backend restart

### 10.4 Scope

**Scope:** CORE ARCHITECTURE
- Not a cosmetic issue
- Not a minor bug
- Not a major bug
- Core architectural defect

---

## FINAL QUESTIONS

### Q1. Is the proposed token fix sufficient?

**Answer:** ❌ NO

**Evidence:**
- Proposed fix only addresses token generation in handlers.js
- Does NOT address registration persistence
- Does NOT address token validation
- Does NOT address deviceId authentication
- Does NOT fix backend/PM2/VPS restart scenarios

**Remaining Gaps:**
1. Registration persistence (CRITICAL)
2. Token validation (CRITICAL)
3. DeviceId authentication (HIGH)

---

### Q2. If not, what additional fixes are required?

**Answer:** THREE ADDITIONAL FIXES REQUIRED

**Fix 1: Registration Persistence (CRITICAL)**
- Add database persistence (SQLite, Redis, or PostgreSQL)
- Persist DeviceRegistry to database
- Load DeviceRegistry from database on startup
- Survive backend/PM2/VPS restart

**Fix 2: Token Validation (CRITICAL)**
- Add token validation in handlers.js
- Validate token on every WebSocket connection
- Reject invalid tokens
- Prevent token spoofing

**Fix 3: DeviceId Authentication (HIGH)**
- Add deviceId authentication mechanism
- Validate deviceId beyond format check
- Prevent deviceId spoofing
- Prevent cloning attacks

---

### Q3. Does Bitmind currently have persistent device identity?

**Answer:** ❌ NO

**Evidence:**
- DeviceRegistry is in-memory Map only
- No database persistence
- No file persistence
- All registrations lost on backend restart
- Token changes on every connection
- No authentication mechanism

**Current State:**
- deviceId is MAC-based (can be spoofed)
- Token is generated but not validated
- No persistence
- No authentication

---

### Q4. Can onboarding implementation safely proceed?

**Answer:** ❌ NO

**Evidence:**
- No persistent device identity
- No authentication mechanism
- Device spoofing possible
- Cloning attacks possible
- All registrations lost on backend restart

**Risk:**
- Onboarding implementation will build on broken architecture
- Worker name and wallet address will be lost on backend restart
- Device identity will be lost on backend restart
- Security vulnerabilities will persist

---

### Q5. Or must identity architecture be fixed first?

**Answer:** ✅ YES

**Evidence:**
- Identity architecture is core architectural defect
- Cannot build on broken foundation
- Must fix persistence first
- Must fix authentication first
- Must fix token validation first

**Priority:**
- Identity architecture fixes must be Priority 0
- Onboarding implementation must be blocked until identity architecture is fixed

---

### Q6. What should become F5 Priority 0?

**Answer:** IDENTITY ARCHITECTURE FIX

**Priority 0 (CRITICAL):**
1. Add registration persistence (database/file)
2. Add token validation in handlers.js
3. Use token from DeviceRegistry (proposed fix)
4. Add deviceId authentication mechanism

**Priority 1 (CRITICAL - BLOCKED):**
- Add workerName and walletAddress to device.register (BLOCKED until Priority 0 complete)

**Priority 2 (HIGH - BLOCKED):**
- Backend virtual device changes (BLOCKED until Priority 0 complete)

**Priority 3 (MEDIUM - BLOCKED):**
- Frontend UI changes (BLOCKED until Priority 0 complete)

**Priority 4 (LOW - BLOCKED):**
- Documentation updates (BLOCKED until Priority 0 complete)

**Rationale:**
- Identity architecture is core architectural defect
- Cannot proceed with onboarding without persistent identity
- Cannot proceed with onboarding without authentication
- Must fix foundation before building features

---

## CONCLUSION

**Audit Result:** ❌ CRITICAL ARCHITECTURAL DEFECT FOUND

**Root Cause:** D. Core Architectural Defect

**Required Action:** MUST FIX IDENTITY ARCHITECTURE BEFORE PROCEEDING

**Priority 0:**
1. Add registration persistence (database/file)
2. Add token validation in handlers.js
3. Use token from DeviceRegistry (proposed fix)
4. Add deviceId authentication mechanism

**Status:** BLOCKED - Onboarding implementation must wait until identity architecture is fixed

**Recommendation:** STOP ONBOARDING IMPLEMENTATION, FIX IDENTITY ARCHITECTURE FIRST
