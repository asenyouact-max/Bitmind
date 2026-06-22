# BITMIND TFT ARCHITECTURE PLAN

**Date:** 2026-06-22  
**Status:** PLANNING  
**Target Hardware:** ESP32-2432S028 (Cheap Yellow Display - CYD)  
**Purpose:** Complete architecture migration plan from OLED prototype to production TFT hardware

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 Design Principles

**Core Principles:**
1. **Maximum Reuse:** Leverage existing OLED architecture (DeviceState, ScreenManager, screen lifecycle)
2. **Display Abstraction:** Replace only DisplayManager layer, preserve all business logic
3. **No Backend Changes:** WiFi, backend, registration, mining logic unchanged
4. **No Protocol Changes:** WebSocket protocol unchanged
5. **Production Focus:** Optimize for ESP32-2432S028 hardware capabilities

**Architecture Decision:** Single firmware variant for TFT hardware. OLED variant remains as reference implementation.

### 1.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    bitmind_tft_v1 Firmware                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Business Logic Layer                    │   │
│  │  (Unchanged from OLED Track)                        │   │
│  │                                                     │   │
│  │  • WiFi Management                                   │   │
│  │  • Backend Communication                            │   │
│  │  • Registration Flow                                 │   │
│  │  • Mining Logic                                     │   │
│  │  • WebSocket Protocol                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              State Management Layer                 │   │
│  │  (Unchanged from OLED Track)                        │   │
│  │                                                     │   │
│  │  • DeviceState struct                               │   │
│  │  • DeviceStateManager                               │   │
│  │  • State update methods                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Screen Management Layer                │   │
│  │  (Unchanged from OLED Track)                        │   │
│  │                                                     │   │
│  │  • ScreenManager                                    │   │
│  │  • Screen base class                                │   │
│  │  • Screen lifecycle (onEnter, onExit, update)        │   │
│  │  • State-driven transitions                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Screen Implementation Layer             │   │
│  │  (Render methods redesigned for TFT)                 │   │
│  │                                                     │   │
│  │  • SplashScreen                                     │   │
│  │  • SetupScreen                                      │   │
│  │  • ConnectingScreen                                 │   │
│  │  • RegisteringScreen                                │   │
│  │  • MiningScreen                                     │   │
│  │  • ErrorScreen                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Display Layer (CHANGED)                 │   │
│  │  (Replaced for TFT hardware)                         │   │
│  │                                                     │   │
│  │  • DisplayManager (TFT_eSPI-based)                  │   │
│  │  • TFT_eSPI library                                 │   │
│  │  • XPT2046_Touchscreen (future phase)               │   │
│  │  • QRCode library (unchanged)                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Hardware Layer                          │   │
│  │  (ESP32-2432S028)                                   │   │
│  │                                                     │   │
│  │  • ILI9341 TFT display (240×320)                    │   │
│  │  • XPT2046 touch controller                         │   │
│  │  • SPI interfaces (HSPI, VSPI)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. DIRECTORY STRUCTURE

### 2.1 Firmware Structure

