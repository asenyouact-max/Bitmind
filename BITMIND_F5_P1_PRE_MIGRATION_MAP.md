# BITMIND F5-P1 PRE-MIGRATION MAP

**Phase:** F5-P1 - Identity Architecture Implementation  
**Date:** 2026-06-21  
**Status:** PRE-MIGRATION ANALYSIS  
**Purpose:** Map current DeviceRegistry usage before migration to RegistrationStore

---

## EXECUTIVE SUMMARY

**Migration Target:** Replace DeviceRegistry (in-memory Map) with RegistrationStore (SQLite database)

**Current State:**
- DeviceRegistry is in-memory Map
- Used by handlers.js, routes.js, and state/index.js
- No persistence
- All registrations lost on backend restart

**Target State:**
- RegistrationStore with SQLite backend
- Persistent storage
- Token validation
- Duplicate detection

**Migration Strategy:** Direct replacement (no coexistence)

**Risk Level:** MEDIUM

**Estimated Effort:** 4-6 hours

---

## SECTION 1: CURRENT DEVICEREGISTRY USAGE

### 1.1 DeviceRegistry Definition

**File:** `server/services/deviceRegistry.js`

**Type:** In-memory Map

**Structure:**
```javascript
const registry = new Map(); // deviceId -> deviceRegistration
```

**Registration Record:**
```javascript
{
  deviceId: string,
  registeredAt: number,
  status: 'registered',
  token: string,
  metadata: {
    deviceType: string,
    walletAddress: string,
    workerName: string,
    firmwareVersion: string
  }
}
```

### 1.2 DeviceRegistry Methods

**register(deviceId, metadata)**
- Creates or updates registration
- Generates token on first registration
- Preserves token on updates
- Used by: handlers.js, routes.js

**isRegistered(deviceId)**
- Checks if device is registered
- Used by: handlers.js

**getRegistration(deviceId)**
- Gets device registration
- Used by: handlers.js (joinDeviceState)

**unregister(deviceId)**
- Removes device registration
- Used by: None (not actively used)

**getAllRegistrations()**
- Gets all registrations
- Used by: None (not actively used)

**getRegistrationCount()**
- Gets registration count
- Used by: None (not actively used)

**isDevClient(deviceId)**
- Checks if device is dev client
- Used by: handlers.js

**clear()**
- Clears all registrations
- Used by: Testing only

---

## SECTION 2: DEVICEREGISTRY DEPENDENCIES

### 2.1 Direct Dependencies

**File:** `server/ws/handlers.js`

**Usage Points:**
- Line 9: `const DeviceRegistry = require('../services/deviceRegistry');`
- Line 10: `const deviceGateway = require('../gateway/deviceGateway');`
- Line 147: `const isRegistered = DeviceRegistry.isRegistered(deviceId);`
- Line 148: `const isDevClient = DeviceRegistry.isDevClient(deviceId);`
- Line 155: `DeviceRegistry.register(deviceId, { deviceType: 'web-client' });`
- Line 161: `DeviceRegistry.register(deviceId, { deviceType: data.deviceType || 'miner', workerName: data.workerName, walletAddress: data.walletAddress, firmwareVersion: data.firmwareVersion });`
- Line 170: `if (!DeviceRegistry.isRegistered(deviceId))`
- Line 20: `const registration = DeviceRegistry.getRegistration(deviceId);` (in joinDeviceState)

**Impact:** HIGH - handlers.js is critical for WebSocket device registration

---

**File:** `server/api/routes.js`

**Usage Points:**
- Line 8: `const DeviceRegistry = require('../services/deviceRegistry');`
- Line 38: `const registration = DeviceRegistry.register(deviceId, { deviceType: deviceType || 'esp32', walletAddress: walletAddress.trim(), workerName: workerName.trim() });`
- Line 61: `const registration = DeviceRegistry.register(deviceId, { deviceType: deviceType || 'esp32', walletAddress: walletAddress.trim(), workerName: workerName.trim() });`
- Line 547: `const registration = DeviceRegistry.register(deviceId, { deviceType: deviceType || 'esp32', walletAddress: walletAddress.trim(), workerName: workerName.trim() });`

