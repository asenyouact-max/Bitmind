# BITMIND OLED PHASE O4 - DESIGN REVIEW

**Phase:** O4 - QR Onboarding  
**Date:** 2026-06-22  
**Status:** DESIGN REVIEW  
**Previous Phase:** O3 - AP Provisioning OLED Integration (COMPLETE)  

---

## 1. OBJECTIVE

Implement QR code generation and display on OLED during AP mode to simplify device setup for mobile users.

**Scope:**
- QR code generation library integration
- QR code display on OLED in AP mode
- QR code content: AP mode web portal URL (http://192.168.4.1)
- Integration with existing SetupScreen
- QR code scanning verification

**Exclusions:**
- No backend protocol changes
- No registration flow changes
- No mining changes
- No wallet onboarding screens
- No worker onboarding screens
- No backend-driven device configuration

---

## 2. ARCHITECTURE DESIGN

### QR Code Library Selection

**Candidate Libraries:**

1. **QRCode Library (by Richard Moore)**
   - PlatformIO: `QRCode`
   - Size: ~15 KB
   - Features: QR generation, multiple error correction levels
   - Pros: Lightweight, well-documented, ESP32 compatible
   - Cons: Limited to QR generation (no rendering)

2. **Adafruit GFX QRCode**
   - PlatformIO: Built into Adafruit GFX
   - Size: ~10 KB
   - Features: QR generation + rendering to Adafruit GFX
   - Pros: Seamless integration with existing DisplayManager
   - Cons: Requires Adafruit GFX (already included)

**Recommendation:** Adafruit GFX QRCode

**Rationale:**
- Already using Adafruit GFX for OLED
- Seamless integration with DisplayManager
- No additional library dependencies
- Built-in rendering to GFX canvas
- Well-tested and stable

### Integration Architecture

**DisplayManager Extension:**
```cpp
class DisplayManager {
  // Existing methods...
  
  // New QR methods
  void drawQRCode(int x, int y, const String& data, int scale = 1);
  void drawQRCodeCentered(int y, const String& data, int scale = 1);
};
```

**DeviceState Extension:**
```cpp
struct DeviceState {
  // ... existing fields ...
  
  // QR Code State
  String qrPayload;  // Configurable QR code content
};

class DeviceStateManager {
  // ... existing methods ...
  
  // QR Code State Updates
  static void setQRPayload(const String& payload);
};
```

**SetupScreen Enhancement:**
```cpp
void SetupScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->drawTextCentered(0, "BITMIND SETUP", 2);
  display->drawText(0, 24, "SSID: " + state.apSSID);
  display->drawText(0, 32, "IP: " + state.apIP);
  display->drawQRCodeCentered(48, state.qrPayload, 2);
  display->drawText(0, 56, "Scan to setup");
}
```

**QR Code Content:**
- URL: `http://192.168.4.1` (default)
- Configurable via DeviceStateManager
- Opens AP mode web portal in browser
- Simplifies setup for mobile users
- Not hardcoded in display code

### Memory Impact Analysis

**Library Size:**
- Adafruit GFX QRCode: ~10 KB
- Additional code: ~5 KB
- Total: ~15 KB

**Memory Headroom:**
- Current headroom: ~73 KB (from O2 analysis)
- After QR: ~58 KB
- Status: Sufficient

**Flash Headroom:**
- Current headroom: ~896-976 KB
- After QR: ~881-961 KB
- Status: Ample

---

## 3. SCREEN FLOW DESIGN

### Enhanced Setup Screen

**Current Display (O3):**
```
BITMIND SETUP
SSID: Bitmind-Setup
IP: 192.168.4.1
Open browser
Waiting...
```

**Proposed Display (O4):**
```
BITMIND SETUP
SSID: Bitmind-Setup
IP: 192.168.4.1
[QR CODE]
Scan to setup
```

**Layout:**
- Line 0-15: "BITMIND SETUP" (centered, size 2)
- Line 16-23: "SSID: Bitmind-Setup"
- Line 24-31: "IP: 192.168.4.1"
- Line 32-55: QR Code (centered, scale 2)
- Line 56-63: "Scan to setup" (centered)

**QR Code Parameters:**
- Data: `http://192.168.4.1`
- Scale: 2 (for readability on 128x64 display)
- Position: Centered at y=48
- Error Correction: Medium (QR_ECLEVEL_M)

### User Experience Flow

**Boot → Config Check:**
- Device boots
- Loads configuration from Preferences
- Checks if WiFi credentials exist

**Unconfigured → Setup Screen with QR:**
- WiFi credentials missing
- AP mode starts
- DeviceStateManager sets apMode=true, apSSID, apIP, status="SETUP"
- ScreenManager transitions to SetupScreen
- OLED displays AP SSID, IP, and QR code

**User Scans QR:**
- User opens camera app on mobile device
- User scans QR code on OLED
- Camera app detects URL
- User taps to open browser
- Browser opens `http://192.168.4.1`

**User Configures Device:**
- User fills form (SSID, Password, Worker, Wallet)
- User submits form
- Configuration saved to Preferences
- Device reboots

**Reboot → Connecting Screen:**
- Device boots with configuration
- WiFi connection starts
- DeviceStateManager sets status="CONNECTING"
- ScreenManager transitions to ConnectingScreen
- OLED displays connection progress

**WiFi Connected → Registering Screen:**
- WiFi connection successful
- WebSocket connection starts
- DeviceStateManager sets status="REGISTERING"
- ScreenManager transitions to RegisteringScreen
- OLED displays registration progress

**Registration Success → Mining Screen:**
- Device registered with backend
- Mining starts
- DeviceStateManager sets status="MINING", miningActive=true
- ScreenManager transitions to MiningScreen
- OLED displays mining status

---

## 4. IMPLEMENTATION PLAN

### Step 1: QR Library Integration
- Add Adafruit GFX QRCode to platformio.ini (if not already included)
- Verify library compiles with existing code
- Test basic QR generation

### Step 2: DisplayManager Extension
- Add `drawQRCode()` method to DisplayManager
- Add `drawQRCodeCentered()` method to DisplayManager
- Implement QR rendering using Adafruit GFX QRCode
- Test QR rendering on OLED

### Step 3: SetupScreen Enhancement
- Update SetupScreen::render() to display QR code
- Update layout to accommodate QR code
- Test QR display in AP mode

### Step 4: QR Content Configuration
- Add qrPayload field to DeviceState model
- Add setQRPayload() method to DeviceStateManager
- Set QR payload in startAPMode() to `http://192.168.4.1`
- Use DeviceStateManager::getQRPayload() in SetupScreen
- Test QR code scanning with mobile device

### Step 5: Testing
- Test QR code generation
- Test QR code display on OLED
- Test QR code scanning with mobile device
- Test QR code opens correct URL
- Test fallback (manual browser access still works)

### Step 6: Documentation
- Update BITMIND_OLED_PHASE_O4_DELIVERABLES.md
- Update BITMIND_CANONICAL_STATE.md
- Commit and push to GitHub

---

## 5. RISKS ANALYSIS

### Technical Risks

**Medium Risk:**
- **QR Code Size:** QR code may be too small or too large for OLED
  - Mitigation: Test different scale factors (1, 2, 3)
  - Mitigation: Use error correction level M for balance

- **QR Code Readability:** QR code may be hard to scan on small OLED
  - Mitigation: Test with multiple mobile devices
  - Mitigation: Use high contrast (black on white)
  - Mitigation: Provide fallback (manual URL display)

- **Memory Constraints:** QR library adds ~15 KB
  - Mitigation: Memory headroom is sufficient (~58 KB after QR)
  - Mitigation: Monitor memory during testing

**Low Risk:**
- **Library Compatibility:** Adafruit GFX QRCode is well-tested
- **Integration Complexity:** Minimal code changes required
- **DisplayManager Extension:** Well-defined interface

### Implementation Risks

**Low Risk:**
- **Complexity:** Simple integration with existing architecture
- **Testing:** Straightforward testing with mobile devices
- **Fallback:** Manual browser access still works

**Mitigations:**
- Incremental implementation approach
- Test QR code at multiple scale factors
- Provide fallback instructions
- Keep existing manual URL display

### Scope Risks

**No Scope Risks:**
- Strict adherence to Phase O4 scope
- No backend protocol changes
- No registration flow changes
- No mining changes
- No wallet onboarding screens
- No worker onboarding screens

---

## 6. SUCCESS CRITERIA

### Build
- Firmware compiles successfully
- QR library integrates without errors
- No new dependencies beyond Adafruit GFX

### OLED
- QR code displayed correctly in AP mode
- QR code is readable by mobile devices
- QR code content is correct (http://192.168.4.1)

### QR Functionality
- QR code scans successfully
- QR code opens correct URL in browser
- QR code scales appropriately for OLED

### Flow
- Screen transitions verified (Setup → Connecting → Registering → Mining)
- QR code appears only in AP mode
- QR code disappears after configuration

### Compatibility
- Legacy firmware unaffected (no changes)
- Existing AP provisioning unchanged
- Registration unchanged
- Mining unchanged
- Manual browser access still works (fallback)

### Scope Control
- No backend protocol changes
- No registration flow changes
- No mining changes
- Strict adherence to Phase O4 scope

---

## 7. DELIVERABLES

### Code Deliverables
- DisplayManager extension (QR drawing methods)
- SetupScreen enhancement (QR display)
- platformio.ini update (if needed)

### Documentation Deliverables
- BITMIND_OLED_PHASE_O4_DELIVERABLES.md
- BITMIND_CANONICAL_STATE_UPDATE_REQUEST_OLED_O4.md

### Testing Deliverables
- QR code generation test results
- QR code scanning test results
- Mobile device compatibility test results

---

## 8. NEXT PHASES

**Phase O5 - Enhanced UX:**
- Improve screen visual polish
- Add animations
- Add display customization options

**Phase O6 - Advanced Features:**
- Temperature display
- Network statistics
- Advanced error handling

---

## 9. CONCLUSION

**Phase O4 Status:** DESIGN REVIEW

**Summary:**
- QR code library selected: Adafruit GFX QRCode
- Integration architecture designed
- Screen flow designed with QR code
- Memory impact analyzed (sufficient headroom)
- Risks identified and mitigated
- Implementation plan defined

**Recommendation:** Proceed with implementation

**Compliance:**
- ✓ Architecture specification followed
- ✓ Phase O4 scope respected
- ✓ No protocol changes
- ✓ No backend changes
- ✓ No mining changes

---

**END OF DESIGN REVIEW**