```
esp32_firmware/
├── bitmind_legacy_v1/           # Original firmware (no display)
├── bitmind_oled_v1/             # OLED variant (archived reference)
│   ├── src/
│   │   ├── display/
│   │   │   ├── DeviceState.h
│   │   │   ├── DeviceState.cpp
│   │   │   ├── DisplayManager.h
│   │   │   ├── DisplayManager.cpp
│   │   │   ├── ScreenManager.h
│   │   │   ├── ScreenManager.cpp
│   │   │   ├── Screen.h
│   │   │   └── screens/
│   │   │       ├── SplashScreen.cpp
│   │   │       ├── SetupScreen.cpp
│   │   │       ├── ConnectingScreen.cpp
│   │   │       ├── RegisteringScreen.cpp
│   │   │       ├── MiningScreen.cpp
│   │   │       └── ErrorScreen.cpp
│   │   └── bitmind_oled_v1.ino
│   └── platformio.ini
└── bitmind_tft_v1/              # TFT variant (NEW - production)
    ├── src/
    │   ├── display/
    │   │   ├── DeviceState.h           # COPIED from OLED
    │   │   ├── DeviceState.cpp         # COPIED from OLED
    │   │   ├── DisplayManager.h        # MODIFIED for TFT
    │   │   ├── DisplayManager.cpp      # MODIFIED for TFT
    │   │   ├── ScreenManager.h         # COPIED from OLED
    │   │   ├── ScreenManager.cpp        # COPIED from OLED
    │   │   ├── Screen.h                # COPIED from OLED
    │   │   └── screens/
    │   │       ├── SplashScreen.cpp     # COPIED from OLED
    │   │       ├── SetupScreen.cpp      # MODIFIED for TFT
    │   │       ├── ConnectingScreen.cpp # COPIED from OLED
    │   │       ├── RegisteringScreen.cpp# COPIED from OLED
    │   │       ├── MiningScreen.cpp     # MODIFIED for TFT
    │   │       └── ErrorScreen.cpp      # COPIED from OLED
    │   └── bitmind_tft_v1.ino          # COPIED from OLED
    └── platformio.ini                  # MODIFIED for TFT
```

### 2.2 Documentation Structure

```
BITMIND_TFT_PHASE_T0_AUDIT.md          # Hardware audit (this phase)
BITMIND_TFT_ARCHITECTURE_PLAN.md       # Architecture plan (this phase)
BITMIND_TFT_PHASE_T1_DELIVERABLES.md   # Phase T1 deliverables
BITMIND_TFT_PHASE_T2_DELIVERABLES.md   # Phase T2 deliverables
...
BITMIND_CANONICAL_STATE_UPDATE_REQUEST_T0.md  # Canonical state update
```

---

## 3. DISPLAYMANAGER IMPLEMENTATION PLAN

### 3.1 Interface Preservation

**Goal:** Preserve DisplayManager interface to minimize changes to ScreenManager and screens.

**Current Interface (OLED):**
```cpp
class DisplayManager {
public:
  DisplayManager();
  bool begin();
  void end();
  void clear();
  void refresh();
  void setBrightness(uint8_t brightness);
  void drawText(int x, int y, const String& text, uint8_t size = 1);
  void drawTextCentered(int y, const String& text, uint8_t size = 1);
  void drawLine(int x0, int y0, int x1, int y1);
  void drawRect(int x, int y, int w, int h);
  void fillRect(int x, int y, int w, int h);
  void drawPixel(int x, int y);
  void drawQRCode(int x, int y, const String& data, uint8_t scale = 1);
  void drawQRCodeCentered(int y, const String& data, uint8_t scale = 1);
  bool isInitialized() const;
  int getWidth() const;
  int getHeight() const;
  Adafruit_SSD1306& getDisplay();
private:
  Adafruit_SSD1306 display;
  bool initialized;
};
```

**Proposed Interface (TFT):**
```cpp
class DisplayManager {
public:
  DisplayManager();
  bool begin();
  void end();
  void clear();
  void refresh();
  void setBrightness(uint8_t brightness);
  void drawText(int x, int y, const String& text, uint8_t size = 1);
  void drawTextCentered(int y, const String& text, uint8_t size = 1);
  void drawLine(int x0, int y0, int x1, int y1);
  void drawRect(int x, int y, int w, int h);
  void fillRect(int x, int y, int w, int h);
  void drawPixel(int x, int y);
  void drawQRCode(int x, int y, const String& data, uint8_t scale = 1);
  void drawQRCodeCentered(int y, const String& data, uint8_t scale = 1);
  bool isInitialized() const;
  int getWidth() const;
  int getHeight() const;
  TFT_eSPI& getDisplay();  // Changed return type
  
  // New TFT-specific methods
  void setForegroundColor(uint16_t color);
  void setBackgroundColor(uint16_t color);
  void setRotation(uint8_t rotation);
  void fillScreen(uint16_t color);
  
private:
  TFT_eSPI display;
  bool initialized;
  uint16_t foregroundColor;
  uint16_t backgroundColor;
};
```

