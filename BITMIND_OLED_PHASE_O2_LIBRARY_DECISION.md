# BITMIND OLED PHASE O2 - LIBRARY DECISION

**Date:** 2026-06-22  
**Phase:** O2 - Display Foundation Implementation  
**Decision:** OLED Library Stack Selection  

---

## EVALUATED OPTIONS

### Option 1: Adafruit SSD1306 + Adafruit GFX

**Description:**
- Adafruit_SSD1306: SSD1306 OLED driver library
- Adafruit_GFX: Core graphics library (fonts, primitives, etc.)

**Pros:**
- Industry standard, widely used
- Excellent documentation
- Large community support
- Stable and mature
- Compatible with ESP32 Arduino Core
- Architecture specification recommendation
- Extensive example code
- Built-in font support
- Simple API

**Cons:**
- Larger memory footprint (~35 KB combined)
- Monochrome only (sufficient for our use case)
- I2C only (sufficient for our use case)

**Memory Impact:**
- Adafruit_SSD1306: ~15 KB
- Adafruit_GFX: ~20 KB
- Total: ~35 KB

**Flash Impact:**
- Libraries: ~50-100 KB

**PlatformIO Integration:**
```ini
lib_deps = 
    adafruit/Adafruit SSD1306
    adafruit/Adafruit GFX Library
```

---

### Option 2: U8g2

**Description:**
- Universal graphics library for embedded displays
- Supports many display controllers including SSD1306

**Pros:**
- More feature-rich
- Supports many display types
- Smaller memory footprint for basic operations
- More efficient rendering
- Unicode support
- More font options

**Cons:**
- More complex API
- Steeper learning curve
- Less beginner-friendly
- Overkill for simple monochrome OLED
- Architecture specification recommends Adafruit

**Memory Impact:**
- U8g2: ~20-25 KB (basic configuration)

**Flash Impact:**
- Library: ~40-80 KB

**PlatformIO Integration:**
```ini
lib_deps = 
    olikraus/U8g2
```

---

## DECISION

**Selected Option:** Adafruit SSD1306 + Adafruit GFX

**Rationale:**

1. **Architecture Compliance**
   - BITMIND_FIRMWARE_ARCHITECTURE.md explicitly specifies Adafruit libraries
   - Maintains consistency with architectural decisions

2. **Industry Standard**
   - Most widely used OLED library for Arduino/ESP32
   - Extensive community resources and examples
   - Well-tested and stable

3. **Simplicity**
   - Simple, intuitive API
   - Easy to implement and maintain
   - Lower development risk

4. **Documentation**
   - Excellent documentation
   - Many examples available
   - Easy troubleshooting

5. **Memory Feasibility**
   - Memory analysis shows sufficient headroom (~145-175 KB available)
   - 35 KB memory footprint is acceptable
   - Flash space is ample (~896-976 KB available)

6. **Future Compatibility**
   - Easy to find help and resources
   - Compatible with many development boards
   - Long-term support likely

---

## PLATFORMIO CONFIGURATION

```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino

; Serial Monitor options
monitor_speed = 115200
monitor_filters = esp32_exception_decoder

; Build options
build_flags = 
    -DCORE_DEBUG_LEVEL=3
    -DBOARD_HAS_PSRAM
    -mfix-esp32-psram-cache-issue

; Library dependencies
lib_deps = 
    https://github.com/Links2004/arduinoWebSockets
    adafruit/Adafruit SSD1306
    adafruit/Adafruit GFX Library
    ; WiFi (built-in)
    ; WebServer (built-in)
    ; Preferences (built-in)
    ; Wire (built-in)
    ; mbedtls (built-in)

; Upload options
upload_speed = 921600
```

---

## HARDWARE CONFIGURATION

**I2C Pins (Default):**
- SDA: GPIO 21
- SCL: GPIO 22

**OLED Configuration:**
- Address: 0x3C
- Resolution: 128x64
- Reset Pin: -1 (no reset pin)

**Initialization Code:**
```cpp
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
```

---

## MEMORY IMPACT SUMMARY

**Before OLED:**
- Legacy firmware: ~287 KB
- Available: ~113 KB

**After OLED:**
- Legacy firmware: ~287 KB
- OLED libraries: ~35 KB
- Display manager: ~10 KB
- Screen manager: ~5 KB
- Screen implementations: ~10 KB
- **Total: ~347 KB**
- **Available: ~73 KB**

**Conclusion:** Memory remains sufficient with comfortable headroom.

---

## RISKS

**Low Risk:**
- Well-established libraries
- Extensive testing in community
- Architecture specification alignment

**Mitigations:**
- Use standard I2C pins (21, 22)
- Follow library examples
- Monitor memory during development
- Use PSRAM if available for additional safety

---

## ALTERNATIVE PLAN

If Adafruit libraries prove insufficient:
1. Switch to U8g2 (more efficient)
2. Consider custom SSD1306 driver (most efficient)
3. Evaluate other lightweight libraries

**Trigger for Alternative:**
- Memory constraints encountered
- Performance issues
- Library bugs

---

## CONCLUSION

**Decision:** Use Adafruit SSD1306 + Adafruit GFX

**Justification:**
- Architecture compliant
- Industry standard
- Well-documented
- Memory feasible
- Low risk

**Next Steps:**
1. Add libraries to platformio.ini
2. Implement DisplayManager using Adafruit libraries
3. Test OLED initialization
4. Verify memory usage

---

**END OF LIBRARY DECISION**