**Impact:** HIGH - routes.js is critical for REST API device registration

---

### 2.2 Indirect Dependencies

**File:** `server/state/index.js`

**Usage Points:**
- None (state/index.js does not directly use DeviceRegistry)
- Note: handlers.js joins DeviceRegistry with state/index.js via joinDeviceState()

**Impact:** LOW - No direct dependency

---

### 2.3 Dependency Graph

```
DeviceRegistry (in-memory Map)
├── handlers.js (WebSocket registration)
│   ├── register() - auto-register ESP32 devices
│   ├── isRegistered() - check registration status
│   ├── isDevClient() - check dev client
│   └── getRegistration() - join with state
└── routes.js (REST API registration)
    ├── register() - /device/register endpoint
    ├── register() - /api/miners endpoint
    └── register() - /api/miners/connect endpoint
```

---

## SECTION 3: MIGRATION STRATEGY

### 3.1 Replacement Strategy

**Approach:** Direct replacement (no coexistence)

**Rationale:**
- Single source of truth
- Simpler architecture
- No synchronization complexity
- Clear ownership

### 3.2 Migration Steps

**Step 1: Create RegistrationStore Interface**
- File: `server/services/registrationStore.js` (new)
- Define interface methods
- No implementation yet

**Step 2: Implement SQLiteRegistrationStore**
- File: `server/services/registrationStore/sqlite.js` (new)
- Implement all interface methods
- Add database schema
- Add initialization logic

**Step 3: Update handlers.js**
- Replace `const DeviceRegistry = require('../services/deviceRegistry')`
- Add `const RegistrationStore = require('../services/registrationStore')`
- Add `const SQLiteRegistrationStore = require('../services/registrationStore/sqlite')`
- Initialize RegistrationStore on startup
- Replace all DeviceRegistry calls with RegistrationStore calls
- Update joinDeviceState to use RegistrationStore

**Step 4: Update routes.js**
- Replace `const DeviceRegistry = require('../services/deviceRegistry')`
- Add `const RegistrationStore = require('../services/registrationStore')`
- Add `const SQLiteRegistrationStore = require('../services/registrationStore/sqlite')`
- Initialize RegistrationStore on startup
- Replace all DeviceRegistry calls with RegistrationStore calls

**Step 5: Update server/index.js**
- Add RegistrationStore initialization
- Add database file path configuration
- Add error handling for database initialization

**Step 6: Remove DeviceRegistry**
- File: `server/services/deviceRegistry.js` (delete)
- No longer needed

**Step 7: Test**
- Unit tests for RegistrationStore
- Integration tests for handlers.js
- Integration tests for routes.js
- End-to-end tests for registration flow

**Step 8: Deploy**
- Backup existing data (none, in-memory only)
- Deploy new code
- Monitor for issues

### 3.3 Code Changes Summary

**New Files:**
- `server/services/registrationStore.js` (interface)
- `server/services/registrationStore/sqlite.js` (implementation)
- `server/data/registrations.db` (database file, auto-created)

**Modified Files:**
- `server/ws/handlers.js` (replace DeviceRegistry with RegistrationStore)
- `server/api/routes.js` (replace DeviceRegistry with RegistrationStore)
- `server/index.js` (add RegistrationStore initialization)

**Deleted Files:**
- `server/services/deviceRegistry.js` (no longer needed)

---

## SECTION 4: API MAPPING

### 4.1 Method Mapping

**DeviceRegistry → RegistrationStore**

| DeviceRegistry Method | RegistrationStore Method | Change Type |
|----------------------|--------------------------|-------------|
| `register(deviceId, metadata)` | `registerDevice(deviceId, metadata)` | Rename (async) |
| `isRegistered(deviceId)` | `isRegistered(deviceId)` | Same (async) |
| `getRegistration(deviceId)` | `getDevice(deviceId)` | Rename (async) |
| `unregister(deviceId)` | `removeDevice(deviceId)` | Rename (async) |
| `getAllRegistrations()` | `getAllRegistrations()` | Same (async) |
| `getRegistrationCount()` | `getRegistrationCount()` | Same (async) |
| `isDevClient(deviceId)` | `isDevClient(deviceId)` | Same (helper) |
| `clear()` | `clear()` | Same (async) |

