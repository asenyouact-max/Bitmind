# BITMIND TFT PHASE T0 - FOUNDATION AUDIT

**Phase:** T0 - TFT Foundation Audit  
**Date:** 2026-06-22  
**Status:** COMPLETE  
**Target Hardware:** ESP32-2432S028 (Cheap Yellow Display - CYD)  
**Purpose:** Production hardware validation and architecture migration planning

---

## 1. EXECUTIVE SUMMARY

**Objective:** Perform complete production-hardware audit for ESP32-2432S028 to determine migration strategy from OLED prototype architecture to production TFT hardware architecture.

**Key Findings:**
- ESP32-2432S028 uses ILI9341 TFT controller (240×320, 16-bit RGB)
- Touch controller is XPT2046 (resistive) on separate SPI bus
- Existing OLED architecture (DeviceState, ScreenManager, screen lifecycle) is **100% reusable**
- Only DisplayManager layer requires complete replacement
- No backend, protocol, or mining changes required

**Recommendation:** Proceed with TFT Track using existing OLED architecture as foundation, replacing only the display layer.

---

## 2. HARDWARE SPECIFICATIONS

### 2.1 Display Controller

**Controller:** ILI9341  
**Type:** TFT (Thin Film Transistor) - Color LCD  
**Resolution:** 240 × 320 pixels  
**Color Depth:** 16-bit RGB (65,536 colors)  
**Interface:** SPI (Serial Peripheral Interface)  
**SPI Bus:** HSPI (SPI2_HOST)  
**Refresh Rate:** 60 Hz typical  

**Display Characteristics:**
- Size: 2.8 inches
- Effective display area: 43.2 × 57.6 mm
- Viewing angle: >60°
- Backlight: GPIO 21 control
- Operating temperature: -20°C to 70°C

### 2.2 Touch Controller

**Controller:** XPT2046  
**Type:** Resistive touch panel  
**Interface:** SPI (Serial Peripheral Interface)  
**SPI Bus:** VSPI (SPI3_HOST) - Separate from display  
**Touch Points:** Single-touch  
**Pressure Sensitivity:** 0-4095 range  

**Touch Characteristics:**
- Works with gloves (industrial-friendly)
- Less precise than capacitive
- Requires calibration
- IRQ pin: GPIO 36 (interrupt on touch)

### 2.3 Pin Mapping

**Display (HSPI):**
| Function | GPIO | Description |
|----------|------|-------------|
| TFT_SCK | 14 | SPI Clock |
| TFT_SDO (MISO) | 12 | SPI MISO |
| TFT_SDI (MOSI) | 13 | SPI MOSI |
| TFT_CS | 15 | Chip Select |
| TFT_DC (RS) | 2 | Data/Command |
| TFT_RST | 4 | Reset (tied to EN on some boards) |
| TFT_BL | 21 | Backlight control |

**Touch (VSPI):**
| Function | GPIO | Description |
|----------|------|-------------|
| TP_SCK | 25 | SPI Clock |
| TP_MISO | 39 | SPI MISO |
| TP_MOSI | 32 | SPI MOSI |
| TP_CS | 33 | Chip Select |
| TP_IRQ | 36 | Interrupt (touch detection) |

**Shared Peripherals:**
| Function | GPIO | Description |
|----------|------|-------------|
| SD_CS | 5 | micro-SD card chip select |
| SD_SCK | 18 | SD card SPI clock |
| SD_MISO | 19 | SD card SPI MISO |
| SD_MOSI | 23 | SD card SPI MOSI |
| LED_R | 4 | RGB LED Red (active-LOW) |
| LED_G | 16 | RGB LED Green (active-LOW) |
| LED_B | 17 | RGB LED Blue (active-LOW) |
| LDR | 34 | Light sensor (ADC) |

### 2.4 SPI Bus Configuration

**Display SPI (HSPI):**
- Clock frequency: 40 MHz maximum
- Read frequency: 16 MHz
- Mode: SPI_MODE0
- Bit order: MSB first

**Touch SPI (VSPI):**
- Clock frequency: 2.5 MHz maximum (XPT2046 requirement)
- Mode: SPI_MODE0
- Bit order: MSB first
- Note: Separate SPI bus from display