### 3.2 Implementation Changes

**Constructor:**
```cpp
DisplayManager::DisplayManager() 
  : display(TFT_WIDTH, TFT_HEIGHT),
    initialized(false),
    foregroundColor(TFT_WHITE),
    backgroundColor(TFT_BLACK) {
}
```

**Initialization:**
```cpp
bool DisplayManager::begin() {
  Serial.println("[DISPLAY] Initializing TFT...");
  
  // Initialize TFT_eSPI
  display.begin();
  display.setRotation(1);  // Landscape: 320×240
  display.fillScreen(backgroundColor);
  
  // Set default text color
  display.setTextColor(foregroundColor, backgroundColor);
  display.setTextSize(1);
  display.setCursor(0, 0);
  
  // Enable backlight
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);
  
  initialized = true;
  Serial.println("[DISPLAY] TFT initialized successfully");
  return true;
}
```

**Drawing Methods:**
```cpp
void DisplayManager::drawText(int x, int y, const String& text, uint8_t size) {
  if (initialized) {
    display.setTextSize(size);
    display.setTextColor(foregroundColor, backgroundColor);
    display.setCursor(x, y);
    display.print(text);
  }
}

void DisplayManager::drawTextCentered(int y, const String& text, uint8_t size) {
  if (initialized) {
    display.setTextSize(size);
    display.setTextColor(foregroundColor, backgroundColor);
    int16_t x1, y1;
    uint16_t w, h;
    display.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
    int x = (display.width() - w) / 2;
    display.setCursor(x, y);
    display.print(text);
  }
}

void DisplayManager::drawQRCode(int x, int y, const String& data, uint8_t scale) {
  if (!initialized || data.isEmpty()) {
    return;
  }
  
  // Create QR code
  QRCode qrcode;
  uint8_t qrcodeData[qrcode_getBufferSize(QR_VERSION)];
  qrcode_initText(&qrcode, qrcodeData, QR_VERSION, ECC_MEDIUM, data.c_str());
  
  // Draw QR code
  for (uint8_t j = 0; j < qrcode.size; j++) {
    for (uint8_t i = 0; i < qrcode.size; i++) {
      if (qrcode_getModule(&qrcode, i, j)) {
        display.fillRect(x + i * scale, y + j * scale, scale, scale, foregroundColor);
      }
    }
  }
}
```

### 3.3 Color Management

**Default Color Scheme:**
```cpp
// Dark mode theme
#define TFT_BG_COLOR      0x0000  // Black
#define TFT_FG_COLOR      0xFFFF  // White
#define TFT_ACCENT_COLOR  0x07E0  // Green
#define TFT_ERROR_COLOR   0xF800  // Red
#define TFT_WARN_COLOR    0xFD20  // Orange
```

**Color Methods:**
```cpp
void DisplayManager::setForegroundColor(uint16_t color) {
  foregroundColor = color;
  display.setTextColor(foregroundColor, backgroundColor);
}

void DisplayManager::setBackgroundColor(uint16_t color) {
  backgroundColor = color;
  display.setTextColor(foregroundColor, backgroundColor);
}
```

---

## 4. SCREEN LAYOUT REDESIGN PLAN

### 4.1 Layout Goals

**Design Goals:**
1. Leverage larger screen (240×320 vs 128×64)
2. Use color for visual hierarchy
3. Display more metrics without clutter
4. Maintain readability
5. Professional appearance

**Orientation:** Portrait (320×240) for better vertical scrolling and metric display

### 4.2 Proposed Mining Screen Layout