### 4.2 handlers.js Changes

**Before:**
```javascript
const DeviceRegistry = require('../services/deviceRegistry');

const isRegistered = DeviceRegistry.isRegistered(deviceId);
const isDevClient = DeviceRegistry.isDevClient(deviceId);
DeviceRegistry.register(deviceId, { deviceType: 'web-client' });
DeviceRegistry.register(deviceId, { deviceType: data.deviceType || 'miner', workerName: data.workerName, walletAddress: data.walletAddress, firmwareVersion: data.firmwareVersion });
if (!DeviceRegistry.isRegistered(deviceId)) {
const registration = DeviceRegistry.getRegistration(deviceId);
```

**After:**
```javascript
const RegistrationStore = require('../services/registrationStore');
const SQLiteRegistrationStore = require('../services/registrationStore/sqlite');

const registrationStore = new SQLiteRegistrationStore('./server/data/registrations.db');
await registrationStore.initialize();

const isRegistered = await registrationStore.isRegistered(deviceId);
const isDevClient = DeviceRegistry.isDevClient(deviceId); // Keep as helper
await registrationStore.registerDevice(deviceId, { deviceType: 'web-client' });
await registrationStore.registerDevice(deviceId, { deviceType: data.deviceType || 'miner', workerName: data.workerName, walletAddress: data.walletAddress, firmwareVersion: data.firmwareVersion });
if (!(await registrationStore.isRegistered(deviceId))) {
const registration = await registrationStore.getDevice(deviceId);
```

**Key Changes:**
- All methods are now async
- Method names changed (register → registerDevice, getRegistration → getDevice)
- await keywords added

### 4.3 routes.js Changes

**Before:**
```javascript
const DeviceRegistry = require('../services/deviceRegistry');

const registration = DeviceRegistry.register(deviceId, { deviceType: deviceType || 'esp32', walletAddress: walletAddress.trim(), workerName: workerName.trim() });
```

**After:**
```javascript
const RegistrationStore = require('../services/registrationStore');
const SQLiteRegistrationStore = require('../services/registrationStore/sqlite');

const registrationStore = new SQLiteRegistrationStore('./server/data/registrations.db');
await registrationStore.initialize();

const registration = await registrationStore.registerDevice(deviceId, { deviceType: deviceType || 'esp32', walletAddress: walletAddress.trim(), workerName: workerName.trim() });
```

**Key Changes:**
- All methods are now async
- Method names changed (register → registerDevice)
- await keywords added

---

## SECTION 5: RISK ASSESSMENT

### 5.1 Technical Risks

**Risk 1: Async Conversion**
- **Description:** All DeviceRegistry methods are synchronous, RegistrationStore methods are asynchronous
- **Impact:** MEDIUM
- **Mitigation:** Add await keywords to all RegistrationStore calls
- **Contingency:** Revert to DeviceRegistry if async issues occur

**Risk 2: Database Initialization Failure**
- **Description:** SQLite database may fail to initialize
- **Impact:** HIGH
- **Mitigation:** Add error handling for database initialization, fallback to in-memory Map
- **Contingency:** Revert to DeviceRegistry if database issues occur

**Risk 3: Performance Degradation**
- **Description:** SQLite may be slower than in-memory Map
- **Impact:** MEDIUM
- **Mitigation:** Add in-memory cache layer if performance issues occur
- **Contingency:** Revert to DeviceRegistry if performance issues occur

**Risk 4: Data Loss**
- **Description:** Database file may be corrupted
- **Impact:** MEDIUM
- **Mitigation:** Daily database backups, database integrity checks
- **Contingency:** Restore from backup if corruption occurs

### 5.2 Operational Risks

