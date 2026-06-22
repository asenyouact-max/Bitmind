#include "ConnectingScreen.h"
#include "../DeviceState.h"

ConnectingScreen::ConnectingScreen(DisplayManager* displayManager)
  : Screen(displayManager) {
}

void ConnectingScreen::onEnter() {
  Serial.println("[SCREEN] Connecting screen entered");
}

void ConnectingScreen::render() {
  const DeviceState& state = DeviceStateManager::getState();
  
  display->fillScreen(TFT_BG_COLOR);
  
  // Header - CONNECTING (centered, size 3, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawTextCentered(20, "CONNECTING", 3);
  
  // Separator line
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->fillRect(10, 50, 300, 2);
  
  // Connecting to WiFi... (centered, size 2, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawTextCentered(80, "Connecting to WiFi...", 2);
  
  // WiFi icon + SSID (Bitcoin Orange)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(20, 120, "● " + state.wifiSSID, 2);
  
  // Connecting to backend... (centered, size 2, white)
  display->setForegroundColor(TFT_FG_COLOR);
  display->drawTextCentered(160, "Connecting to backend...", 2);
  
  // Server icon + hostname (Bitcoin Orange)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->drawText(20, 200, "● getbitmind.com", 2);
  
  // Please wait... (centered, size 2, light gray)
  display->setForegroundColor(TFT_GRAY_COLOR);
  display->drawTextCentered(240, "Please wait...", 2);
  
  // Progress bar (Bitcoin Orange)
  display->setForegroundColor(TFT_BRAND_COLOR);
  display->fillRect(20, 270, 280, 10);
}
