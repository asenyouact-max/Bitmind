# BITMIND F5 IMPLEMENTATION PLAN

**Phase:** F5 - Onboarding Alignment Implementation  
**Date:** 2026-06-21  
**Status:** IMPLEMENTATION PLAN  
**Purpose:** Detailed implementation plan for F4 onboarding architecture alignment

---

## EXECUTIVE SUMMARY

**Implementation Scope:** Align backend and firmware with F4 hybrid onboarding architecture

**Total Changes:** 4 files
- Firmware: 1 file (1 critical change)
- Backend: 2 files (3 minor changes)
- Frontend: 1 file (UI changes - not in workspace)

**Risk Level:** LOW
- All changes are backward compatible
- No protocol breaking changes
- No database migrations required

**Estimated Effort:** 2-3 hours

---

## SECTION 1: FILES TO MODIFY

### 1.1 Firmware Changes

**File:** `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`

**Lines:** 308-313

**Change Type:** CRITICAL

**Description:** Add workerName and walletAddress to device.register payload

**Current Code:**
```cpp
String message = "{\"type\":\"device.register\",";
message += "\"deviceId\":\"" + deviceId + "\",";
message += "\"deviceType\":\"" + String(DEVICE_TYPE) + "\",";
message += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
message += "\"capabilities\":{\"oled\":false,\"wifi\":true,\"stratum\":true}";
message += "}";
```

**New Code:**
```cpp
String message = "{\"type\":\"device.register\",";
message += "\"deviceId\":\"" + deviceId + "\",";
message += "\"deviceType\":\"" + String(DEVICE_TYPE) + "\",";
message += "\"firmwareVersion\":\"" + String(FIRMWARE_VERSION) + "\",";
message += "\"workerName\":\"" + config.workerName + "\",";
message += "\"walletAddress\":\"" + config.wallet + "\",";
message += "\"capabilities\":{\"oled\":false,\"wifi\":true,\"stratum\":true}";
message += "}";
```

**Impact:** HIGH
- Enables backend auto-registration with user-provided identity
- Aligns with F4 architecture (firmware → backend sync)
- Backward compatible (fields are optional in backend)

---

### 1.2 Backend Changes

**File:** `server/api/routes.js`

**Lines:** 547, 551

**Change Type:** MINOR

**Description:** Add virtual- prefix to virtual device IDs and set deviceType to 'virtual_client'

**Current Code (line 547):**
```javascript
const deviceId = crypto.randomBytes(16).toString('hex');
```

**New Code (line 547):**
```javascript
const deviceId = 'virtual-' + crypto.randomBytes(8).toString('hex');
```

**Current Code (line 551):**
```javascript
deviceType: deviceType || 'esp32',
```

**New Code (line 551):**
```javascript
deviceType: deviceType || 'virtual_client',
```

**Impact:** MEDIUM
- Clear distinction between hardware and virtual devices
- Aligns with F4 architecture (device type distinction)
- Backward compatible (existing virtual devices continue to work)

---

**File:** `server/ws/handlers.js`

**Lines:** 149, 170

**Change Type:** MINOR

**Description:** Add virtual- prefix check for MODEL B devices

**Current Code (line 149):**
```javascript
const isEsp32Device = deviceId && deviceId.startsWith('esp32-');
```

**New Code (line 149):**
```javascript
const isEsp32Device = deviceId && deviceId.startsWith('esp32-');
const isVirtualDevice = deviceId && deviceId.startsWith('virtual-');
```

**Current Code (line 170):**
```javascript
// If still not registered (non-ESP32, non-dev-client), reject
if (!DeviceRegistry.isRegistered(deviceId)) {
```

**New Code (line 170):**
```javascript
// MODEL B: Virtual devices must be pre-registered via REST API
if (!isRegistered && isVirtualDevice) {
  console.log("[WS] DEVICE_REJECTED_UNREGISTERED deviceId=" + deviceId);
  const errorMsg = deviceGateway.createDeviceError('AUTH_INVALID', 'Device must be registered via REST API before WebSocket connection');
  ws.send(JSON.stringify(errorMsg));
  return false;
}

// If still not registered (non-ESP32, non-dev-client, non-virtual), reject
if (!DeviceRegistry.isRegistered(deviceId)) {
```

**Impact:** MEDIUM
- Enables MODEL B for virtual devices
- Aligns with F4 architecture (dual-path onboarding)
- Backward compatible (existing virtual devices continue to work)

