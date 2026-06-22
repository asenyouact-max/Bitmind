# BITMIND DISPLAY HARDWARE AUDIT

**Date:** 2026-06-22  
**Audit Type:** Hardware Validation  
**Target Hardware:** ESP32-2432S028 (Cheap Yellow Display - CYD)  
**Current Implementation:** OLED Track (SSD1306 variant)  
**Status:** CRITICAL INCOMPATIBILITY DISCOVERED

---

## 1. EXECUTIVE SUMMARY

**Critical Finding:** The current OLED Track implementation (SSD1306-based) is **incompatible** with the ESP32-2432S028 hardware used for testing. The hardware uses a completely different display controller, interface, and display technology.

**Impact:** The entire OLED Track firmware variant cannot run on the ESP32-2432S028 board without a complete display layer rewrite.

**Recommendation:** Create a separate TFT firmware variant for ESP32-2432S028 support. Continue OLED Track for actual OLED hardware.

---

## 2. HARDWARE ANALYSIS

### 2.1 ESP32-2432S028 Specifications

**Common Name:** Cheap Yellow Display (CYD)  
**Form Factor:** All-in-one ESP32 development board with integrated display

**Display Specifications:**
- **Type:** TFT (Thin Film Transistor) - Color LCD
- **Size:** 2.8 inches
- **Resolution:** 240 × 320 pixels
- **Color Depth:** 65,536 colors (16-bit RGB)
- **Controller:** ILI9341
- **Interface:** SPI (Serial Peripheral Interface)
- **Touch:** Resistive touch panel (XPT2046 controller)
- **Backlight:** GPIO 21 control

**MCU Specifications:**
- **Chip:** ESP32-WROOM-32
- **Cores:** Dual-core Xtensa LX6 @ 240 MHz
- **Flash:** 4 MB QSPI
- **RAM:** 520 KB SRAM
- **Connectivity:** Wi-Fi b/g/n + Bluetooth v4.2

**Additional Features:**
- Micro-SD card slot (up to 32 GB)
- RGB status LED
- Light sensor (LDR)
- Speaker connector (PAM8002A 3W class-D amp)
- USB-to-UART bridge (CH340C)

**Power:**
- Input: 5V via micro-USB
- Typical draw: ~115 mA with backlight full-bright

---

## 3. CURRENT OLED TRACK IMPLEMENTATION

### 3.1 Display Specifications

**Assumed Hardware:** Generic OLED display (128x64)

**Display Specifications:**
- **Type:** OLED (Organic Light Emitting Diode) - Monochrome
- **Resolution:** 128 × 64 pixels
- **Color:** Monochrome (typically white-on-black or blue-on-black)
- **Controller:** SSD1306
- **Interface:** I2C (Inter-Integrated Circuit)
- **I2C Address:** 0x3C

### 3.2 Current Implementation Details

**Libraries Used:**
- Adafruit SSD1306
- Adafruit GFX Library
- ricmoo/QRCode (for QR code generation)

**Architecture:**
- DisplayManager class wraps Adafruit_SSD1306
- I2C communication at address 0x3C
- Landscape orientation (128x64)
- Monochrome rendering only

**Code Location:**
- `esp32_firmware/bitmind_oled_v1/`

---

## 4. COMPATIBILITY ANALYSIS

### 4.1 Display Controller Compatibility

| Aspect | SSD1306 (Current) | ILI9341 (ESP32-2432S028) | Compatible? |
|--------|-------------------|---------------------------|-------------|
| **Technology** | OLED (monochrome) | TFT (color LCD) | NO |
| **Resolution** | 128 × 64 | 240 × 320 | NO |
| **Color Depth** | 1-bit (monochrome) | 16-bit (65K colors) | NO |
| **Interface** | I2C | SPI | NO |
| **Controller** | SSD1306 | ILI9341 | NO |
| **Library** | Adafruit SSD1306 | TFT_eSPI | NO |

**Conclusion:** **ZERO COMPATIBILITY** - These are fundamentally different display technologies with no common API or interface.

### 4.2 Interface Compatibility

**I2C vs SPI:**
- **I2C (SSD1306):** 2-wire serial interface (SDA, SCL), slower (typically 400 kHz), shared bus
- **SPI (ILI9341):** 4-wire serial interface (MOSI, MISO, SCK, CS), faster (up to 80 MHz on ESP32), dedicated bus

**Pin Mapping Differences:**
- SSD1306: SDA, SCL, VCC, GND
- ILI9341: MOSI, MISO, SCK, CS, DC, RESET, BL (backlight)

**Conclusion:** Different physical interfaces require different wiring and library calls.

### 4.3 Library Compatibility

**Adafruit SSD1306:**
- Designed specifically for SSD1306 and compatible OLED controllers
- I2C interface only
- Monochrome rendering
- Limited to small resolutions (typically 128x64)