---

## 3. TFT_eSPI CONFIGURATION REQUIREMENTS

### 3.1 User Setup Configuration

**Required Defines:**
```cpp
#define ILI9341_DRIVER
#define TFT_WIDTH  240
#define TFT_HEIGHT 320
#define TFT_MISO  12
#define TFT_MOSI  13
#define TFT_SCLK  14
#define TFT_CS    15
#define TFT_DC    2
#define TFT_RST   4
#define TFT_BL    21
#define SPI_FREQUENCY  40000000
#define SPI_READ_FREQUENCY  16000000
#define USE_HSPI_PORT
```

### 3.2 Font Configuration

**Recommended Fonts:**
```cpp
#define LOAD_GLCD   // Font 1. Original Adafruit 8 pixel font needs ~1820 bytes in FLASH
#define LOAD_FONT2  // Font 2. Small 16 pixel high font, needs ~3534 bytes in FLASH
#define LOAD_FONT4  // Font 4. Medium 26 pixel high font, needs ~5840 bytes in FLASH
#define LOAD_FONT6  // Font 6. Large 48 pixel font, needs ~2666 bytes in FLASH
#define LOAD_FONT7  // Font 7. 7 segment 48 pixel font, needs ~2438 bytes in FLASH
#define LOAD_FONT8  // Font 8. Large 75 pixel font needs ~3256 bytes in FLASH
#define LOAD_GFXFF  // FreeFonts. Include access to the 48 Adafruit_GFX free fonts FF1 to FF48 and custom fonts
#define SMOOTH_FONT // Add anti-aliased font smoothing
```

### 3.3 Color Configuration

**16-bit RGB565 Format:**
- Red: 5 bits (0-31)
- Green: 6 bits (0-63)
- Blue: 5 bits (0-31)
- Total: 65,536 colors

**Common Colors:**
```cpp
#define TFT_BLACK       0x0000
#define TFT_NAVY        0x000F
#define TFT_DARKGREEN   0x03E0
#define TFT_DARKCYAN    0x03EF
#define TFT_MAROON      0x7800
#define TFT_PURPLE      0x780F
#define TFT_OLIVE       0x7BE0
#define TFT_LIGHTGREY    0xC618
#define TFT_DARKGREY    0x7BEF
#define TFT_BLUE        0x001F
#define TFT_GREEN       0x07E0
#define TFT_CYAN        0x07FF
#define TFT_RED         0xF800
#define TFT_MAGENTA     0xF81F
#define TFT_YELLOW      0xFFE0
#define TFT_WHITE       0xFFFF
#define TFT_ORANGE      0xFD20
#define TFT_GREENYELLOW 0xAFE5
#define TFT_PINK        0xF81F
```

### 3.4 PlatformIO Configuration

**platformio.ini:**
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino

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
    -DCORE_DEBUG_LEVEL=3
    -DBOARD_HAS_PSRAM
    -mfix-esp32-psram-cache-issue
