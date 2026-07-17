#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include <Arduino.h>
#include <TFT_eSPI.h>

// TFT Configuration for ESP32-2432S028
#define TFT_WIDTH  240
#define TFT_HEIGHT 320
#define TFT_BL     21  // Backlight control pin

// Color definitions - Bitcoin Orange Brand Identity (T5.1 spec)
#define TFT_BG_COLOR      0x0820  // #0b0f14 - Near-black background
#define TFT_FG_COLOR      0xF7FE  // #e6edf3 - Primary text
#define TFT_BRAND_COLOR   0xF7C0  // #f7931a - Bitcoin Orange (primary accent)
#define TFT_CYAN_COLOR    0x031F  // #00c3ff - Cyan (secondary accent, connecting states)
#define TFT_CARD_COLOR    0x0D10  // #121821 - Card/panel surface
#define TFT_LABEL_COLOR   0x6B2E  // #7d8a99 - Muted text (labels)
#define TFT_DIM_COLOR     0x3A30  // #4a5361 - Disabled/offline values
#define TFT_SUCCESS_COLOR 0x07E0  // Green (success/connected only)
#define TFT_ERROR_COLOR   0xF800  // Red
#define TFT_WARN_COLOR    0xFD20  // Orange (warning/activity)
#define TFT_INFO_COLOR    0x001F  // Blue
#define TFT_GRAY_COLOR    0xC618  // Light gray (secondary text)

class DisplayManager {
public:
  DisplayManager(TFT_eSPI& tft);
  ~DisplayManager();
  
  // Initialization
  bool begin();
  void end();
  
  // Display Control
  void clear();
  void refresh();
  void setBrightness(uint8_t brightness);
  
  // Drawing Primitives
  void drawText(int x, int y, const String& text, uint8_t size = 1);
  void drawTextCentered(int y, const String& text, uint8_t size = 1);
  void drawLine(int x0, int y0, int x1, int y1);
  void drawRect(int x, int y, int w, int h);
  void fillRect(int x, int y, int w, int h);
  void drawPixel(int x, int y);
  
  // QR Code (placeholder for Phase T3)
  void drawQRCode(int x, int y, const String& data, uint8_t scale = 1);
  void drawQRCodeCentered(int y, const String& data, uint8_t scale = 1);
  
  // State
  bool isInitialized() const;
  int getWidth();
  int getHeight();
  TFT_eSPI& getDisplay();
  
  // TFT-specific methods
  void setForegroundColor(uint16_t color);
  void setBackgroundColor(uint16_t color);
  void setRotation(uint8_t rotation);
  void fillScreen(uint16_t color);
  
private:
  TFT_eSPI& display;  // Reference to global TFT_eSPI object (Phase T2.5 fix)
  bool initialized;
  uint16_t foregroundColor;
  uint16_t backgroundColor;
  uint8_t brightness;
  
  // Library-independent text width calculation
  int calculateTextWidth(const String& text, uint8_t size);
};

#endif // DISPLAY_MANAGER_H