**TFT_eSPI:**
- Designed for TFT displays (ILI9341, ST7735, ST7789, etc.)
- SPI interface (with DMA support on ESP32)
- Color rendering (16-bit RGB)
- Supports larger resolutions (up to 320x480+)
- Performance optimized for ESP32

**Conclusion:** Libraries are not interchangeable. Different APIs, different initialization sequences, different drawing methods.

---

## 5. REQUIRED CHANGES FOR ESP32-2432S028 SUPPORT

### 5.1 Library Changes

**Remove:**
- Adafruit SSD1306
- Adafruit GFX Library

**Add:**
- TFT_eSPI (Bodmer)
- TFT_eSPI user setup configuration for ILI9341

### 5.2 DisplayManager Rewrite

**Current DisplayManager Methods:**
```cpp
void clear();
void refresh();
void drawText(int x, int y, const String& text, uint8_t size = 1);
void drawTextCentered(int y, const String& text, uint8_t size = 1);
void drawLine(int x0, int y0, int x1, int y1);
void drawRect(int x, y, w, h);
void fillRect(int x, y, w, h);
void drawPixel(int x, int y);
void drawQRCode(int x, int y, const String& data, uint8_t scale = 1);
void drawQRCodeCentered(int y, const String& data, uint8_t scale = 1);
```

**Required Changes:**
- Replace Adafruit_SSD1306 with TFT_eSPI instance
- Update initialization sequence (ILI9341-specific)
- Update pin configuration (SPI pins)
- Add color support (foreground/background colors)
- Update resolution constants (240x320 instead of 128x64)
- Rewrite all drawing methods to use TFT_eSPI API
- Add backlight control (GPIO 21)
- Update rotation handling (landscape vs portrait)

### 5.3 Screen Layout Redesign

**Current Layout (128x64 OLED):**
- Landscape orientation
- Compact header layout
- Monochrome
- Small text sizes (1-2)

**Required Layout (240x320 TFT):**
- Portrait or landscape orientation (320x240 or 240x320)
- Color support (16-bit RGB)
- Larger text sizes possible
- More screen real estate for additional metrics
- Touch support (optional, requires XPT2046 library)

### 5.4 Pin Configuration

**Current (I2C):**
- SDA: GPIO 21
- SCL: GPIO 22

**Required (SPI for ILI9341 on ESP32-2432S028):**
- TFT_SCK: GPIO 14
- TFT_SDO: GPIO 12
- TFT_SDI: GPIO 13
- TFT_CS: GPIO 15
- TFT_RS (DC): GPIO 2
- TFT_BL: GPIO 21
- TFT_RST: GPIO 4 (shared with EN)

### 5.5 PlatformIO Configuration

**Current platformio.ini:**
```ini
lib_deps = 
    adafruit/Adafruit SSD1306
    adafruit/Adafruit GFX Library
    ricmoo/QRCode
```

**Required platformio.ini:**
```ini
lib_deps = 
    https://github.com/Bodmer/TFT_eSPI
    ricmoo/QRCode
build_flags =
    -DUSER_SETUP_LOADED=1
    -DILI9341_DRIVER=1
    -DTFT_WIDTH=240
    -DTFT_HEIGHT=320
    -DLOAD_GLCD=1
    -DLOAD_FONT2=1
    -DLOAD_FONT4=1
    -DLOAD_FONT6=1
    -DLOAD_FONT7=1
    -DLOAD_FONT8=1
    -DLOAD_GFXFF=1
    -DSMOOTH_FONT=1
```

### 5.6 Memory Impact

**Flash Usage:**
- Current (SSD1306): ~50 KB for display libraries
- Required (TFT_eSPI): ~150-200 KB for display libraries
- **Increase:** ~100-150 KB additional flash

**RAM Usage:**
- Current (SSD1306): ~2 KB for display buffer
- Required (TFT_eSPI): ~5-10 KB for display buffer (depends on partial/full buffer)
- **Increase:** ~3-8 KB additional RAM

**Impact:** Within ESP32 capabilities (4 MB flash, 520 KB RAM), but significant increase.

---

## 6. TRACK STRATEGY RECOMMENDATION

### 6.1 Option A: Continue OLED Track as SSD1306 Variant

**Description:** Maintain current OLED Track implementation for actual OLED hardware (128x64 SSD1306 displays).

**Pros:**
- Preserves existing work (O1-O6 phases)
- OLED hardware is low-cost, low-power, suitable for mining
- Monochrome display is sufficient for mining metrics
- Small form factor
- No changes required

**Cons:**
- Cannot use ESP32-2432S028 hardware
- Requires separate OLED hardware for testing
- Limited to 128x64 resolution
- No color support

**Recommendation:** **YES** - Continue OLED Track for actual OLED hardware.

### 6.2 Option B: Rename OLED Track to Display Track