---

### 1.3 Frontend Changes

**File:** `bitmind-ui/src/pages/Landing.jsx` (not in workspace)

**Change Type:** UI

**Description:** Rename "Connect Miner" to "Add Virtual Device"

**Changes Required:**
- Rename button text
- Update modal title
- Add tooltip explaining purpose
- Add device type indicator in dashboard
- Add visual distinction for virtual devices

**Impact:** LOW
- UI text change only
- No backend API changes
- No protocol changes

---

## SECTION 2: IMPLEMENTATION SEQUENCE

### 2.1 Phase 1: Firmware Changes (CRITICAL)

**Step 1.1:** Modify `esp32_firmware/bitmind_legacy_v1/bitmind_legacy_v1.ino`
- Add workerName to device.register payload
- Add walletAddress to device.register payload
- Test compilation

**Step 1.2:** Flash firmware to test device
- Flash modified firmware
- Verify device boots
- Verify AP mode works
- Verify device.register payload includes new fields

**Step 1.3:** Test backend auto-registration
- Connect device to backend
- Verify device auto-registers
- Verify workerName and walletAddress are stored
- Verify device appears in dashboard

**Step 1.4:** Test backward compatibility
- Test with old firmware (without new fields)
- Verify backend accepts old payload
- Verify device still registers

**Estimated Time:** 60 minutes

---

### 2.2 Phase 2: Backend Changes (HIGH)

**Step 2.1:** Modify `server/api/routes.js`
- Add virtual- prefix to device IDs
- Set deviceType to 'virtual_client'
- Test compilation

**Step 2.2:** Modify `server/ws/handlers.js`
- Add isVirtualDevice check
- Add MODEL B rejection logic
- Test compilation

**Step 2.3:** Test virtual device registration
- Create virtual device via POST /api/miners/connect
- Verify device ID has virtual- prefix
- Verify deviceType is 'virtual_client'
- Verify device appears in dashboard

**Step 2.4:** Test MODEL B rejection
- Attempt WebSocket connection with unregistered virtual device
- Verify device is rejected
- Verify error message is correct

**Step 2.5:** Test backward compatibility
- Test with existing virtual devices (without virtual- prefix)
- Verify existing devices continue to work
- Verify existing devices can reconnect

**Estimated Time:** 60 minutes

---

### 2.3 Phase 3: Frontend Changes (MEDIUM)

**Step 3.1:** Modify `bitmind-ui/src/pages/Landing.jsx`
- Rename button to "Add Virtual Device"
- Update modal title
- Add tooltip
- Add device type indicator
- Add visual distinction

**Step 3.2:** Test UI changes
- Verify button text is updated
- Verify modal title is updated
- Verify tooltip appears
- Verify device type indicator works
- Verify visual distinction works

**Step 3.3:** Test virtual device creation
- Create virtual device via UI
- Verify device appears in dashboard
- Verify device type is shown
- Verify visual distinction is applied

**Estimated Time:** 30 minutes

---

### 2.4 Phase 4: Integration Testing (HIGH)

**Step 4.1:** Test end-to-end ESP32 onboarding
- Boot ESP32 device
- Configure via AP mode
- Verify device registers
- Verify device appears in dashboard
- Verify device starts mining

**Step 4.2:** Test end-to-end virtual device onboarding
- Create virtual device via UI
- Verify device registers
- Verify device appears in dashboard
- Verify device starts mining

**Step 4.3:** Test dual-path architecture
- Verify ESP32 devices use MODEL A
- Verify virtual devices use MODEL B
- Verify both paths work independently
- Verify both paths coexist

**Step 4.4:** Test error scenarios
- Test unregistered ESP32 device (should auto-register)
- Test unregistered virtual device (should reject)
- Test invalid device ID format
- Test missing required fields

**Estimated Time:** 30 minutes

---

## SECTION 3: RISK ASSESSMENT

### 3.1 Technical Risks

**Risk 1: Firmware payload size increase**
- **Description:** Adding workerName and walletAddress increases device.register payload size
- **Impact:** LOW
- **Mitigation:** Payload size increase is minimal (< 100 bytes)
- **Contingency:** None required

**Risk 2: Virtual device ID collision**
- **Description:** virtual- prefix could collide with existing device IDs
- **Impact:** LOW
- **Mitigation:** virtual- prefix is new, no existing devices use it
- **Contingency:** Use different prefix if collision occurs

