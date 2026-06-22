# BITMIND CANONICAL STATE UPDATE REQUEST - TFT PHASE T0

**Date:** 2026-06-22  
**Phase:** T0 - TFT Foundation Audit  
**Status:** PENDING APPROVAL  
**Type:** Canonical State Update  
**Purpose:** Document TFT Track initiation and OLED Track archival

---

## 1. REQUEST SUMMARY

**Objective:** Update canonical state to reflect:
1. Initiation of TFT Track as production firmware path
2. Archival of OLED Track as reference implementation
3. Hardware validation completion for ESP32-2432S028
4. Architecture migration plan approval

**Rationale:** Real hardware testing revealed that ESP32-2432S028 TFT boards are incompatible with current OLED Track implementation (SSD1306). TFT Track is required for production hardware.

---

## 2. CURRENT CANONICAL STATE

**Latest Commit:** 4398321 (BITMIND_DISPLAY_HARDWARE_AUDIT.md)

**Current Tracks:**
- **Legacy Track:** bitmind_legacy_v1 (no display)
- **OLED Track:** bitmind_oled_v1 (SSD1306 OLED, 128×64)
  - Phase O1: Display Foundation (complete)
  - Phase O2: Screen Management (complete)
  - Phase O3: State Integration (complete)
  - Phase O4: WiFi Integration (complete)
  - Phase O5: Dashboard Design (complete)
  - Phase O6: Dashboard Implementation (complete)

**Production Hardware:** None specified (OLED Track targets generic OLED displays)

---

## 3. PROPOSED CANONICAL STATE UPDATE

### 3.1 Track Status Changes

**OLED Track (bitmind_oled_v1):**
- **Status:** ARCHIVED (Reference Implementation)
- **Reason:** Incompatible with production hardware (ESP32-2432S028)
- **Purpose:** Reference for display architecture patterns
- **Final Phase:** O6 (Dashboard Implementation)
- **Final Commit:** bb66379

**TFT Track (bitmind_tft_v1):**
- **Status:** ACTIVE (Production Firmware)
- **Reason:** Required for ESP32-2432S028 production hardware
- **Purpose:** Production firmware for Bitmind devices
- **Current Phase:** T0 (Foundation Audit)
- **Target Hardware:** ESP32-2432S028 (Cheap Yellow Display - CYD)

### 3.2 Phase T0 Deliverables

**Documentation:**
- BITMIND_DISPLAY_HARDWARE_AUDIT.md (created)
- BITMIND_TFT_PHASE_T0_AUDIT.md (created)
- BITMIND_TFT_ARCHITECTURE_PLAN.md (created)
- BITMIND_CANONICAL_STATE_UPDATE_REQUEST_T0.md (this document)

**Firmware:**
- bitmind_tft_v1 (to be created in Phase T1)

### 3.3 Architecture Changes

**Key Finding:** Existing OLED architecture is 100% reusable except DisplayManager layer

**Reusable Components (Unchanged):**
- DeviceStateManager
- DeviceState struct
- ScreenManager
- Screen base class and lifecycle
- State-driven screen transitions
- WiFi management
- Backend communication
- Registration flow
- Mining logic
- WebSocket protocol
- QR onboarding state model

**Replaced Components:**
- DisplayManager (TFT_eSPI-based instead of Adafruit SSD1306)
- Display libraries (TFT_eSPI instead of Adafruit SSD1306 + GFX)
- Screen render() methods (redesigned for 240×320 TFT)
- Screen layouts (redesigned for larger screen)

**Unchanged Components:**
- Backend protocol
- Mining protocol
- Device protocol
- All business logic

---

## 4. HARDWARE SPECIFICATION

### 4.1 Production Hardware

**Board:** ESP32-2432S028 (Cheap Yellow Display - CYD)  
**MCU:** ESP32-WROOM-32 (dual-core Xtensa LX6 @ 240 MHz)  
**Flash:** 4 MB QSPI  
**RAM:** 520 KB SRAM  

### 4.2 Display Specifications

**Controller:** ILI9341  
**Type:** TFT (Thin Film Transistor) - Color LCD  
**Resolution:** 240 × 320 pixels  
**Color Depth:** 16-bit RGB (65,536 colors)  
**Interface:** SPI (HSPI)  
**Backlight:** GPIO 21 control  

### 4.3 Touch Specifications

**Controller:** XPT2046  
**Type:** Resistive touch panel  
**Interface:** SPI (VSPI) - Separate from display  
**Touch Points:** Single-touch  
**IRQ Pin:** GPIO 36  

### 4.4 Pin Mapping

**Display (HSPI):**
- TFT_SCK: GPIO 14
- TFT_SDO (MISO): GPIO 12
- TFT_SDI (MOSI): GPIO 13
- TFT_CS: GPIO 15
- TFT_DC (RS): GPIO 2
- TFT_RST: GPIO 4
- TFT_BL: GPIO 21

**Touch (VSPI):**
- TP_SCK: GPIO 25
- TP_MISO: GPIO 39
- TP_MOSI: GPIO 32
- TP_CS: GPIO 33
- TP_IRQ: GPIO 36

---

## 5. MIGRATION PLAN SUMMARY

### 5.1 Phase T1 - DisplayManager Implementation

**Objective:** Implement TFT-based DisplayManager

**Tasks:**
- Create bitmind_tft_v1 directory structure
- Copy DeviceState, ScreenManager, Screen from OLED variant
- Implement TFT-based DisplayManager
- Update platformio.ini for TFT_eSPI
- Test DisplayManager initialization

**Deliverables:**
- bitmind_tft_v1 firmware structure
- TFT DisplayManager implementation
- PlatformIO configuration