```

---

## 4. BACKLIGHT CONTROL

### 4.1 Backlight Pin

**GPIO:** 21  
**Type:** PWM-capable  
**Control:** Digital or PWM

### 4.2 Backlight Control Options

**Option 1: Digital On/Off**
```cpp
pinMode(TFT_BL, OUTPUT);
digitalWrite(TFT_BL, HIGH);  // On
digitalWrite(TFT_BL, LOW);   // Off
```

**Option 2: PWM Brightness Control**
```cpp
ledcSetup(0, 5000, 8);  // Channel 0, 5kHz, 8-bit
ledcAttachPin(TFT_BL, 0);
ledcWrite(0, brightness);  // 0-255
```

**Recommendation:** Use digital on/off for simplicity. PWM brightness control can be added in future phase if needed.

### 4.3 Power Consumption

**Backlight Power:**
- Full brightness: ~80 mA
- Off: 0 mA
- Typical with mining: ~115 mA total (including ESP32)

---

## 5. TOUCH CALIBRATION

### 5.1 Touch Controller Library

**Recommended Library:** XPT2046_Touchscreen  
**Alternative:** TFT_eTouch (separate library)

**Library Configuration:**
```cpp
#include <XPT2046_Touchscreen.h>
#define TOUCH_CS 33
XPT2046_Touchscreen ts(TOUCH_CS);
```

### 5.2 Calibration Requirements

**Calibration Parameters:**
- x_min: ~340
- x_max: ~3860
- y_min: ~300
- y_max: ~3860
- threshold: 400 (pressure threshold)

**Calibration Process:**
1. Display calibration points on screen corners
2. User touches each point
3. Record raw touch coordinates
4. Calculate calibration matrix
5. Store calibration in NV storage

**Note:** Calibration is board-specific. Each ESP32-2432S028 board may have slightly different touch characteristics.

### 5.3 Touch Reading

**Polling Mode:**
```cpp
TS_Point p = ts.getPoint();
if (p.z > 0) {
  // Touch detected
  int x = map(p.x, x_min, x_max, 0, TFT_WIDTH);
  int y = map(p.y, y_min, y_max, 0, TFT_HEIGHT);
}
```

**Interrupt Mode:**
```cpp
#define TOUCH_IRQ 36
attachInterrupt(digitalPinToInterrupt(TOUCH_IRQ), touchISR, FALLING);
```

**Recommendation:** Use polling mode for simplicity. Interrupt mode can be added in future phase for power optimization.

---

## 6. MEMORY IMPACT ANALYSIS

### 6.1 Flash Usage

**Current OLED Track:**
- Adafruit SSD1306: ~15 KB
- Adafruit GFX: ~20 KB
- QRCode: ~8 KB
- **Total Display Libraries:** ~43 KB

**TFT Track (Projected):**
- TFT_eSPI: ~150-200 KB
- QRCode: ~8 KB
- XPT2046_Touchscreen: ~5 KB
- **Total Display Libraries:** ~163-213 KB

**Flash Increase:** ~120-170 KB additional flash

**Impact:** Within ESP32 capabilities (4 MB flash). No issue.

### 6.2 RAM Usage

**Current OLED Track:**
- Display buffer: ~1 KB (128×64 / 8)
- State management: ~2 KB
- **Total Display RAM:** ~3 KB

**TFT Track (Projected):**
- Display buffer: ~5-10 KB (partial buffer) or ~150 KB (full buffer)
- State management: ~2 KB
- Touch buffer: ~1 KB
- **Total Display RAM:** ~8-13 KB (partial) or ~153 KB (full)

**RAM Increase:** ~5-10 KB (partial buffer) or ~150 KB (full buffer)

**Impact:** Partial buffer is within ESP32 capabilities (520 KB RAM). Full buffer would consume ~30% of RAM.

**Recommendation:** Use partial buffer mode in TFT_eSPI for memory efficiency.

### 6.3 PSRAM Considerations

**ESP32-2432S028:** No PSRAM by default  
**PSRAM Option:** Can be added with hardware modification (up to 8 MB)

**Recommendation:** Do not rely on PSRAM. Use partial buffer mode to stay within internal RAM limits.

---

## 7. ARCHITECTURE REUSE EVALUATION

### 7.1 DeviceStateManager

**Current Implementation:**
- Centralized state management
- Static state instance
- State update methods for all device properties
- WiFi, backend, registration, mining, system, AP mode, QR code state

**Reuse Assessment:** **100% REUSABLE**

**Rationale:**
- DeviceState is display-agnostic
- No display-specific fields
- State model is business logic, not presentation
- All state fields are relevant for TFT display

**Required Changes:** NONE

### 7.2 ScreenManager

**Current Implementation:**
- Manages screen lifecycle (onEnter, onExit, update, render)
- State-driven screen transitions
- Screen instances for each state (Splash, Setup, Connecting, Registering, Mining, Error)
- Template-based transitionTo method

**Reuse Assessment:** **100% REUSABLE**

**Rationale:**
- ScreenManager is display-agnostic
- Only depends on DisplayManager interface
- Screen lifecycle model is independent of display technology
- State-driven transitions are business logic, not presentation

**Required Changes:** NONE

### 7.3 Screen Lifecycle Model

**Current Implementation:**
- Screen base class with virtual methods
- onEnter() - called when screen becomes active
- onExit() - called when screen becomes inactive
- update() - called every loop iteration
- render() - called to draw screen content

**Reuse Assessment:** **100% REUSABLE**

**Rationale:**
- Lifecycle model is display-agnostic
- Virtual methods allow screen-specific implementations
- No display-specific logic in base class

**Required Changes:** NONE

### 7.4 QR Onboarding State Model

**Current Implementation:**
- qrPayload field in DeviceState
- setQRPayload() method in DeviceStateManager
- QR code display in SetupScreen
- State-driven QR payload (not hardcoded)

**Reuse Assessment:** **100% REUSABLE**

**Rationale:**
- QR payload is business logic, not presentation
- State model is display-agnostic
- QR code generation library (ricmoo/QRCode) is display-agnostic
- Only drawing method needs to change

**Required Changes:** QR code drawing method in DisplayManager only

### 7.5 Registration State Model

**Current Implementation:**
- registered, deviceId, workerName, walletAddress, token fields
- State update methods for each field
- Registration screen display

**Reuse Assessment:** **100% REUSABLE**

**Rationale:**
- Registration state is business logic, not presentation
- State model is display-agnostic
- Only screen rendering needs to change

**Required Changes:** Registration screen rendering only

### 7.6 Mining Dashboard State Model

**Current Implementation:**
- miningActive, jobId, hashrate, acceptedShares, rejectedShares, uptime fields
- State update methods for each field
- Mining screen display (Proposal 1 layout)

**Reuse Assessment:** **100% REUSABLE**

**Rationale:**
- Mining state is business logic, not presentation
- State model is display-agnostic
- Only screen rendering needs to change

**Required Changes:** Mining screen rendering only (redesign for 240×320)

---

## 8. DISPLAY ABSTRACTION STRATEGY

### 8.1 Current DisplayManager Interface

**Public Methods:**
```cpp
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
```

### 8.2 Proposed TFT DisplayManager Interface

**Public Methods (Preserve Compatibility):**
```cpp
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
```

**New Methods (TFT-Specific):**
```cpp
void setForegroundColor(uint16_t color);
void setBackgroundColor(uint16_t color);
void setRotation(uint8_t rotation);
void fillScreen(uint16_t color);
```

### 8.3 Implementation Strategy

**Approach:** Replace DisplayManager implementation while preserving interface

**Steps:**
1. Replace Adafruit_SSD1306 with TFT_eSPI instance
2. Update initialization sequence (ILI9341-specific)
3. Update pin configuration (SPI pins)
4. Add color support (foreground/background colors)
5. Update resolution constants (240×320)
6. Rewrite all drawing methods to use TFT_eSPI API
7. Add backlight control (GPIO 21)
8. Update rotation handling
9. Preserve QR code drawing (ricmoo/QRCode library is display-agnostic)

**Key Insight:** The DisplayManager interface is already well-abstracted. Only the implementation needs to change. No changes to ScreenManager or screen classes required.

---

## 9. SCREEN LAYOUT REDESIGN CONSIDERATIONS

### 9.1 Current OLED Layout (128×64)

**Proposal 1 - Compact Header Layout:**
```
+--------------------------------------+
|  BITMIND           [STATUS]          |
+--------------------------------------+
|  Worker: my-miner-01                 |
|                                      |
|  12.5 MH/s                           |
|                                      |
|  ● Mining                            |
+--------------------------------------+
```

**Characteristics:**
- Landscape orientation
- Monochrome
- Small text sizes (1-2)
- Compact layout
- Limited screen real estate

### 9.2 Proposed TFT Layout (240×320)

**Option 1 - Enhanced Mining Dashboard:**
```
+--------------------------------------+
|              BITMIND                 |
|         [STATUS: MINING]             |
+--------------------------------------+
|  Worker: my-miner-01                |
|                                      |
|  Hashrate: 12.5 MH/s                |
|  Accepted: 1234                      |
|  Rejected: 5                         |
|  Uptime: 2h 34m                     |
|                                      |
|  Pool: stratum+tcp://...             |
|                                      |
|  [QR Code for onboarding]            |
+--------------------------------------+
```

**Characteristics:**
- Portrait orientation (320×240)
- Color support (16-bit RGB)
- Larger text sizes (2-4)
- More metrics displayed
- QR code onboarding integrated
- Touch buttons (optional)

**Option 2 - Tabbed Interface:**
- Tab 1: Mining Dashboard
- Tab 2: Worker Settings
- Tab 3: Pool Settings
- Tab 4: System Info

**Recommendation:** Start with Option 1 (single screen enhanced dashboard). Tabbed interface can be added in future phase.

---

## 10. MIGRATION PLAN SUMMARY

### 10.1 What Can Be Reused Unchanged

**Architecture Components:**
- DeviceStateManager (100%)
- DeviceState struct (100%)
- ScreenManager (100%)
- Screen base class and lifecycle (100%)
- Screen transition logic (100%)
- State-driven screen selection (100%)

**Business Logic:**
- WiFi management (100%)
- Backend communication (100%)
- Registration flow (100%)
- Mining logic (100%)
- WebSocket protocol (100%)
- QR onboarding state model (100%)

**Libraries:**
- arduinoWebSockets (100%)
- QRCode (100%)
- WiFi (built-in, 100%)
- WebServer (built-in, 100%)
- Preferences (built-in, 100%)

### 10.2 What Must Be Refactored

**Display Layer Only:**
- DisplayManager implementation (100% rewrite)
- DisplayManager interface (minor additions for color)
- All screen render() methods (redesign for 240×320)
- Screen layouts (redesign for larger screen)
- QR code drawing (adapt to TFT_eSPI)

### 10.3 What Must Be Replaced

**Libraries:**
- Adafruit SSD1306 → TFT_eSPI
- Adafruit GFX → TFT_eSPI (included)

**Configuration:**
- platformio.ini (add TFT_eSPI configuration)
- Pin mapping (I2C → SPI)

**Hardware:**
- OLED display → ESP32-2432S028 TFT display

---

## 11. RISKS AND MITIGATIONS

### 11.1 Technical Risks

**Risk 1: Touch Calibration Complexity**
- **Severity:** Medium
- **Mitigation:** Use known calibration values from community, provide calibration utility
- **Impact:** Touch may not work accurately without proper calibration

**Risk 2: Memory Usage**
- **Severity:** Low
- **Mitigation:** Use partial buffer mode in TFT_eSPI
- **Impact:** Full buffer mode could consume 30% of RAM

**Risk 3: SPI Bus Conflicts**
- **Severity:** Low
- **Mitigation:** Display and touch use separate SPI buses (HSPI vs VSPI)
- **Impact:** No conflicts expected

**Risk 4: Library Compatibility**
- **Severity:** Low
- **Mitigation:** TFT_eSPI is mature and widely used with ESP32-2432S028
- **Impact:** Minimal

### 11.2 Implementation Risks

**Risk 1: Screen Layout Redesign**
- **Severity:** Medium
- **Mitigation:** Reuse OLED layout as starting point, enhance for larger screen
- **Impact:** Design iteration required

**Risk 2: Color Scheme Design**
- **Severity:** Low
- **Mitigation:** Use established color schemes (dark mode, high contrast)
- **Impact:** Aesthetic only

**Risk 3: Touch Integration**
- **Severity:** Low
- **Mitigation:** Defer touch to future phase, start with display-only
- **Impact:** Touch not available in initial implementation

---

## 12. PHASE T0 CONCLUSION

**Audit Status:** COMPLETE

**Key Findings:**
1. ESP32-2432S028 uses ILI9341 TFT controller (240×320, 16-bit RGB)
2. Touch controller is XPT2046 (resistive) on separate SPI bus
3. Existing OLED architecture is **100% reusable** except DisplayManager
4. No backend, protocol, or mining changes required
5. Migration is primarily a display layer replacement

**Recommendation:** Proceed with TFT Track using existing OLED architecture as foundation, replacing only the DisplayManager layer and screen render methods.

**Next Steps:**
- Phase T1: TFT DisplayManager Implementation
- Phase T2: Screen Layout Redesign
- Phase T3: QR Code Integration
- Phase T4: Touch Integration (optional, future phase)

**Deliverables:**
- BITMIND_TFT_PHASE_T0_AUDIT.md ✓
- BITMIND_TFT_ARCHITECTURE_PLAN.md
- BITMIND_CANONICAL_STATE_UPDATE_REQUEST_T0.md

---

**END OF AUDIT**