**Risk 3: Backend validation rejection**
- **Description:** Backend could reject new firmware payload
- **Impact:** MEDIUM
- **Mitigation:** Backend validation allows optional fields
- **Contingency:** Revert firmware change if rejection occurs

**Risk 4: WebSocket message concatenation**
- **Description:** Adding fields could trigger message concatenation race condition
- **Impact:** LOW
- **Mitigation:** 500ms delay already implemented in firmware
- **Contingency:** Increase delay if concatenation occurs

---

### 3.2 Operational Risks

**Risk 1: Deployment downtime**
- **Description:** Backend deployment could cause downtime
- **Impact:** MEDIUM
- **Mitigation:** Use rolling deployment
- **Contingency:** Revert deployment if issues occur

**Risk 2: Firmware flash failure**
- **Description:** Firmware flash could fail
- **Impact:** MEDIUM
- **Mitigation:** Test firmware on single device first
- **Contingency:** Revert to old firmware if flash fails

**Risk 3: Frontend deployment failure**
- **Description:** Frontend deployment could fail
- **Impact:** LOW
- **Mitigation:** Test frontend locally first
- **Contingency:** Revert frontend if deployment fails

---

### 3.3 Compatibility Risks

**Risk 1: Old firmware incompatibility**
- **Description:** Old firmware without new fields could fail
- **Impact:** LOW
- **Mitigation:** Backend validation allows optional fields
- **Contingency:** Revert backend change if incompatibility occurs

**Risk 2: Old virtual device incompatibility**
- **Description:** Old virtual devices without virtual- prefix could fail
- **Impact:** LOW
- **Mitigation:** Backend handles both old and new formats
- **Contingency:** Revert backend change if incompatibility occurs

---

## SECTION 4: MIGRATION STRATEGY

### 4.1 Firmware Migration

**Strategy:** Gradual rollout

**Steps:**
1. Flash modified firmware to test device
2. Verify device registers correctly
3. Verify workerName and walletAddress are synced
4. Flash to production devices
5. Monitor for issues

**Rollback:** Revert to old firmware if issues occur

**Data Migration:** None required (no data loss)

---

### 4.2 Backend Migration

**Strategy:** Rolling deployment

**Steps:**
1. Deploy backend changes to staging
2. Test virtual device registration
3. Test MODEL B rejection
4. Deploy to production
5. Monitor for issues

**Rollback:** Revert backend changes if issues occur

**Data Migration:** None required (no data loss)

---

### 4.3 Frontend Migration

**Strategy:** Standard deployment

**Steps:**
1. Deploy frontend changes to staging
2. Test UI changes
3. Test virtual device creation
4. Deploy to production
5. Monitor for issues

**Rollback:** Revert frontend changes if issues occur

**Data Migration:** None required (no data loss)

---

## SECTION 5: ROLLBACK STRATEGY

### 5.1 Firmware Rollback

**Trigger:**
- Device registration fails
- Backend rejects payload
- Device does not appear in dashboard

**Rollback Steps:**
1. Revert firmware change (remove workerName and walletAddress from device.register)
2. Flash old firmware to affected devices
3. Verify devices register with old firmware
4. Monitor for issues

**Rollback Time:** 15 minutes

---

### 5.2 Backend Rollback

**Trigger:**
- Virtual device registration fails
- MODEL B rejection logic fails
- Existing virtual devices cannot connect

**Rollback Steps:**
1. Revert routes.js changes (remove virtual- prefix, revert deviceType)
2. Revert handlers.js changes (remove isVirtualDevice check)
3. Deploy reverted backend
4. Verify virtual devices work with old format
5. Monitor for issues

**Rollback Time:** 10 minutes

---

### 5.3 Frontend Rollback

**Trigger:**
- UI changes cause confusion
- Virtual device creation fails
- Dashboard display issues

**Rollback Steps:**
1. Revert UI changes (rename button back to "Connect Miner")
2. Remove tooltip and device type indicator
3. Deploy reverted frontend
4. Verify UI works with old format
5. Monitor for issues

**Rollback Time:** 5 minutes

---

## SECTION 6: TESTING STRATEGY

### 6.1 Unit Testing

**Firmware:**
- Test device.register payload generation
- Test workerName and walletAddress inclusion
- Test payload size
- Test JSON validity

**Backend:**
- Test virtual device ID generation
- Test deviceType assignment
- Test isVirtualDevice check
- Test MODEL B rejection logic