### 5.2 Phase T2 - Screen Layout Redesign

**Objective:** Redesign screen layouts for 320×240 TFT display

**Tasks:**
- Copy screen files from OLED variant
- Redesign render() methods for TFT
- Test all screen transitions

**Deliverables:**
- All screen render() methods redesigned
- Screen layout documentation

### 5.3 Phase T3 - QR Code Integration

**Objective:** Integrate QR code display for onboarding

**Tasks:**
- Implement QR code drawing in DisplayManager
- Add QR code to SetupScreen
- Test QR code scanning

**Deliverables:**
- QR code display implementation
- Onboarding flow with QR

### 5.4 Phase T4 - Touch Integration (Optional, Future)

**Objective:** Add touch support for interactive UI

**Tasks:**
- Integrate XPT2046_Touchscreen library
- Implement touch calibration
- Add touch event handling

**Deliverables:**
- Touch support implementation
- Touch-based UI

---

## 6. APPROVAL REQUEST

### 6.1 Requested Actions

**Approve:**
1. TFT Track initiation as production firmware path
2. OLED Track archival as reference implementation
3. Architecture migration plan (reuse OLED architecture, replace DisplayManager only)
4. Phase T0 deliverables (audit, architecture plan, canonical state update)

**Commit:**
- Update BITMIND_CANONICAL_STATE.md with TFT Track initiation
- Mark OLED Track as archived
- Document Phase T0 completion

### 6.2 Canonical State Update Content

**Add to BITMIND_CANONICAL_STATE.md:**

```markdown
## TFT Track - Phase T0 (Foundation Audit)

**Status:** COMPLETE  
**Date:** 2026-06-22  
**Commit:** [TBD]

### Objectives
- Perform complete production-hardware audit for ESP32-2432S028
- Verify TFT controller, touch controller, pin mapping
- Document TFT_eSPI configuration requirements
- Evaluate architecture reuse potential
- Create migration plan from OLED to TFT

### Achievements
- Hardware audit completed for ESP32-2432S028
- ILI9341 TFT controller specifications documented
- XPT2046 touch controller specifications documented
- TFT_eSPI configuration requirements documented
- Pin mapping validated (HSPI for display, VSPI for touch)
- Memory impact analyzed (Flash: +120-170 KB, RAM: +5-10 KB partial buffer)
- Architecture reuse evaluation completed (100% reuse except DisplayManager)
- Display abstraction strategy defined (replace DisplayManager only)
- Migration plan created (T1: DisplayManager, T2: Screens, T3: QR, T4: Touch)

### Scope Compliance
- Audit only (no code implementation)
- No display driver integration
- No touch implementation
- No backend changes
- No protocol changes
- No mining changes

### Architecture
- **Reusable (100%):** DeviceStateManager, ScreenManager, screen lifecycle, state models
- **Replaced:** DisplayManager (TFT_eSPI-based), display libraries, screen render() methods
- **Unchanged:** Backend protocol, mining protocol, device protocol, all business logic

### Files Modified
- BITMIND_DISPLAY_HARDWARE_AUDIT.md (created)
- BITMIND_TFT_PHASE_T0_AUDIT.md (created)
- BITMIND_TFT_ARCHITECTURE_PLAN.md (created)
- BITMIND_CANONICAL_STATE_UPDATE_REQUEST_T0.md (created)

### Next Phase
- Phase T1: DisplayManager Implementation
```

**Update OLED Track Status:**

```markdown
## OLED Track - Phase O6 (Dashboard Implementation)

**Status:** ARCHIVED (Reference Implementation)  
**Reason:** Incompatible with production hardware (ESP32-2432S028 TFT)
**Purpose:** Reference for display architecture patterns
**Final Commit:** bb66379
```

---

## 7. RISKS AND CONSIDERATIONS

### 7.1 Technical Risks

**Risk 1: TFT_eSPI Configuration Complexity**
- **Mitigation:** Use known working configuration from community
- **Impact:** Low - TFT_eSPI is mature and widely used

**Risk 2: Memory Usage Increase**
- **Mitigation:** Use partial buffer mode in TFT_eSPI
- **Impact:** Low - Within ESP32 capabilities (520 KB RAM)

**Risk 3: Screen Layout Redesign Complexity**
- **Mitigation:** Reuse OLED layout as starting point
- **Impact:** Medium - Design iteration required

### 7.2 Schedule Considerations

**Estimated Timeline:**
- Phase T1: 1-2 days (DisplayManager implementation)
- Phase T2: 2-3 days (Screen layout redesign)
- Phase T3: 1 day (QR code integration)
- **Total:** 4-6 days to production-ready firmware

### 7.3 Production Considerations

**Hardware Availability:**
- ESP32-2432S028 is widely available (~$15 USD)
- Low cost, suitable for production deployment
- All-in-one design reduces BOM complexity

**Power Consumption:**
- Typical draw: ~115 mA with backlight
- Suitable for continuous mining operation

---

## 8. SIGN-OFF

**Requestor:** Cascade (AI Assistant)  
**Date:** 2026-06-22  
**Phase:** T0 - TFT Foundation Audit  
**Status:** PENDING APPROVAL

**Approval Required:**
- [ ] TFT Track initiation approval
- [ ] OLED Track archival approval
- [ ] Architecture migration plan approval
- [ ] Phase T0 deliverables approval
- [ ] Canonical state update approval

**Post-Approval Actions:**
1. Update BITMIND_CANONICAL_STATE.md
2. Commit canonical state update
3. Push to GitHub
4. Begin Phase T1 implementation

---

**END OF CANONICAL STATE UPDATE REQUEST**