**Layout:**
```
+----------------------------------+
|           BITMIND               |  Header (size 2, centered)
|      Status: MINING             |  Status (size 1, right-aligned)
+----------------------------------+  Separator line
|                                  |
|  Worker: my-miner-01            |  Worker name (size 1)
|                                  |
|  Hashrate: 12.5 MH/s            |  Hashrate (size 2, prominent)
|  Accepted: 1,234                |  Accepted shares (size 1)
|  Rejected: 5                    |  Rejected shares (size 1)
|  Uptime: 2h 34m                |  Uptime (size 1)
|                                  |
|  Pool: stratum+tcp://...        |  Pool (size 1, truncated)
|                                  |
|  [QR Code for onboarding]       |  QR code (optional, small)
|                                  |
+----------------------------------+
```

**Color Scheme:**
- Background: Black (0x0000)
- Text: White (0xFFFF)
- Status indicator: Green (0x07E0) for mining, Red (0xF800) for error
- Separator: Dark gray (0x7BEF)

### 4.3 Proposed Setup Screen Layout

**Layout:**
```
+----------------------------------+
|         BITMIND SETUP           |  Header (size 2, centered)
+----------------------------------+  Separator line
|                                  |
|  Connect to WiFi:               |  Instruction (size 1)
|                                  |
|  SSID: Bitmind_AP               |  AP SSID (size 1)
|  IP: 192.168.4.1                |  AP IP (size 1)
|                                  |
|  Scan QR code or open:          |  Instruction (size 1)
|  http://192.168.4.1              |  URL (size 1)
|                                  |
|  [Large QR Code]                 |  QR code (centered, scale 3)
|                                  |
+----------------------------------+
```

### 4.4 Screen Implementation Strategy

**Approach:** Copy screen files from OLED variant, modify only render() methods

**Steps:**
1. Copy all screen .cpp files from bitmind_oled_v1 to bitmind_tft_v1
2. Modify render() methods for larger screen and color
3. Keep onEnter(), onExit(), update() methods unchanged
4. Adjust text sizes and positions for 320×240 resolution
5. Add color support where appropriate

---

## 5. PHASE IMPLEMENTATION PLAN

### 5.1 Phase T1 - DisplayManager Implementation

**Objective:** Implement TFT-based DisplayManager

**Tasks:**
1. Create bitmind_tft_v1 directory structure
2. Copy DeviceState.h, DeviceState.cpp from OLED variant
3. Copy ScreenManager.h, ScreenManager.cpp from OLED variant
4. Copy Screen.h from OLED variant
5. Implement new DisplayManager.h for TFT
6. Implement new DisplayManager.cpp for TFT
7. Update platformio.ini for TFT_eSPI
8. Test DisplayManager initialization
9. Test basic drawing operations

**Deliverables:**
- bitmind_tft_v1 firmware structure
- TFT DisplayManager implementation
- PlatformIO configuration
- BITMIND_TFT_PHASE_T1_DELIVERABLES.md

### 5.2 Phase T2 - Screen Layout Redesign

**Objective:** Redesign screen layouts for 320×240 TFT display

**Tasks:**
1. Copy all screen .cpp files from OLED variant
2. Redesign SplashScreen render() for TFT
3. Redesign SetupScreen render() for TFT
4. Redesign ConnectingScreen render() for TFT
5. Redesign RegisteringScreen render() for TFT
6. Redesign MiningScreen render() for TFT
7. Redesign ErrorScreen render() for TFT
8. Test all screen transitions
9. Test state-driven screen selection

**Deliverables:**
- All screen render() methods redesigned
- Screen layout documentation
- BITMIND_TFT_PHASE_T2_DELIVERABLES.md

### 5.3 Phase T3 - QR Code Integration

**Objective:** Integrate QR code display for onboarding

**Tasks:**
1. Verify QRCode library compatibility with TFT
2. Implement QR code drawing in DisplayManager
3. Add QR code to SetupScreen
4. Test QR code scanning
5. Verify QR payload state-driven behavior