**Frontend:**
- Test button text rendering
- Test modal title rendering
- Test tooltip display
- Test device type indicator

---

### 6.2 Integration Testing

**ESP32 Onboarding:**
- Test AP mode configuration
- Test device registration
- Test workerName and walletAddress sync
- Test device appearance in dashboard
- Test mining start

**Virtual Device Onboarding:**
- Test virtual device creation
- Test device registration
- Test device appearance in dashboard
- Test mining start

**Dual-Path Architecture:**
- Test ESP32 and virtual devices coexisting
- Test MODEL A and MODEL B independence
- Test device type distinction

---

### 6.3 Regression Testing

**Backward Compatibility:**
- Test old firmware without new fields
- Test old virtual devices without virtual- prefix
- Test existing ESP32 devices
- Test existing virtual devices

**Error Scenarios:**
- Test unregistered ESP32 device
- Test unregistered virtual device
- Test invalid device ID format
- Test missing required fields

---

## SECTION 7: DEPLOYMENT CHECKLIST

### 7.1 Pre-Deployment

- [ ] Firmware compiled successfully
- [ ] Firmware tested on test device
- [ ] Backend changes tested on staging
- [ ] Frontend changes tested on staging
- [ ] Integration tests passed
- [ ] Regression tests passed
- [ ] Rollback plan documented
- [ ] Monitoring configured

### 7.2 Deployment

- [ ] Firmware flashed to production devices
- [ ] Backend deployed to production
- [ ] Frontend deployed to production
- [ ] Smoke tests passed
- [ ] Monitoring verified

### 7.3 Post-Deployment

- [ ] ESP32 devices registering correctly
- [ ] Virtual devices registering correctly
- [ ] WorkerName and walletAddress syncing
- [ ] Device type distinction working
- [ ] No errors in logs
- [ ] Dashboard displaying correctly

---

## SECTION 8: SUCCESS CRITERIA

### 8.1 Firmware Success Criteria

- [ ] ESP32 devices send workerName in device.register
- [ ] ESP32 devices send walletAddress in device.register
- [ ] Backend auto-registers ESP32 devices with user identity
- [ ] WorkerName and walletAddress appear in dashboard
- [ ] Old firmware continues to work

### 8.2 Backend Success Criteria

- [ ] Virtual devices have virtual- prefix
- [ ] Virtual devices have deviceType 'virtual_client'
- [ ] MODEL B rejects unregistered virtual devices
- [ ] MODEL A auto-registers ESP32 devices
- [ ] Old virtual devices continue to work

### 8.3 Frontend Success Criteria

- [ ] Button renamed to "Add Virtual Device"
- [ ] Modal title updated
- [ ] Tooltip explains purpose
- [ ] Device type indicator works
- [ ] Visual distinction applied

### 8.4 Integration Success Criteria

- [ ] ESP32 onboarding works end-to-end
- [ ] Virtual device onboarding works end-to-end
- [ ] Dual-path architecture works
- [ ] No errors in logs
- [ ] Dashboard displays correctly

---

## SECTION 9: POST-IMPLEMENTATION TASKS

### 9.1 Documentation Updates

- [ ] Update BITMIND_FIRMWARE_ARCHITECTURE.md
- [ ] Update BITMIND_CANONICAL_STATE.md
- [ ] Update onboarding guide
- [ ] Add virtual device testing guide
- [ ] Update API documentation

### 9.2 Monitoring

- [ ] Monitor ESP32 registration success rate
- [ ] Monitor virtual device registration success rate
- [ ] Monitor error rates
- [ ] Monitor device type distribution
- [ ] Monitor workerName and walletAddress sync

### 9.3 Cleanup

- [ ] Remove test devices
- [ ] Clean up test data
- [ ] Archive test logs
- [ ] Document lessons learned

---

## CONCLUSION

**Implementation Plan Status:** ✅ READY FOR APPROVAL

**Total Changes:** 4 files
- Firmware: 1 critical change
- Backend: 3 minor changes
- Frontend: UI changes (not in workspace)

**Risk Level:** LOW

**Estimated Effort:** 2-3 hours

**Recommendation:** APPROVE AND PROCEED WITH IMPLEMENTATION

**Next Steps:**
1. Await user approval
2. Begin Phase 1: Firmware changes
3. Continue with Phase 2: Backend changes
4. Complete Phase 3: Frontend changes
5. Execute Phase 4: Integration testing
6. Deploy to production
7. Monitor and verify