**Description:** Rename "OLED Track" to "Display Track" to be hardware-agnostic, then add display abstraction layer to support both SSD1306 and ILI9341.

**Pros:**
- Hardware-agnostic naming
- Single codebase for multiple display types
- Reuses existing architecture (DeviceState, ScreenManager)

**Cons:**
- Significant refactoring required
- Display abstraction layer adds complexity
- Different capabilities (color vs monochrome) complicate design
- Increased maintenance burden
- Larger codebase
- Testing complexity increases

**Recommendation:** **NO** - Too much complexity for limited benefit.

### 6.3 Option C: Add Separate TFT Firmware Variant

**Description:** Create a new firmware variant `bitmind_tft_v1` for ESP32-2432S028 support, parallel to `bitmind_oled_v1`.

**Pros:**
- Clean separation of concerns
- No impact on existing OLED Track
- Can optimize for TFT capabilities (color, larger resolution)
- Can add touch support if needed
- Separate testing and validation
- Easier to maintain

**Cons:**
- Duplicate code (DeviceState, ScreenManager architecture)
- Two firmware variants to maintain
- Increased testing burden

**Recommendation:** **YES** - Best balance of separation and practicality.

### 6.4 Option D: Replace OLED Track with TFT Variant

**Description:** Abandon OLED Track, replace with TFT variant for ESP32-2432S028.

**Pros:**
- Single firmware variant
- ESP32-2432S028 is widely available and low-cost
- More display capabilities (color, larger resolution)

**Cons:**
- Loses all OLED Track work (O1-O6 phases)
- OLED hardware is better suited for mining (low power, small form factor)
- TFT is overkill for simple mining metrics
- Abandons completed work

**Recommendation:** **NO** - Unacceptable loss of completed work.

---

## 7. FINAL RECOMMENDATION

**Primary Recommendation:** **Option C - Add Separate TFT Firmware Variant**

**Rationale:**
1. **Preserves Existing Work:** OLED Track (O1-O6) remains intact for actual OLED hardware
2. **Hardware Reality:** ESP32-2432S028 is a different hardware platform requiring different implementation
3. **Clean Separation:** Each variant optimized for its display technology
4. **Low Risk:** No impact on existing OLED Track
5. **Future Flexibility:** Can add more display variants as needed

**Implementation Path:**
1. Create `esp32_firmware/bitmind_tft_v1/` directory
2. Copy OLED Track architecture (DeviceState, ScreenManager, etc.)
3. Replace DisplayManager with TFT_eSPI-based implementation
4. Redesign screen layouts for 240x320 color display
5. Update PlatformIO configuration for TFT_eSPI
6. Add TFT Track phases (T1-Tn) parallel to OLED Track phases
7. Maintain separate documentation for each track

**Naming Convention:**
- **OLED Track:** `bitmind_oled_v1` - For SSD1306 OLED displays (128x64)
- **TFT Track:** `bitmind_tft_v1` - For ILI9341 TFT displays (240x320)

**Documentation:**
- Keep `BITMIND_OLED_PHASE_*.md` for OLED Track
- Create `BITMIND_TFT_PHASE_*.md` for TFT Track
- Create `BITMIND_DISPLAY_TRACKS.md` to document all display variants

---

## 8. IMMEDIATE ACTIONS

**For OLED Track:**
1. No changes required
2. Continue with OLED hardware for testing
3. Document that OLED Track is for SSD1306 displays only

**For TFT Support:**
1. Create new firmware variant `bitmind_tft_v1`
2. Implement TFT_eSPI-based DisplayManager
3. Redesign mining dashboard for 240x320 color display
4. Test on ESP32-2432S028 hardware
5. Document TFT Track phases

**For Hardware Validation:**
1. Clearly document supported hardware for each firmware variant
2. Add hardware compatibility matrix to README
3. Update BITMIND_FIRMWARE_ARCHITECTURE.md to document multiple display variants

---

## 9. HARDWARE COMPATIBILITY MATRIX

| Firmware Variant | Display Controller | Resolution | Interface | Color | Hardware Example |
|------------------|-------------------|------------|-----------|-------|------------------|
| `bitmind_oled_v1` | SSD1306 | 128×64 | I2C | Monochrome | Generic OLED 0.96" |
| `bitmind_tft_v1` | ILI9341 | 240×320 | SPI | 16-bit RGB | ESP32-2432S028 (CYD) |

---

## 10. CONCLUSION

**Critical Finding:** The ESP32-2432S028 hardware is **incompatible** with the current OLED Track implementation due to fundamental differences in display technology (OLED vs TFT), controller (SSD1306 vs ILI9341), interface (I2C vs SPI), and resolution (128x64 vs 240x320).

**Recommended Action:** Create a separate TFT firmware variant for ESP32-2432S028 support while preserving the existing OLED Track for actual OLED hardware.

**No Code Changes Required:** This is an audit document only. No implementation changes.

---

**END OF AUDIT**