**Deliverables:**
- QR code display implementation
- Onboarding flow with QR
- BITMIND_TFT_PHASE_T3_DELIVERABLES.md

### 5.4 Phase T4 - Touch Integration (Optional, Future)

**Objective:** Add touch support for interactive UI

**Tasks:**
1. Integrate XPT2046_Touchscreen library
2. Implement touch calibration
3. Add touch event handling
4. Design touch-based UI elements
5. Test touch responsiveness

**Deliverables:**
- Touch support implementation
- Touch-based UI
- BITMIND_TFT_PHASE_T4_DELIVERABLES.md

---

## 6. MIGRATION CHECKLIST

### 6.1 File Migration

**Copy Unchanged:**
- [ ] DeviceState.h
- [ ] DeviceState.cpp
- [ ] ScreenManager.h
- [ ] ScreenManager.cpp
- [ ] Screen.h
- [ ] SplashScreen.cpp (render() only)
- [ ] ConnectingScreen.cpp (render() only)
- [ ] RegisteringScreen.cpp (render() only)
- [ ] ErrorScreen.cpp (render() only)
- [ ] bitmind_tft_v1.ino (copy from bitmind_oled_v1.ino)

**Modify:**
- [ ] DisplayManager.h (replace Adafruit_SSD1306 with TFT_eSPI)
- [ ] DisplayManager.cpp (complete rewrite for TFT)
- [ ] SetupScreen.cpp (render() redesign for TFT)
- [ ] MiningScreen.cpp (render() redesign for TFT)
- [ ] platformio.ini (add TFT_eSPI configuration)

**Create New:**
- [ ] bitmind_tft_v1 directory structure
- [ ] BITMIND_TFT_PHASE_T1_DELIVERABLES.md
- [ ] BITMIND_TFT_PHASE_T2_DELIVERABLES.md
- [ ] BITMIND_TFT_PHASE_T3_DELIVERABLES.md

### 6.2 Configuration Migration

**platformio.ini Changes:**
```ini
# Remove
lib_deps = 
    adafruit/Adafruit SSD1306
    adafruit/Adafruit GFX Library

# Add
lib_deps = 
    https://github.com/Bodmer/TFT_eSPI
    https://github.com/Links2004/arduinoWebSockets
    ricmoo/QRCode

build_flags = 
    -DUSER_SETUP_LOADED=1
    -DILI9341_DRIVER=1
    -DTFT_WIDTH=240
    -DTFT_HEIGHT=320
    -DTFT_MISO=12
    -DTFT_MOSI=13
    -DTFT_SCLK=14
    -DTFT_CS=15
    -DTFT_DC=2
    -DTFT_RST=4
    -DTFT_BL=21
    -DSPI_FREQUENCY=40000000
    -DSPI_READ_FREQUENCY=16000000
    -DUSE_HSPI_PORT=1
    -DLOAD_GLCD=1
    -DLOAD_FONT2=1
    -DLOAD_FONT4=1
    -DLOAD_FONT6=1
    -DLOAD_FONT7=1
    -DLOAD_FONT8=1
    -DLOAD_GFXFF=1
    -DSMOOTH_FONT=1
```

### 6.3 Include Path Updates

**bitmind_tft_v1.ino:**
```cpp
// Remove
#include "src/display/DeviceState.h"
#include "src/display/DisplayManager.h"
#include "src/display/ScreenManager.h"

// Add (same paths, since .ino is in src/)
#include "display/DeviceState.h"
#include "display/DisplayManager.h"
#include "display/ScreenManager.h"
```

---

## 7. TESTING PLAN

### 7.1 Unit Testing