**Risk 1: Deployment Downtime**
- **Description:** Backend deployment may cause downtime
- **Impact:** MEDIUM
- **Mitigation:** Use rolling deployment, test in staging first
- **Contingency:** Revert deployment if issues occur

**Risk 2: Database File Permissions**
- **Description:** Database file may not have correct permissions
- **Impact:** MEDIUM
- **Mitigation:** Set correct permissions on database file, check permissions on startup
- **Contingency:** Fix permissions if issues occur

**Risk 3: Database Lock**
- **Description:** SQLite may have file lock issues
- **Impact:** LOW
- **Mitigation:** Use WAL mode, handle lock errors gracefully
- **Contingency:** Restart backend if lock issues occur

### 5.3 Compatibility Risks

**Risk 1: Firmware Compatibility**
- **Description:** Firmware may not work with new RegistrationStore
- **Impact:** LOW
- **Mitigation:** No protocol changes, firmware uses same device.register message
- **Contingency:** None required (no protocol changes)

**Risk 2: Frontend Compatibility**
- **Description:** Frontend may not work with new RegistrationStore
- **Impact:** LOW
- **Mitigation:** No API changes, frontend uses same API endpoints
- **Contingency:** None required (no API changes)

---

## SECTION 6: ROLLBACK PLAN

### 6.1 Rollback Triggers

**Trigger 1: Database Initialization Failure**
- Backend fails to start
- Database initialization errors in logs
- **Action:** Revert to DeviceRegistry

**Trigger 2: Performance Degradation**
- Registration latency > 100ms
- Device registration failures
- **Action:** Revert to DeviceRegistry

**Trigger 3: Data Corruption**
- Database integrity check fails
- Registration data missing
- **Action:** Restore from backup or revert to DeviceRegistry

**Trigger 4: Critical Bugs**
- Devices cannot register
- Devices cannot reconnect
- **Action:** Revert to DeviceRegistry

### 6.2 Rollback Steps

**Step 1: Revert Code**
- Restore `server/services/deviceRegistry.js`
- Revert `server/ws/handlers.js`
- Revert `server/api/routes.js`
- Revert `server/index.js`
- Delete `server/services/registrationStore.js`
- Delete `server/services/registrationStore/sqlite.js`
- Delete `server/data/registrations.db`

**Step 2: Restart Backend**
- PM2 restart backend
- Verify backend starts successfully
- Verify DeviceRegistry initializes

**Step 3: Verify Operations**
- Test device registration
- Test device reconnection
- Verify dashboard displays devices

**Step 4: Monitor**
- Monitor logs for errors
- Monitor device registration success rate
- Monitor device reconnection success rate

**Rollback Time:** 10 minutes

---

## SECTION 7: TESTING STRATEGY

### 7.1 Unit Tests

**RegistrationStore Tests:**
- Test registerDevice() creates new registration
- Test registerDevice() updates existing registration
- Test getDevice() returns registration
- Test getDevice() returns null for non-existent device
- Test updateDevice() updates registration
- Test removeDevice() removes registration
- Test validateToken() validates token
- Test isRegistered() checks registration status
- Test getAllRegistrations() returns all registrations
- Test getRegistrationCount() returns count
- Test clear() clears all registrations

**SQLiteRegistrationStore Tests:**
- Test database initialization
- Test database schema creation
- Test database persistence (restart)
- Test database backup/restore

### 7.2 Integration Tests

**handlers.js Tests:**
- Test device registration with new RegistrationStore
- Test device reconnection with new RegistrationStore
- Test ESP32 auto-registration with new RegistrationStore
- Test virtual device rejection with new RegistrationStore
- Test joinDeviceState with new RegistrationStore

**routes.js Tests:**
- Test /device/register endpoint with new RegistrationStore
- Test /api/miners/connect endpoint with new RegistrationStore
- Test virtual device creation with new RegistrationStore

### 7.3 End-to-End Tests

**Registration Flow:**
- Test ESP32 device registration
- Test virtual device registration
- Test device reconnection
- Test device registration after backend restart
- Test device registration after PM2 restart

