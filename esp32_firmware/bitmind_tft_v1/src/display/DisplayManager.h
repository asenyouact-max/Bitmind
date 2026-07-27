#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include <Arduino.h>
#include <TFT_eSPI.h>

// TFT Configuration for ESP32-2432S028
#define TFT_WIDTH  240
#define TFT_HEIGHT 320
#define TFT_BL     21  // Backlight control pin

// Color definitions - T5.4.1 Final Palette (locked)
// RGB565 format: (R << 11) | (G << 5) | B
// RGB values scaled to 5/6/5 bits: R = (R8/255)*31, G = (G8/255)*63, B = (B8/255)*31
#define TFT_BG_COLOR      0x0862  // Background - Near-black
#define TFT_SURFACE_COLOR 0x10C4  // Surface - Card/panel background
#define TFT_BRAND_COLOR   0xF483  // Bitcoin Orange - Primary accent
#define TFT_CYAN_COLOR    0x061F  // Cyan - Secondary accent
#define TFT_FG_COLOR      0xE77E  // Primary Text - White
#define TFT_LABEL_COLOR   0x7C53  // Muted Text - Labels
#define TFT_DIM_COLOR     0x4A8C  // Dim Text - Disabled/offline

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
