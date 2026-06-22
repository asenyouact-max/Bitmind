#include "SetupScreen.h"
#include "../DeviceState.h"

SetupScreen::SetupScreen(DisplayManager* displayManager)
  : Screen(displayManager) {
}

void SetupScreen::onEnter() {
  Serial.println("[SCREEN] Setup screen entered");
}

void SetupScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->fillScreen(TFT_BG_COLOR);
  
  // Header - BITMIND SETUP (centered, size 3, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawTextCentered(20, "BITMIND SETUP", 3);
  
  // Separator line
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->fillRect(10, 50, 300, 2);
  
  // Connect to WiFi (left-aligned, size 2, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawText(20, 70, "Connect to WiFi:", 2);
  
  // SSID (left-aligned, size 2, Bitcoin Orange)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(20, 100, "SSID: " + state.apSSID, 2);
  
  // IP (left-aligned, size 2, Bitcoin Orange)
  display->drawText(20, 130, "IP: " + state.apIP, 2);
  
  // Scan QR code or open (left-aligned, size 2, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawText(20, 160, "Scan QR code or open:", 2);
  
  // URL (left-aligned, size 2, light gray)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawText(20, 190, "http://" + state.apIP, 2);
  
  // QR Code (centered, scale 4)
  display->drawQRCodeCentered(200, state.qrPayload, 4);
  
  // Instructions (left-aligned, size 1, light gray)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawText(20, 210, "1. Connect to WiFi above", 1);
  display->drawText(20, 225, "2. Scan QR or open URL", 1);
  display->drawText(20, 240, "3. Configure device", 1);
}
