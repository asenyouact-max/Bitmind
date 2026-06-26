#include "DisplayManager.h"

DisplayManager::DisplayManager() 
  : display(TFT_WIDTH, TFT_HEIGHT),
    initialized(false),
    foregroundColor(TFT_FG_COLOR),
    backgroundColor(TFT_BG_COLOR),
    brightness(255) {
}

DisplayManager::~DisplayManager() {
  end();
}

bool DisplayManager::begin() {
  Serial.println("[TFT] Initializing display...");
  
  // Initialize TFT_eSPI
  display.begin();
  
  // Set rotation to landscape (320x240)
  display.setRotation(1);
  
  // Fill screen with background color
  display.fillScreen(backgroundColor);
  
  // Set default text color and size
  display.setTextColor(foregroundColor, backgroundColor);
  display.setTextSize(1);
  display.setCursor(0, 0);
  
  // Enable backlight
  pinMode(TFT_BL, OUTPUT);
  digitalWrite(TFT_BL, HIGH);
  
  initialized = true;
  
  Serial.println("[TFT] Display ready");
  Serial.println("[TFT] Backlight enabled");
  
  return true;
}

void DisplayManager::end() {
  if (initialized) {
    // Turn off backlight
    digitalWrite(TFT_BL, LOW);
    display.fillScreen(TFT_BLACK);
    initialized = false;
    Serial.println("[TFT] Display ended");
  }
}

void DisplayManager::clear() {
  if (initialized) {
    display.fillScreen(backgroundColor);
  }
}

void DisplayManager::refresh() {
  if (initialized) {
    // TFT_eSPI doesn't need explicit refresh like SSD1306
    // Drawing operations are immediate
  }
}

void DisplayManager::setBrightness(uint8_t brightness) {
  this->brightness = brightness;
  if (initialized) {
    // Simple on/off for now (PWM can be added later)
    digitalWrite(TFT_BL, brightness > 0 ? HIGH : LOW);
  }
}

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
    
    // Use TFT_eSPI textWidth() - convert String to c_str() for compatibility
    int textWidth = display.textWidth(text.c_str());
    int x = (display.width() - textWidth) / 2;
    display.setCursor(x, y);
    display.print(text);
  }
}

void DisplayManager::drawLine(int x0, int y0, int x1, int y1) {
  if (initialized) {
    display.drawLine(x0, y0, x1, y1, foregroundColor);
  }
}

void DisplayManager::drawRect(int x, int y, int w, int h) {
  if (initialized) {
    display.drawRect(x, y, w, h, foregroundColor);
  }
}

void DisplayManager::fillRect(int x, int y, int w, int h) {
  if (initialized) {
    display.fillRect(x, y, w, h, foregroundColor);
  }
}

void DisplayManager::drawPixel(int x, int y) {
  if (initialized) {
    display.drawPixel(x, y, foregroundColor);
  }
}

void DisplayManager::drawQRCode(int x, int y, const String& data, uint8_t scale) {
  // Placeholder for Phase T3
  // QR code implementation will be added in Phase T3
  if (initialized) {
    display.fillRect(x, y, scale * 21, scale * 21, foregroundColor);
  }
}

void DisplayManager::drawQRCodeCentered(int y, const String& data, uint8_t scale) {
  // Placeholder for Phase T3
  // QR code implementation will be added in Phase T3
  if (initialized) {
    int qrSize = scale * 21;
    int x = (display.width() - qrSize) / 2;
    display.fillRect(x, y, qrSize, qrSize, foregroundColor);
  }
}

bool DisplayManager::isInitialized() const {
  return initialized;
}

int DisplayManager::getWidth() {
  return display.width();
}

int DisplayManager::getHeight() {
  return display.height();
}

TFT_eSPI& DisplayManager::getDisplay() {
  return display;
}

void DisplayManager::setForegroundColor(uint16_t color) {
  foregroundColor = color;
  display.setTextColor(foregroundColor, backgroundColor);
}

void DisplayManager::setBackgroundColor(uint16_t color) {
  backgroundColor = color;
  display.setTextColor(foregroundColor, backgroundColor);
}

void DisplayManager::setRotation(uint8_t rotation) {
  if (initialized) {
    display.setRotation(rotation);
  }
}

void DisplayManager::fillScreen(uint16_t color) {
  if (initialized) {
    display.fillScreen(color);
  }
}
