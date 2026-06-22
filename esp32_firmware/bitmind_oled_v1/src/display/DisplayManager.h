#ifndef DISPLAY_MANAGER_H
#define DISPLAY_MANAGER_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <qrcode.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C
#define QR_VERSION 2

class DisplayManager {
public:
  DisplayManager();
  
  // Initialization
  bool begin();
  void end();
  
  // Display Control
  void clear();
  void display();
  void setBrightness(uint8_t brightness);
  
  // Drawing Primitives
  void drawText(int x, int y, const String& text, uint8_t size = 1);
  void drawTextCentered(int y, const String& text, uint8_t size = 1);
  void drawLine(int x0, int y0, int x1, int y1);
  void drawRect(int x, int y, int w, int h);
  void fillRect(int x, int y, int w, int h);
  void drawPixel(int x, int y);
  
  // QR Code Drawing
  void drawQRCode(int x, int y, const String& data, uint8_t scale = 1);
  void drawQRCodeCentered(int y, const String& data, uint8_t scale = 1);
  
  // Display Info
  bool isInitialized() const;
  int getWidth() const;
  int getHeight() const;
  
  // Low-level access (for screens)
  Adafruit_SSD1306& getDisplay();
  
private:
  Adafruit_SSD1306 display;
  bool initialized;
};

#endif // DISPLAY_MANAGER_H
