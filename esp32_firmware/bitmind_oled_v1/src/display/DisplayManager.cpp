#include "DisplayManager.h"

DisplayManager::DisplayManager() 
  : display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET),
    initialized(false) {
}

bool DisplayManager::begin() {
  Serial.println("[DISPLAY] Initializing OLED...");
  
  // Initialize I2C
  Wire.begin();
  
  // Initialize SSD1306
  if (!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println("[DISPLAY] SSD1306 allocation failed");
    initialized = false;
    return false;
  }
  
  // Clear display
  display.clearDisplay();
  
  // Set default settings
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  
  // Show initial display buffer
  display.display();
  
  initialized = true;
  Serial.println("[DISPLAY] OLED initialized successfully");
  return true;
}

void DisplayManager::end() {
  if (initialized) {
    display.clearDisplay();
    display.display();
    initialized = false;
    Serial.println("[DISPLAY] OLED deinitialized");
  }
}

void DisplayManager::clear() {
  if (initialized) {
    display.clearDisplay();
  }
}

void DisplayManager::display() {
  if (initialized) {
    display.display();
  }
}

void DisplayManager::setBrightness(uint8_t brightness) {
  if (initialized) {
    display.dim(brightness < 128);
  }
}

void DisplayManager::drawText(int x, int y, const String& text, uint8_t size) {
  if (initialized) {
    display.setTextSize(size);
    display.setCursor(x, y);
    display.print(text);
  }
}

void DisplayManager::drawTextCentered(int y, const String& text, uint8_t size) {
  if (initialized) {
    display.setTextSize(size);
    int16_t x1, y1;
    uint16_t w, h;
    display.getTextBounds(text, 0, 0, &x1, &y1, &w, &h);
    int x = (SCREEN_WIDTH - w) / 2;
    display.setCursor(x, y);
    display.print(text);
  }
}

void DisplayManager::drawLine(int x0, int y0, int x1, int y1) {
  if (initialized) {
    display.drawLine(x0, y0, x1, y1, SSD1306_WHITE);
  }
}

void DisplayManager::drawRect(int x, int y, int w, int h) {
  if (initialized) {
    display.drawRect(x, y, w, h, SSD1306_WHITE);
  }
}

void DisplayManager::fillRect(int x, int y, int w, int h) {
  if (initialized) {
    display.fillRect(x, y, w, h, SSD1306_WHITE);
  }
}

void DisplayManager::drawPixel(int x, int y) {
  if (initialized) {
    display.drawPixel(x, y, SSD1306_WHITE);
  }
}

bool DisplayManager::isInitialized() const {
  return initialized;
}

int DisplayManager::getWidth() const {
  return SCREEN_WIDTH;
}

int DisplayManager::getHeight() const {
  return SCREEN_HEIGHT;
}

Adafruit_SSD1306& DisplayManager::getDisplay() {
  return display;
}