**Token Lifecycle:**
- Test token generation on first registration
- Test token preservation on reconnection
- Test token preservation on backend restart
- Test token preservation on firmware reboot

### 7.4 Performance Tests

**Load Testing:**
- Test 10 concurrent registrations
- Test 100 concurrent registrations
- Test 1,000 concurrent registrations
- Measure registration latency
- Measure database query latency

---

## SECTION 8: DEPLOYMENT CHECKLIST

### 8.1 Pre-Deployment

- [ ] RegistrationStore interface implemented
- [ ] SQLiteRegistrationStore implemented
- [ ] handlers.js updated
- [ ] routes.js updated
- [ ] server/index.js updated
- [ ] Unit tests passed
- [ ] Integration tests passed
- [ ] End-to-end tests passed
- [ ] Performance tests passed
- [ ] Database backup strategy documented
- [ ] Rollback plan documented
- [ ] Monitoring configured

### 8.2 Deployment

- [ ] Backup current code
- [ ] Deploy new code to staging
- [ ] Test in staging
- [ ] Deploy new code to production
- [ ] Verify backend starts
- [ ] Verify database initializes
- [ ] Test device registration
- [ ] Test device reconnection
- [ ] Monitor logs for errors

### 8.3 Post-Deployment

- [ ] Verify device registration works
- [ ] Verify device reconnection works
- [ ] Verify dashboard displays devices
- [ ] Monitor registration success rate
- [ ] Monitor reconnection success rate
- [ ] Monitor database performance
- [ ] Monitor database file size
- [ ] Verify no errors in logs

---

## SECTION 9: POST-MIGRATION TASKS

### 9.1 Immediate Tasks

- [ ] Monitor device registration success rate
- [ ] Monitor device reconnection success rate
- [ ] Monitor database performance
- [ ] Monitor database file size
- [ ] Verify no errors in logs

### 9.2 Short-Term Tasks (1 week)

- [ ] Add database backup automation
- [ ] Add database integrity checks
- [ ] Add database performance monitoring
- [ ] Add database size monitoring
- [ ] Document database maintenance procedures

### 9.3 Long-Term Tasks (1 month)

- [ ] Evaluate performance at scale
- [ ] Plan PostgreSQL migration if needed
- [ ] Plan Redis cache layer if needed
- [ ] Update BITMIND_CANONICAL_STATE.md
- [ ] Update documentation

---

## SECTION 10: SUCCESS CRITERIA

### 10.1 Functional Success

- [ ] Devices can register via WebSocket
- [ ] Devices can register via REST API
- [ ] Devices can reconnect successfully
- [ ] Registrations persist after backend restart
- [ ] Registrations persist after PM2 restart
- [ ] Registrations persist after VPS reboot
- [ ] Token is preserved across reconnections
- [ ] Dashboard displays devices correctly

### 10.2 Performance Success

- [ ] Registration latency < 100ms
- [ ] Reconnection latency < 100ms
- [ ] Database query latency < 50ms
- [ ] No performance degradation compared to DeviceRegistry

### 10.3 Reliability Success

- [ ] No database initialization failures
- [ ] No database lock issues
- [ ] No data corruption
- [ ] No data loss
- [ ] No errors in logs

---

## CONCLUSION

**Migration Status:** READY FOR IMPLEMENTATION

**Migration Strategy:** Direct replacement of DeviceRegistry with RegistrationStore

**Risk Level:** MEDIUM

**Estimated Effort:** 4-6 hours

**Rollback Time:** 10 minutes

**Recommendation:** PROCEED WITH MIGRATION

**Next Steps:**
1. Review and approve pre-migration map
2. Begin F5-P1 implementation
3. Create RegistrationStore interface
4. Implement SQLiteRegistrationStore
5. Update handlers.js
6. Update routes.js
7. Update server/index.js
8. Test thoroughly
9. Deploy to production
10. Monitor and verify

**Status:** READY FOR IMPLEMENTATION
