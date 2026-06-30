#include "DisplayManager.h"

DisplayManager::DisplayManager(TFT_eSPI& tft) 
  : display(tft),
    initialized(false),
    foregroundColor(TFT_FG_COLOR),
    backgroundColor(TFT_BG_COLOR),
    brightness(255) {
  Serial.printf("[LIFECYCLE] DisplayManager::DisplayManager() - this=%p, &display=%p\n", this, &display);
}

DisplayManager::~DisplayManager() {
  Serial.printf("[LIFECYCLE] DisplayManager::~DisplayManager() - this=%p\n", this);
  end();
}

bool DisplayManager::begin() {
  Serial.println("[TFT] Initializing display...");
  
  // Initialize TFT_eSPI (identical to hardware_test)
  display.begin();
  
  // Set rotation to landscape (ILI9341_2_DRIVER requires rotation 3 for CYD)
  display.setRotation(3);
  
  // Fill screen with background color (identical to hardware_test)
  display.fillScreen(backgroundColor);
  
  // Set default text color (identical to hardware_test)
  display.setTextColor(foregroundColor, backgroundColor);
  
  // Set default text size (hardware_test uses 2, but we use 1 for flexibility)
  display.setTextSize(1);
  
  // Note: Don't set cursor here - let each render call set it
  // hardware_test sets cursor immediately before print()
  
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
    Serial.printf("[DEBUG] drawText: x=%d, y=%d, text='%s', size=%d\n", x, y, text.c_str(), size);
    display.setTextSize(size);
    display.setTextColor(foregroundColor, backgroundColor);
    display.setCursor(x, y);
    display.print(text.c_str());  // Convert to const char* to avoid Arduino String
    Serial.println("[DEBUG] drawText: completed");
  }
}

void DisplayManager::drawTextCentered(int y, const String& text, uint8_t size) {
  if (initialized) {
    Serial.printf("[DEBUG] drawTextCentered: y=%d, text='%s', size=%d\n", y, text.c_str(), size);
    display.setTextSize(size);
    display.setTextColor(foregroundColor, backgroundColor);
    
    // Use library-independent text width calculation
    int textWidth = calculateTextWidth(text, size);
    int x = (display.width() - textWidth) / 2;
    display.setCursor(x, y);
    display.print(text.c_str());  // Convert to const char* to avoid Arduino String
    Serial.println("[DEBUG] drawTextCentered: completed");
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
    Serial.printf("[DEBUG] fillRect: x=%d, y=%d, w=%d, h=%d, color=0x%04X\n", x, y, w, h, foregroundColor);
    display.fillRect(x, y, w, h, foregroundColor);
    Serial.println("[DEBUG] fillRect: completed");
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

int DisplayManager::calculateTextWidth(const String& text, uint8_t size) {
  // Library-independent text width calculation
  // Based on standard TFT_eSPI font widths
  // Size 1: 6px, Size 2: 12px, Size 3: 18px, Size 4: 24px, Size 6: 48px
  int charWidth = 6 * size;
  return text.length() * charWidth;
}