**DisplayManager Tests:**
- [ ] Initialization test
- [ ] Clear screen test
- [ ] Text drawing test
- [ ] Text centered test
- [ ] Line drawing test
- [ ] Rectangle drawing test
- [ ] Fill rectangle test
- [ ] Pixel drawing test
- [ ] QR code drawing test
- [ ] Color setting test
- [ ] Brightness control test

### 7.2 Integration Testing

**Screen Tests:**
- [ ] SplashScreen render test
- [ ] SetupScreen render test
- [ ] ConnectingScreen render test
- [ ] RegisteringScreen render test
- [ ] MiningScreen render test
- [ ] ErrorScreen render test

**State Tests:**
- [ ] WiFi state transitions
- [ ] Registration state transitions
- [ ] Mining state transitions
- [ ] Error state transitions
- [ ] AP mode transitions

### 7.3 Hardware Testing

**ESP32-2432S028 Tests:**
- [ ] Display initialization
- [ ] Backlight control
- [ ] Screen rendering
- [ ] Screen transitions
- [ ] QR code display
- [ ] WiFi connectivity
- [ ] Backend connectivity
- [ ] Registration flow
- [ ] Mining operation

---

## 8. RISK MITIGATION

### 8.1 Technical Risks

**Risk 1: TFT_eSPI Configuration**
- **Mitigation:** Use known working configuration from community
- **Fallback:** Reference TFT_eSPI User_Setup_CYD.h

**Risk 2: Memory Usage**
- **Mitigation:** Use partial buffer mode
- **Fallback:** Reduce font loading if needed

**Risk 3: Screen Layout Complexity**
- **Mitigation:** Start with simple layout, iterate
- **Fallback:** Use OLED layout as baseline

### 8.2 Schedule Risks

**Risk 1: DisplayManager Rewrite Complexity**
- **Mitigation:** Leverage TFT_eSPI examples
- **Contingency:** Allocate extra time for debugging

**Risk 2: Screen Redesign Iterations**
- **Mitigation:** Design mockups before implementation
- **Contingency:** Use OLED layout as fallback

---

## 9. SUCCESS CRITERIA

### 9.1 Phase T1 Success Criteria

- [ ] DisplayManager initializes successfully
- [ ] Basic drawing operations work
- [ ] PlatformIO builds without errors
- [ ] Firmware flashes to ESP32-2432S028
- [ ] Display shows output

### 9.2 Phase T2 Success Criteria

- [ ] All screens render correctly
- [ ] Screen transitions work
- [ ] State-driven screen selection works
- [ ] Text is readable
- [ ] Color scheme is professional

### 9.3 Phase T3 Success Criteria

- [ ] QR code displays correctly
- [ ] QR code is scannable
- [ ] QR payload is state-driven
- [ ] Onboarding flow works end-to-end

### 9.4 Overall Success Criteria

- [ ] Firmware runs on ESP32-2432S028
- [ ] All OLED Track features work on TFT
- [ ] No backend changes required
- [ ] No protocol changes required
- [ ] Architecture is maintainable

---

## 10. CONCLUSION

**Architecture Plan Status:** COMPLETE

**Key Decisions:**
1. **Maximum Reuse:** Copy OLED architecture, replace only DisplayManager
2. **Single Variant:** TFT variant as production firmware, OLED as reference
3. **No Backend Changes:** Preserve all business logic
4. **Display-First:** Focus on display layer replacement
5. **Iterative Phases:** T1 (DisplayManager), T2 (Screens), T3 (QR), T4 (Touch)

**Next Steps:**
- Begin Phase T1: DisplayManager Implementation
- Create bitmind_tft_v1 directory structure
- Implement TFT-based DisplayManager
- Test on ESP32-2432S028 hardware

**Deliverables:**
- BITMIND_TFT_PHASE_T0_AUDIT.md ✓
- BITMIND_TFT_ARCHITECTURE_PLAN.md ✓
- BITMIND_CANONICAL_STATE_UPDATE_REQUEST_T0.md

---

**END OF ARCHITECTURE PLAN**
